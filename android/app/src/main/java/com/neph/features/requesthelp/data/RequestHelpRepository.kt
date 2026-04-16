package com.neph.features.requesthelp.data

import android.content.Context
import android.content.SharedPreferences
import com.neph.core.NephAppContext
import com.neph.core.database.HelpRequestEntity
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.database.SyncOperationEntity
import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
import com.neph.core.sync.LocalOwnerType
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.core.sync.SyncConflictPolicy
import com.neph.core.sync.SyncEntityType
import com.neph.core.sync.SyncOperationStatus
import com.neph.core.sync.SyncOperationType
import com.neph.core.sync.SyncStatus
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.UUID

private const val PendingHelpRequestStatus = "PENDING_SYNC"

data class RequestHelpLocationSubmission(
    val country: String,
    val city: String,
    val district: String,
    val neighborhood: String,
    val extraAddress: String
)

data class RequestHelpContactSubmission(
    val fullName: String,
    val phone: Long,
    val alternativePhone: Long? = null
)

data class RequestHelpSubmission(
    val helpTypes: List<String>,
    val otherHelpText: String,
    val affectedPeopleCount: Int,
    val description: String,
    val riskFlags: List<String>,
    val vulnerableGroups: List<String>,
    val bloodType: String,
    val location: RequestHelpLocationSubmission,
    val contact: RequestHelpContactSubmission,
    val consentGiven: Boolean
)

data class CreateHelpRequestResult(
    val requestId: String,
    val guestAccessToken: String? = null,
    val recordedLocally: Boolean = true
)

data class GuestTrackedHelpRequest(
    val requestId: String,
    val guestAccessToken: String
)

object RequestHelpRepository {
    private const val PrefsName = "neph_guest_help_requests"
    private const val GuestRequestsKey = "guest_requests"

    private lateinit var prefs: SharedPreferences

    private val database get() = NephDatabaseProvider.requireInstance()

    fun initialize(context: Context) {
        if (!::prefs.isInitialized) {
            val appContext = context.applicationContext
            NephAppContext.initialize(appContext)
            NephDatabaseProvider.initialize(appContext)
            prefs = appContext.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
        }
    }

    suspend fun hasActiveHelpRequest(token: String): Boolean {
        ensureInitialized()
        return database.helpRequestDao().countActiveByOwner(ownerTypeForToken(token)) > 0
    }

    suspend fun createHelpRequest(
        token: String?,
        submission: RequestHelpSubmission
    ): CreateHelpRequestResult {
        ensureInitialized()
        val now = System.currentTimeMillis()
        val localId = "local_${UUID.randomUUID()}"
        val ownerType = ownerTypeForToken(token)
        val entity = submission.toEntity(
            localId = localId,
            ownerType = ownerType,
            now = now,
            syncStatus = SyncStatus.PENDING_CREATE
        )

        database.helpRequestDao().upsert(entity)
        database.syncOperationDao().upsert(
            SyncOperationEntity(
                entityType = SyncEntityType.HELP_REQUEST,
                entityId = localId,
                operationType = SyncOperationType.CREATE_HELP_REQUEST,
                payloadJson = submission.toJson().toString(),
                createdAtEpochMillis = now
            )
        )
        OfflineSyncScheduler.enqueueSync(NephAppContext.get(), reason = "help-request-created")

        return CreateHelpRequestResult(requestId = localId, recordedLocally = true)
    }

    fun getGuestTrackedRequests(): List<GuestTrackedHelpRequest> {
        ensureInitialized()

        val raw = prefs.getString(GuestRequestsKey, null) ?: return emptyList()
        val json = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()

        return buildList {
            for (index in 0 until json.length()) {
                val entry = json.optJSONObject(index) ?: continue
                val requestId = entry.optString("requestId").trim()
                val guestAccessToken = entry.optString("guestAccessToken").trim()
                if (requestId.isNotBlank() && guestAccessToken.isNotBlank()) {
                    add(
                        GuestTrackedHelpRequest(
                            requestId = requestId,
                            guestAccessToken = guestAccessToken
                        )
                    )
                }
            }
        }
    }

