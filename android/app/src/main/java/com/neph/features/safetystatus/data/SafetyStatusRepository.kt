package com.neph.features.safetystatus.data

import android.content.Context
import com.neph.core.NephAppContext
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.database.SafetyStatusEntity
import com.neph.core.database.SyncOperationEntity
import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.core.sync.SyncConflictPolicy
import com.neph.core.sync.SyncEntityType
import com.neph.core.sync.SyncOperationStatus
import com.neph.core.sync.SyncOperationType
import com.neph.core.sync.SyncStatus
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.profile.data.CurrentDeviceLocation
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.json.JSONObject

data class SafetyStatusState(
    val status: String = "unknown",
    val note: String? = null,
    val shareLocationConsent: Boolean = false,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val accuracyMeters: Double? = null,
    val source: String? = null,
    val capturedAt: String? = null,
    val checkedAtEpochMillis: Long? = null,
    val syncStatus: String = SyncStatus.SYNCED,
    val pendingError: String? = null,
    val lastSyncedAtEpochMillis: Long? = null
) {
    val hasLocation: Boolean
        get() = latitude != null && longitude != null

    val isPendingSync: Boolean
        get() = syncStatus == SyncStatus.PENDING_UPDATE

    val isFailedSync: Boolean
        get() = syncStatus == SyncStatus.FAILED || syncStatus == SyncStatus.CONFLICTED
}

object SafetyStatusRepository {
    private val database get() = NephDatabaseProvider.requireInstance()

    fun initialize(context: Context) {
        val appContext = context.applicationContext
        NephAppContext.initialize(appContext)
        NephDatabaseProvider.initialize(appContext)
    }

    fun observeSafetyStatusState(): Flow<SafetyStatusState> {
        return database.safetyStatusDao().observe().map { entity ->
            entity?.toState() ?: SafetyStatusState()
        }
    }

    suspend fun getSafetyStatusState(): SafetyStatusState {
        return database.safetyStatusDao().get()?.toState() ?: SafetyStatusState()
    }

    suspend fun markSafe(
        token: String,
        note: String? = null,
        location: CurrentDeviceLocation? = null,
        shareLocationConsent: Boolean = false
    ): SafetyStatusState {
        val body = buildMarkSafePayload(
            note = note,
            location = location,
            shareLocationConsent = shareLocationConsent
        )
        val now = System.currentTimeMillis()
        val entity = buildPendingSafetyStatusEntity(
            payload = body,
            checkedAtEpochMillis = now,
            existing = database.safetyStatusDao().get()
        )

        database.safetyStatusDao().upsert(entity)
        upsertSafetyStatusOperation(payload = body, now = now)
        OfflineSyncScheduler.enqueueSync(NephAppContext.get(), reason = "safety-status-updated")

        if (token.isBlank()) {
            markSyncDeferred("Login required before your safety status can sync.")
            return getSafetyStatusState()
        }

        syncPendingSafetyStatusNow(token)
        return getSafetyStatusState()
    }

    internal fun buildMarkSafePayload(
        note: String? = null,
        location: CurrentDeviceLocation? = null,
        shareLocationConsent: Boolean = false
    ): JSONObject {
        val sharedLocation = location.takeIf { shareLocationConsent }
        val body = JSONObject()
            .put("status", "safe")
            .put("shareLocationConsent", sharedLocation != null)

        if (!note.isNullOrBlank()) {
            body.put("note", note.trim())
        }

        if (sharedLocation != null) {
            body.put(
                "location",
                JSONObject()
                    .put("latitude", sharedLocation.latitude)
                    .put("longitude", sharedLocation.longitude)
                    .put("accuracyMeters", sharedLocation.accuracyMeters)
                    .put("source", sharedLocation.source)
                    .put("capturedAt", sharedLocation.capturedAt)
            )
        } else {
            body.put("location", JSONObject.NULL)
        }

        return body
    }

    suspend fun syncPendingSafetyStatusNow(token: String?) {
        val operation = database.syncOperationDao().getLatestPendingOperation(
            entityType = SyncEntityType.SAFETY_STATUS,
            entityId = SafetyStatusEntity.CURRENT_KEY,
            operationType = SyncOperationType.SET_SAFETY_STATUS
        ) ?: return

        pushSafetyStatusOperationWithPolicy(operation, token)
    }

