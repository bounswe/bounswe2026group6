package com.neph.features.availability.data

import android.content.Context
import android.content.SharedPreferences
import com.neph.BuildConfig
import com.neph.core.NephAppContext
import com.neph.core.database.AvailabilityEntity
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.database.SyncOperationEntity
import com.neph.core.network.JsonHttpClient
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.core.sync.SyncEntityType
import com.neph.core.sync.SyncOperationType
import com.neph.core.sync.SyncStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

data class AvailabilityState(
    val isAvailable: Boolean = false,
    val assignmentId: String? = null,
    val syncStatus: String = SyncStatus.SYNCED,
    val pendingError: String? = null,
    val lastSyncedAtEpochMillis: Long? = null
) {
    val isPendingSync: Boolean
        get() = syncStatus == SyncStatus.PENDING_UPDATE

    val isFailedSync: Boolean
        get() = syncStatus == SyncStatus.FAILED || syncStatus == SyncStatus.CONFLICTED
}

object AvailabilityAccessPolicy {
    // Logged-in users only.
    private const val EnforceAuthentication = true

    fun canAccess(token: String?): Boolean = !EnforceAuthentication || !token.isNullOrBlank()

    fun shouldRedirectToLogin(): Boolean = EnforceAuthentication
}

object AvailabilityRepository {
    private const val PrefsName = "neph_availability"
    private const val AvailabilityKey = "is_available"
    private const val AssignmentIdKey = "assignment_id"

    private lateinit var prefs: SharedPreferences
    private var cachedState = AvailabilityState()
    private val repositoryScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val database get() = NephDatabaseProvider.requireInstance()

    fun initialize(context: Context) {
        if (!::prefs.isInitialized) {
            val appContext = context.applicationContext
            NephAppContext.initialize(appContext)
            NephDatabaseProvider.initialize(appContext)
            prefs = appContext.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            cachedState = AvailabilityState(
                isAvailable = prefs.getBoolean(AvailabilityKey, false),
                assignmentId = prefs.getString(AssignmentIdKey, null)
            )
            repositoryScope.launch {
                val current = database.availabilityDao().get()
                if (current != null) {
                    cachedState = current.toState()
                } else {
                    val migrated = AvailabilityEntity(
                        isAvailable = cachedState.isAvailable,
                        assignmentId = cachedState.assignmentId,
                        updatedAtEpochMillis = System.currentTimeMillis(),
                        lastSyncedAtEpochMillis = null
                    )
                    database.availabilityDao().upsert(migrated)
                    cachedState = migrated.toState()
                }
            }
        }
    }

    fun observeAvailabilityState(): Flow<AvailabilityState> {
        ensureInitialized()
        return database.availabilityDao().observe().map { entity ->
            val next = entity?.toState() ?: cachedState
            cachedState = next
            next
        }
    }

    fun getAvailabilityState(): AvailabilityState {
        ensureInitialized()
        return cachedState
    }

    fun resetForTesting() {
        requireDebugBuildForTestingReset()

        cachedState = AvailabilityState()
        if (::prefs.isInitialized) {
            prefs.edit().clear().commit()
        }
    }

    private fun requireDebugBuildForTestingReset() {
        check(BuildConfig.DEBUG) {
            "AvailabilityRepository.resetForTesting() is only available in debug/e2e test builds."
        }
    }

    suspend fun setAvailabilityStateForUi(state: AvailabilityState) {
        ensureInitialized()
        saveAvailabilityState(state.toEntity(syncStatus = state.syncStatus))
    }

    suspend fun refreshAssignmentState(token: String): AvailabilityState {
        ensureInitialized()

        val response = JsonHttpClient.request(
            path = "/availability/status",
            token = token
        )

        val assignment = response.optJSONObject("assignment")
        val nextState = AvailabilityState(
            isAvailable = response.optBoolean("isAvailable", false),
            assignmentId = assignment?.optString("assignment_id")?.takeIf { it.isNotBlank() },
            syncStatus = SyncStatus.SYNCED,
            pendingError = null,
            lastSyncedAtEpochMillis = System.currentTimeMillis()
        )

        saveAvailabilityState(nextState.toEntity(syncStatus = SyncStatus.SYNCED))
        return nextState
    }