    suspend fun fetchGuestHelpRequest(
        trackedRequest: GuestTrackedHelpRequest
    ): JSONObject? {
        val encodedToken = URLEncoder.encode(trackedRequest.guestAccessToken, Charsets.UTF_8.name())
        val response = JsonHttpClient.request(
            path = "/help-requests/${trackedRequest.requestId}?guestAccessToken=$encodedToken"
        )

        return response.optJSONObject("request")
    }

    internal suspend fun pushCreateOperation(operation: SyncOperationEntity, token: String?) {
        val entity = database.helpRequestDao().getByLocalId(operation.entityId) ?: run {
            database.syncOperationDao().delete(operation.operationId)
            return
        }

        val response = JsonHttpClient.request(
            path = "/help-requests",
            method = "POST",
            token = token.takeIf { entity.ownerType == LocalOwnerType.AUTHENTICATED && !it.isNullOrBlank() },
            body = JSONObject(operation.payloadJson)
        )

        val remoteRequest = response.optJSONObject("request")
            ?: throw ApiException("Server did not return the created help request.", 200, "INVALID_RESPONSE")
        val guestAccessToken = response.optString("guestAccessToken").takeIf { it.isNotBlank() }
        val remoteId = remoteRequest.optString("id").takeIf { it.isNotBlank() }
            ?: throw ApiException("Server did not return a help request id.", 200, "INVALID_RESPONSE")

        val synced = remoteRequest.toHelpRequestEntity(
            ownerType = entity.ownerType,
            existing = entity,
            guestAccessToken = guestAccessToken ?: entity.guestAccessToken,
            now = System.currentTimeMillis()
        ).copy(
            localId = entity.localId,
            remoteId = remoteId,
            syncStatus = SyncStatus.SYNCED,
            pendingError = null,
            lastSyncedAtEpochMillis = System.currentTimeMillis()
        )

        database.helpRequestDao().upsert(synced)
        if (synced.ownerType == LocalOwnerType.GUEST && guestAccessToken != null) {
            saveGuestTrackedRequest(
                GuestTrackedHelpRequest(
                    requestId = remoteId,
                    guestAccessToken = guestAccessToken
                )
            )
        }
        database.syncOperationDao().delete(operation.operationId)
    }

    internal suspend fun pushStatusOperation(operation: SyncOperationEntity, token: String?) {
        val entity = database.helpRequestDao().getByLocalId(operation.entityId) ?: run {
            database.syncOperationDao().delete(operation.operationId)
            return
        }
        val remoteId = entity.remoteId ?: entity.localId.takeUnless { it.startsWith("local_") }
        if (remoteId.isNullOrBlank()) {
            // Creation has not reached the server yet. Leave the status operation queued behind it.
            return
        }

        val nextStatus = JSONObject(operation.payloadJson).optString("status").ifBlank { entity.status }
        val guestAccessToken = entity.guestAccessToken
        val encodedGuestToken = guestAccessToken?.let { URLEncoder.encode(it, Charsets.UTF_8.name()) }
        val path = if (entity.ownerType == LocalOwnerType.GUEST && encodedGuestToken != null) {
            "/help-requests/$remoteId/status?guestAccessToken=$encodedGuestToken"
        } else {
            "/help-requests/$remoteId/status"
        }

        val response = JsonHttpClient.request(
            path = path,
            method = "PATCH",
            token = token.takeIf { entity.ownerType == LocalOwnerType.AUTHENTICATED && !it.isNullOrBlank() },
            body = JSONObject().put("status", nextStatus)
        )

        val remoteRequest = response.optJSONObject("request")
            ?: throw ApiException("Server did not return the updated help request.", 200, "INVALID_RESPONSE")
        upsertRemoteHelpRequest(
            ownerType = entity.ownerType,
            request = remoteRequest,
            guestAccessToken = entity.guestAccessToken
        )
        database.syncOperationDao().delete(operation.operationId)
    }