    suspend fun refreshMySafetyStatus(token: String): SafetyStatusState {
        if (token.isBlank()) return getSafetyStatusState()

        val response = JsonHttpClient.request(
            path = "/safety-status/me",
            token = token
        )
        val safetyStatus = response.optJSONObject("safetyStatus") ?: return getSafetyStatusState()
        val current = database.safetyStatusDao().get()
        if (current?.syncStatus == SyncStatus.PENDING_UPDATE || current?.syncStatus == SyncStatus.FAILED) {
            return current.toState()
        }

        val now = System.currentTimeMillis()
        val synced = safetyStatus.toEntity(
            checkedAtEpochMillis = current?.checkedAtEpochMillis ?: now,
            now = now
        )
        database.safetyStatusDao().upsert(synced)
        return synced.toState()
    }

    internal suspend fun pushSafetyStatusOperation(operation: SyncOperationEntity, token: String?) {
        if (token.isNullOrBlank()) {
            markSyncDeferred("Login required before your safety status can sync.")
            return
        }

        val response = JsonHttpClient.request(
            path = "/safety-status/me",
            method = "PATCH",
            token = token,
            body = JSONObject(operation.payloadJson)
        )
        val safetyStatus = response.optJSONObject("safetyStatus")
        val now = System.currentTimeMillis()
        val synced = if (safetyStatus != null) {
            safetyStatus.toEntity(
                checkedAtEpochMillis = database.safetyStatusDao().get()?.checkedAtEpochMillis ?: now,
                now = now
            )
        } else {
            buildPendingSafetyStatusEntity(
                payload = JSONObject(operation.payloadJson),
                checkedAtEpochMillis = database.safetyStatusDao().get()?.checkedAtEpochMillis ?: now,
                existing = database.safetyStatusDao().get()
            ).copy(
                syncStatus = SyncStatus.SYNCED,
                pendingError = null,
                updatedAtEpochMillis = now,
                lastSyncedAtEpochMillis = now
            )
        }
        database.safetyStatusDao().upsert(synced)
        database.syncOperationDao().delete(operation.operationId)
    }

    internal suspend fun markSyncDeferred(message: String?) {
        val now = System.currentTimeMillis()
        val current = database.safetyStatusDao().get() ?: return
        database.safetyStatusDao().upsert(
            current.copy(
                syncStatus = SyncStatus.PENDING_UPDATE,
                pendingError = message,
                updatedAtEpochMillis = now
            )
        )
    }

    internal suspend fun markSyncFailed(message: String?) {
        val now = System.currentTimeMillis()
        val current = database.safetyStatusDao().get() ?: return
        database.safetyStatusDao().upsert(
            current.copy(
                syncStatus = SyncStatus.FAILED,
                pendingError = message,
                updatedAtEpochMillis = now
            )
        )
    }

    private suspend fun pushSafetyStatusOperationWithPolicy(
        operation: SyncOperationEntity,
        token: String?
    ): Boolean {
        if (token.isNullOrBlank()) {
            database.syncOperationDao().updateStatus(
                operationId = operation.operationId,
                status = SyncOperationStatus.PENDING,
                attemptCount = operation.attemptCount,
                lastAttemptAtEpochMillis = operation.lastAttemptAtEpochMillis,
                error = "Login required before your safety status can sync."
            )
            markSyncDeferred("Login required before your safety status can sync.")
            return false
        }

        val attempt = operation.attemptCount + 1
        val now = System.currentTimeMillis()
        database.syncOperationDao().updateStatus(
            operationId = operation.operationId,
            status = SyncOperationStatus.IN_PROGRESS,
            attemptCount = attempt,
            lastAttemptAtEpochMillis = now,
            error = null
        )

        return try {
            pushSafetyStatusOperation(operation, token)
            false
        } catch (error: ApiException) {
            if (error.status == 401) {
                AuthSessionStore.clearAccessToken()
                database.syncOperationDao().updateStatus(
                    operationId = operation.operationId,
                    status = SyncOperationStatus.PENDING,
                    attemptCount = attempt,
                    lastAttemptAtEpochMillis = now,
                    error = "Session expired. Log in again to sync your safety status."
                )
                markSyncDeferred("Session expired. Log in again to sync your safety status.")
                false
            } else {
                handleSafetyStatusSyncFailure(operation, attempt, error.message, error.status)
            }
        } catch (error: Exception) {
            handleSafetyStatusSyncFailure(operation, attempt, error.message, status = 0)
        }
    }