    suspend fun setAvailability(
        isAvailable: Boolean,
        token: String?
    ): AvailabilityState {
        ensureInitialized()
        val now = System.currentTimeMillis()
        val nextState = AvailabilityState(
            isAvailable = isAvailable,
            assignmentId = cachedState.assignmentId,
            syncStatus = SyncStatus.PENDING_UPDATE,
            pendingError = null,
            lastSyncedAtEpochMillis = cachedState.lastSyncedAtEpochMillis
        )

        saveAvailabilityState(nextState.toEntity(syncStatus = SyncStatus.PENDING_UPDATE, now = now))
        database.syncOperationDao().upsert(
            SyncOperationEntity(
                entityType = SyncEntityType.AVAILABILITY,
                entityId = AvailabilityEntity.CURRENT_KEY,
                operationType = SyncOperationType.SET_AVAILABILITY,
                payloadJson = JSONObject()
                    .put("isAvailable", isAvailable)
                    .put("timestamp", now)
                    .toString(),
                createdAtEpochMillis = now
            )
        )
        OfflineSyncScheduler.enqueueSync(NephAppContext.get(), reason = "availability-updated")
        return nextState
    }

    internal suspend fun pushAvailabilityOperations(
        operations: List<SyncOperationEntity>,
        token: String?
    ) {
        if (operations.isEmpty() || token.isNullOrBlank()) return

        val records = JSONArray().apply {
            operations.sortedBy { it.createdAtEpochMillis }.forEach { operation ->
                val payload = JSONObject(operation.payloadJson)
                put(
                    JSONObject()
                        .put("isAvailable", payload.optBoolean("isAvailable"))
                        .put("timestamp", payload.optLong("timestamp").toIsoLikeString())
                )
            }
        }

        val response = JsonHttpClient.request(
            path = "/availability/sync",
            method = "POST",
            token = token,
            body = JSONObject().put("records", records)
        )

        val volunteer = response.optJSONObject("volunteer")
        val assignment = response.optJSONObject("assignment")
        val now = System.currentTimeMillis()
        saveAvailabilityState(
            AvailabilityEntity(
                isAvailable = volunteer?.optBoolean("is_available") ?: cachedState.isAvailable,
                assignmentId = assignment?.optString("assignment_id")?.takeIf { it.isNotBlank() },
                syncStatus = SyncStatus.SYNCED,
                pendingError = null,
                updatedAtEpochMillis = now,
                lastSyncedAtEpochMillis = now
            )
        )

        operations.forEach { database.syncOperationDao().delete(it.operationId) }
    }


    internal suspend fun markSyncDeferred(message: String?) {
        val now = System.currentTimeMillis()
        saveAvailabilityState(
            (database.availabilityDao().get() ?: AvailabilityEntity(
                isAvailable = cachedState.isAvailable,
                assignmentId = cachedState.assignmentId,
                updatedAtEpochMillis = now
            )).copy(
                syncStatus = SyncStatus.PENDING_UPDATE,
                pendingError = message,
                updatedAtEpochMillis = now
            )
        )
    }

    internal suspend fun markSyncFailed(message: String?) {
        val now = System.currentTimeMillis()
        saveAvailabilityState(
            (database.availabilityDao().get() ?: AvailabilityEntity(
                isAvailable = false,
                assignmentId = null,
                updatedAtEpochMillis = now
            )).copy(
                syncStatus = SyncStatus.FAILED,
                pendingError = message,
                updatedAtEpochMillis = now
            )
        )
    }

    private suspend fun saveAvailabilityState(entity: AvailabilityEntity) {
        cachedState = entity.toState()
        database.availabilityDao().upsert(entity)
        prefs.edit().apply {
            putBoolean(AvailabilityKey, entity.isAvailable)
            if (entity.assignmentId.isNullOrBlank()) {
                remove(AssignmentIdKey)
            } else {
                putString(AssignmentIdKey, entity.assignmentId)
            }
        }.apply()
    }

    private fun AvailabilityState.toEntity(
        syncStatus: String,
        now: Long = System.currentTimeMillis()
    ): AvailabilityEntity {
        return AvailabilityEntity(
            isAvailable = isAvailable,
            assignmentId = assignmentId,
            syncStatus = syncStatus,
            pendingError = pendingError,
            updatedAtEpochMillis = now,
            lastSyncedAtEpochMillis = lastSyncedAtEpochMillis
        )
    }

    private fun AvailabilityEntity.toState(): AvailabilityState {
        return AvailabilityState(
            isAvailable = isAvailable,
            assignmentId = assignmentId,
            syncStatus = syncStatus,
            pendingError = pendingError,
            lastSyncedAtEpochMillis = lastSyncedAtEpochMillis
        )
    }

    private fun Long.toIsoLikeString(): String {
        // Backend only requires a parsable timestamp and sorts by Date(timestamp).
        val formatter = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
        formatter.timeZone = java.util.TimeZone.getTimeZone("UTC")
        return formatter.format(java.util.Date(this))
    }

    private fun ensureInitialized() {
        check(::prefs.isInitialized) {
            "AvailabilityRepository must be initialized before use."
        }
    }
}