    internal suspend fun refreshAuthenticatedHelpRequests(token: String) {
        if (token.isBlank()) return
        val response = JsonHttpClient.request(
            path = "/help-requests",
            token = token
        )

        val requests = response.optJSONArray("requests") ?: JSONArray()
        for (index in 0 until requests.length()) {
            val request = requests.optJSONObject(index) ?: continue
            upsertRemoteHelpRequest(LocalOwnerType.AUTHENTICATED, request, guestAccessToken = null)
        }
    }

    internal suspend fun refreshGuestHelpRequests() {
        for (trackedRequest in getGuestTrackedRequests()) {
            val request = fetchGuestHelpRequest(trackedRequest) ?: continue
            upsertRemoteHelpRequest(
                ownerType = LocalOwnerType.GUEST,
                request = request,
                guestAccessToken = trackedRequest.guestAccessToken
            )
        }
    }

    internal suspend fun upsertRemoteHelpRequest(
        ownerType: String,
        request: JSONObject,
        guestAccessToken: String?
    ) {
        val remoteId = request.optString("id").takeIf { it.isNotBlank() } ?: return
        val existing = database.helpRequestDao().getByRemoteId(remoteId)
        val now = System.currentTimeMillis()

        if (existing != null) {
            val decision = SyncConflictPolicy.decideHelpRequestRemoteMerge(
                localSyncStatus = existing.syncStatus,
                localStatus = existing.status,
                remoteStatus = request.optString("status").ifBlank { existing.status }
            )

            if (!decision.shouldApplyRemote) {
                if (decision.nextSyncStatus == SyncStatus.CONFLICTED) {
                    database.helpRequestDao().upsert(
                        existing.copy(
                            syncStatus = SyncStatus.CONFLICTED,
                            pendingError = decision.reason,
                            updatedAtEpochMillis = now
                        )
                    )
                }
                return
            }
        }

        val mapped = request.toHelpRequestEntity(
            ownerType = ownerType,
            existing = existing,
            guestAccessToken = guestAccessToken ?: existing?.guestAccessToken,
            now = now
        )
        database.helpRequestDao().upsert(mapped)
    }

    internal fun ownerTypeForToken(token: String?): String {
        return if (token.isNullOrBlank()) LocalOwnerType.GUEST else LocalOwnerType.AUTHENTICATED
    }

    private fun saveGuestTrackedRequest(trackedRequest: GuestTrackedHelpRequest) {
        ensureInitialized()

        val existing = getGuestTrackedRequests()
            .filterNot { it.requestId == trackedRequest.requestId }
        val nextRequests = listOf(trackedRequest) + existing
        val payload = JSONArray().apply {
            nextRequests.forEach { request ->
                put(
                    JSONObject().apply {
                        put("requestId", request.requestId)
                        put("guestAccessToken", request.guestAccessToken)
                    }
                )
            }
        }

        prefs.edit()
            .putString(GuestRequestsKey, payload.toString())
            .apply()
    }

    private fun ensureInitialized() {
        check(::prefs.isInitialized) {
            "RequestHelpRepository must be initialized before use."
        }
    }
}

internal fun RequestHelpSubmission.toJson(): JSONObject {
    return JSONObject().apply {
        put("helpTypes", JSONArray(helpTypes))
        put("otherHelpText", otherHelpText)
        put("affectedPeopleCount", affectedPeopleCount)
        put("description", description)
        put("riskFlags", JSONArray(riskFlags))
        put("vulnerableGroups", JSONArray(vulnerableGroups))
        put("bloodType", bloodType)
        put(
            "location",
            JSONObject().apply {
                put("country", location.country)
                put("city", location.city)
                put("district", location.district)
                put("neighborhood", location.neighborhood)
                put("extraAddress", location.extraAddress)
            }
        )
        put(
            "contact",
            JSONObject().apply {
                put("fullName", contact.fullName)
                put("phone", contact.phone)
                contact.alternativePhone?.let { put("alternativePhone", it) }
            }
        )
        put("consentGiven", consentGiven)
    }
}