    private suspend fun handleSafetyStatusSyncFailure(
        operation: SyncOperationEntity,
        attempt: Int,
        message: String?,
        status: Int
    ): Boolean {
        val retry = SyncConflictPolicy.shouldRetryHttpStatus(status, attempt)
        database.syncOperationDao().updateStatus(
            operationId = operation.operationId,
            status = if (retry) SyncOperationStatus.PENDING else SyncOperationStatus.FAILED,
            attemptCount = attempt,
            lastAttemptAtEpochMillis = System.currentTimeMillis(),
            error = message
        )

        if (retry) {
            markSyncDeferred(message)
        } else {
            markSyncFailed(message)
        }

        return retry
    }

    private suspend fun upsertSafetyStatusOperation(payload: JSONObject, now: Long) {
        val existingOperation = database.syncOperationDao().getLatestPendingOperation(
            entityType = SyncEntityType.SAFETY_STATUS,
            entityId = SafetyStatusEntity.CURRENT_KEY,
            operationType = SyncOperationType.SET_SAFETY_STATUS
        )
        database.syncOperationDao().upsert(
            existingOperation?.copy(
                payloadJson = payload.toString(),
                status = SyncOperationStatus.PENDING,
                attemptCount = 0,
                lastAttemptAtEpochMillis = null,
                error = null
            ) ?: SyncOperationEntity(
                entityType = SyncEntityType.SAFETY_STATUS,
                entityId = SafetyStatusEntity.CURRENT_KEY,
                operationType = SyncOperationType.SET_SAFETY_STATUS,
                payloadJson = payload.toString(),
                createdAtEpochMillis = now
            )
        )
    }

    internal fun buildPendingSafetyStatusEntity(
        payload: JSONObject,
        checkedAtEpochMillis: Long,
        existing: SafetyStatusEntity? = null
    ): SafetyStatusEntity {
        val location = payload.optJSONObject("location")
        return SafetyStatusEntity(
            status = payload.optString("status").ifBlank { "safe" },
            note = payload.optString("note").trim().takeIf { it.isNotBlank() },
            shareLocationConsent = payload.optBoolean("shareLocationConsent", false),
            latitude = location?.optDoubleOrNull("latitude"),
            longitude = location?.optDoubleOrNull("longitude"),
            accuracyMeters = location?.optDoubleOrNull("accuracyMeters"),
            source = location?.optString("source")?.trim()?.takeIf { it.isNotBlank() },
            capturedAt = location?.optString("capturedAt")?.trim()?.takeIf { it.isNotBlank() },
            checkedAtEpochMillis = checkedAtEpochMillis,
            updatedAtEpochMillis = checkedAtEpochMillis,
            syncStatus = SyncStatus.PENDING_UPDATE,
            pendingError = null,
            lastSyncedAtEpochMillis = existing?.lastSyncedAtEpochMillis,
            serverUpdatedAt = existing?.serverUpdatedAt
        )
    }

    private fun JSONObject.toEntity(
        checkedAtEpochMillis: Long,
        now: Long
    ): SafetyStatusEntity {
        val location = optJSONObject("location")
        return SafetyStatusEntity(
            status = optString("status").ifBlank { "unknown" },
            note = optString("note").trim().takeIf { it.isNotBlank() },
            shareLocationConsent = optBoolean("shareLocationConsent", false),
            latitude = location?.optDoubleOrNull("latitude"),
            longitude = location?.optDoubleOrNull("longitude"),
            accuracyMeters = location?.optDoubleOrNull("accuracyMeters"),
            source = location?.optString("source")?.trim()?.takeIf { it.isNotBlank() },
            capturedAt = location?.optString("capturedAt")?.trim()?.takeIf { it.isNotBlank() },
            checkedAtEpochMillis = checkedAtEpochMillis,
            updatedAtEpochMillis = now,
            syncStatus = SyncStatus.SYNCED,
            pendingError = null,
            lastSyncedAtEpochMillis = now,
            serverUpdatedAt = optString("updatedAt").trim().takeIf { it.isNotBlank() }
        )
    }

    private fun SafetyStatusEntity.toState(): SafetyStatusState {
        return SafetyStatusState(
            status = status,
            note = note,
            shareLocationConsent = shareLocationConsent,
            latitude = latitude,
            longitude = longitude,
            accuracyMeters = accuracyMeters,
            source = source,
            capturedAt = capturedAt,
            checkedAtEpochMillis = checkedAtEpochMillis,
            syncStatus = syncStatus,
            pendingError = pendingError,
            lastSyncedAtEpochMillis = lastSyncedAtEpochMillis
        )
    }

    private fun JSONObject.optDoubleOrNull(key: String): Double? {
        if (!has(key) || isNull(key)) return null
        return optDouble(key, Double.NaN).takeIf { it.isFinite() }
    }
}