internal fun RequestHelpSubmission.toEntity(
    localId: String,
    ownerType: String,
    now: Long,
    syncStatus: String
): HelpRequestEntity {
    return HelpRequestEntity(
        localId = localId,
        remoteId = null,
        ownerType = ownerType,
        guestAccessToken = null,
        helpTypesJson = JSONArray(helpTypes).toString(),
        otherHelpText = otherHelpText,
        affectedPeopleCount = affectedPeopleCount,
        riskFlagsJson = JSONArray(riskFlags).toString(),
        vulnerableGroupsJson = JSONArray(vulnerableGroups).toString(),
        description = description,
        bloodType = bloodType,
        country = location.country,
        city = location.city,
        district = location.district,
        neighborhood = location.neighborhood,
        extraAddress = location.extraAddress,
        contactFullName = contact.fullName,
        contactPhone = contact.phone.toString(),
        contactAlternativePhone = contact.alternativePhone?.toString(),
        status = PendingHelpRequestStatus,
        helperFirstName = null,
        helperLastName = null,
        helperPhone = null,
        helperProfession = null,
        helperExpertise = null,
        syncStatus = syncStatus,
        pendingError = null,
        createdAtEpochMillis = now,
        updatedAtEpochMillis = now,
        lastSyncedAtEpochMillis = null,
        serverCreatedAt = null,
        isDeleted = false
    )
}

internal fun JSONObject.toHelpRequestEntity(
    ownerType: String,
    existing: HelpRequestEntity?,
    guestAccessToken: String?,
    now: Long
): HelpRequestEntity {
    val remoteId = optString("id").takeIf { it.isNotBlank() }
    val location = optJSONObject("location") ?: JSONObject()
    val contact = optJSONObject("contact") ?: JSONObject()
    val helper = optJSONObject("helper")

    return HelpRequestEntity(
        localId = existing?.localId ?: remoteId ?: "remote_${UUID.randomUUID()}",
        remoteId = remoteId,
        ownerType = ownerType,
        guestAccessToken = guestAccessToken,
        helpTypesJson = optJSONArray("helpTypes").orEmptyJsonArrayString(),
        otherHelpText = optString("otherHelpText"),
        affectedPeopleCount = optInt("affectedPeopleCount", 1),
        riskFlagsJson = optJSONArray("riskFlags").orEmptyJsonArrayString(),
        vulnerableGroupsJson = optJSONArray("vulnerableGroups").orEmptyJsonArrayString(),
        description = optString("description"),
        bloodType = optString("bloodType"),
        country = location.optString("country"),
        city = location.optString("city"),
        district = location.optString("district"),
        neighborhood = location.optString("neighborhood"),
        extraAddress = location.optString("extraAddress"),
        contactFullName = contact.optString("fullName"),
        contactPhone = contact.opt("phone")?.toString().orEmpty(),
        contactAlternativePhone = contact.opt("alternativePhone")?.toString()?.takeIf { it.isNotBlank() && it != "null" },
        status = optString("status").ifBlank { existing?.status ?: "SYNCED" },
        helperFirstName = helper?.optString("firstName")?.takeIf { it.isNotBlank() },
        helperLastName = helper?.optString("lastName")?.takeIf { it.isNotBlank() },
        helperPhone = helper?.opt("phone")?.toString()?.takeIf { it.isNotBlank() && it != "null" },
        helperProfession = helper?.optString("profession")?.takeIf { it.isNotBlank() },
        helperExpertise = helper?.optString("expertise")?.takeIf { it.isNotBlank() },
        syncStatus = SyncStatus.SYNCED,
        pendingError = null,
        createdAtEpochMillis = existing?.createdAtEpochMillis ?: now,
        updatedAtEpochMillis = now,
        lastSyncedAtEpochMillis = now,
        serverCreatedAt = optString("createdAt").takeIf { it.isNotBlank() } ?: existing?.serverCreatedAt,
        isDeleted = false
    )
}

internal fun JSONArray?.orEmptyJsonArrayString(): String = (this ?: JSONArray()).toString()

internal fun String.jsonArrayToStringList(): List<String> {
    val json = runCatching { JSONArray(this) }.getOrNull() ?: return emptyList()
    return buildList {
        for (index in 0 until json.length()) {
            val value = json.optString(index).trim()
            if (value.isNotBlank()) add(value)
        }
    }
}
