package com.neph.features.requesthelp.data

import android.content.Context
import android.content.SharedPreferences
import com.neph.BuildConfig
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
import com.neph.features.profile.data.CurrentDeviceLocation
import com.neph.features.profile.data.ProfileData
import com.neph.features.profile.data.normalizePhoneParts
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.flow.Flow
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.util.UUID

internal data class AssignedResponderSnapshot(
    val firstName: String?,
    val lastName: String?,
    val phone: String?,
    val profession: String?,
    val expertise: String?
)

private const val PendingHelpRequestStatus = "PENDING_SYNC"
private const val ReverseGeocodeTimeoutMillis = 7000L
private const val RequestHelpGpsCoordinateSource = "gps"

data class RequestHelpLocationSubmission(
    val country: String,
    val city: String,
    val district: String,
    val neighborhood: String,
    val extraAddress: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val coordinateSource: String? = null,
    val coordinateCapturedAt: String? = null,
    val coordinateAccuracyMeters: Double? = null
)

data class RequestHelpReverseLocation(
    val countryCode: String? = null,
    val country: String? = null,
    val city: String? = null,
    val district: String? = null,
    val neighborhood: String? = null,
    val extraAddress: String? = null,
    val displayName: String? = null
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
    val shareProfileHealthInfoWithVolunteer: Boolean,
    val location: RequestHelpLocationSubmission,
    val contact: RequestHelpContactSubmission,
    val consentGiven: Boolean
)

data class RequestHelpCoordinateSnapshot(
    val latitude: Double,
    val longitude: Double,
    val coordinateSource: String,
    val coordinateCapturedAt: String,
    val coordinateAccuracyMeters: Double?
)

data class CreateHelpRequestResult(
    val requestId: String,
    val guestAccessToken: String? = null,
    val recordedLocally: Boolean = true
)

data class MarkSafeHelpRequestCancellationResult(
    val confirmedCount: Int = 0,
    val pendingCount: Int = 0,
    val failedCount: Int = 0
) {
    val canMarkSafe: Boolean
        get() = pendingCount == 0 && failedCount == 0
}

data class GuestTrackedHelpRequest(
    val requestId: String,
    val guestAccessToken: String
)

class EmergencyDraftRequirementsException(
    message: String
) : IllegalStateException(message)

object RequestHelpRepository {
    private const val PrefsName = "neph_guest_help_requests"
    private const val GuestRequestsKey = "guest_requests"
    private const val GuestHasLocalRequestsKey = "guest_has_local_requests"
    internal const val DeferredStatusSyncMessage =
        "Waiting for the help request creation to sync before sending the status update."

    private lateinit var prefs: SharedPreferences
    private var pendingCoordinateSnapshot: RequestHelpCoordinateSnapshot? = null

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

        if (token.isNotBlank()) {
            try {
                refreshAuthenticatedHelpRequests(token)
            } catch (error: ApiException) {
                if (error.status == 401) {
                    throw error
                }
            } catch (_: Exception) {
                // Fall back to the last local snapshot when the network is unavailable.
            }
        }

        return database.helpRequestDao().countActiveByOwner(ownerTypeForToken(token)) > 0
    }

    suspend fun cancelActiveAuthenticatedHelpRequestsForMarkSafe(
        token: String
    ): MarkSafeHelpRequestCancellationResult {
        ensureInitialized()
        if (token.isBlank()) return MarkSafeHelpRequestCancellationResult()

        try {
            refreshAuthenticatedHelpRequests(token)
        } catch (error: ApiException) {
            if (error.status == 401) {
                throw error
            }
        } catch (_: Exception) {
            // Fall back to local active requests so marking safe can still proceed offline.
        }

        val activeRequests = database.helpRequestDao()
            .getByOwner(LocalOwnerType.AUTHENTICATED)
            .filter { it.isActiveHelpRequestForStatusUpdate() }

        if (activeRequests.isEmpty()) return MarkSafeHelpRequestCancellationResult()

        var confirmedCount = 0
        var pendingCount = 0
        var failedCount = 0
        activeRequests.forEach { request ->
            val remoteId = resolveRemoteRequestIdForSync(request)
            if (remoteId.isNullOrBlank()) {
                pendingCount += 1
                return@forEach
            }

            val response = JsonHttpClient.request(
                path = "/help-requests/$remoteId/status",
                method = "PATCH",
                token = token,
                body = JSONObject().put("status", "CANCELLED")
            )
            val remoteRequest = response.optJSONObject("request")
            if (remoteRequest?.optString("status")?.trim()?.uppercase(Locale.ROOT) == "CANCELLED") {
                upsertRemoteHelpRequest(
                    ownerType = LocalOwnerType.AUTHENTICATED,
                    request = remoteRequest,
                    guestAccessToken = null
                )
                confirmedCount += 1
            } else {
                failedCount += 1
            }
        }
        return MarkSafeHelpRequestCancellationResult(
            confirmedCount = confirmedCount,
            pendingCount = pendingCount,
            failedCount = failedCount
        )
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
        if (ownerType == LocalOwnerType.GUEST) {
            prefs.edit().putBoolean(GuestHasLocalRequestsKey, true).apply()
        }
        OfflineSyncScheduler.enqueueSync(NephAppContext.get(), reason = "help-request-created")

        return CreateHelpRequestResult(requestId = localId, recordedLocally = true)
    }

    suspend fun createEmergencyDraft(
        token: String?,
        profile: ProfileData,
        currentLocation: CurrentDeviceLocation?,
        reverseLocation: RequestHelpReverseLocation?
    ): CreateHelpRequestResult {
        val submission = buildEmergencyDraftSubmission(profile, currentLocation, reverseLocation)
        return createHelpRequest(token = token, submission = submission)
    }

    fun storePendingCoordinateSnapshot(currentLocation: CurrentDeviceLocation) {
        pendingCoordinateSnapshot = currentLocation.toRequestHelpCoordinateSnapshot()
    }

    fun consumePendingCoordinateSnapshot(): RequestHelpCoordinateSnapshot? {
        return pendingCoordinateSnapshot.also {
            pendingCoordinateSnapshot = null
        }
    }

    suspend fun getLocalHelpRequest(localId: String): HelpRequestEntity? {
        ensureInitialized()
        return database.helpRequestDao().getByLocalId(localId)
    }

    fun observeLocalHelpRequest(localId: String): Flow<HelpRequestEntity?> {
        ensureInitialized()
        return database.helpRequestDao().observeByLocalId(localId)
    }

    suspend fun updateHelpRequest(
        token: String?,
        localId: String,
        submission: RequestHelpSubmission,
        preserveExistingCoordinates: Boolean = true
    ): CreateHelpRequestResult {
        ensureInitialized()

        val now = System.currentTimeMillis()
        val existing = database.helpRequestDao().getByLocalId(localId)
            ?: return createHelpRequest(token = token, submission = submission)
        val ownerType = ownerTypeForToken(token)
        val submissionWithPreservedLocation = submission.withPreservedCoordinates(
            existing = existing,
            preserveExistingCoordinates = preserveExistingCoordinates
        )
        val updatedEntity = submissionWithPreservedLocation.toEntity(
            localId = existing.localId,
            ownerType = existing.ownerType,
            now = now,
            syncStatus = if (existing.remoteId.isNullOrBlank()) SyncStatus.PENDING_CREATE else SyncStatus.PENDING_UPDATE
        ).copy(
            remoteId = existing.remoteId,
            ownerType = existing.ownerType.ifBlank { ownerType },
            guestAccessToken = existing.guestAccessToken,
            createdAtEpochMillis = existing.createdAtEpochMillis,
            serverCreatedAt = existing.serverCreatedAt,
            lastSyncedAtEpochMillis = existing.lastSyncedAtEpochMillis,
            status = existing.status.takeUnless { it == PendingHelpRequestStatus } ?: PendingHelpRequestStatus
        )

        database.helpRequestDao().upsert(updatedEntity)
        val pendingCreate = database.syncOperationDao().getLatestPendingOperation(
            entityType = SyncEntityType.HELP_REQUEST,
            entityId = existing.localId,
            operationType = SyncOperationType.CREATE_HELP_REQUEST
        )

        if (pendingCreate != null) {
            database.syncOperationDao().upsert(
                pendingCreate.copy(
                    payloadJson = submissionWithPreservedLocation.toJson().toString(),
                    status = SyncOperationStatus.PENDING,
                    error = null
                )
            )
        } else {
            val pendingUpdate = database.syncOperationDao().getLatestPendingOperation(
                entityType = SyncEntityType.HELP_REQUEST,
                entityId = existing.localId,
                operationType = SyncOperationType.UPDATE_HELP_REQUEST
            )
            database.syncOperationDao().upsert(
                pendingUpdate?.copy(
                    payloadJson = submissionWithPreservedLocation.toJson().toString(),
                    status = SyncOperationStatus.PENDING,
                    error = null
                ) ?: SyncOperationEntity(
                        entityType = SyncEntityType.HELP_REQUEST,
                        entityId = existing.localId,
                        operationType = SyncOperationType.UPDATE_HELP_REQUEST,
                        payloadJson = submissionWithPreservedLocation.toJson().toString(),
                        createdAtEpochMillis = now
                    )
            )
        }

        OfflineSyncScheduler.enqueueSync(NephAppContext.get(), reason = "help-request-updated")
        return CreateHelpRequestResult(requestId = existing.localId, recordedLocally = true)
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

    fun shouldOpenGuestRequestsOnStart(): Boolean {
        ensureInitialized()
        return prefs.getBoolean(GuestHasLocalRequestsKey, false) || getGuestTrackedRequests().isNotEmpty()
    }

    fun resetForTesting() {
        requireDebugBuildForTestingReset()

        pendingCoordinateSnapshot = null
        if (::prefs.isInitialized) {
            prefs.edit().clear().commit()
        }
    }

    suspend fun clearAuthenticatedLocalCache() {
        NephAppContext.getOrNull()?.let(::initialize)
        pendingCoordinateSnapshot = null

        database.syncOperationDao().deleteHelpRequestOperationsForOwner(
            entityType = SyncEntityType.HELP_REQUEST,
            ownerType = LocalOwnerType.AUTHENTICATED
        )
        database.helpRequestDao().deleteByOwner(LocalOwnerType.AUTHENTICATED)
    }

    private fun requireDebugBuildForTestingReset() {
        check(BuildConfig.DEBUG) {
            "RequestHelpRepository.resetForTesting() is only available in debug/e2e test builds."
        }
    }

    suspend fun fetchGuestHelpRequest(
        trackedRequest: GuestTrackedHelpRequest
    ): JSONObject? {
        val response = JsonHttpClient.request(
            path = "/help-requests/${trackedRequest.requestId}",
            headers = guestAccessHeaders(trackedRequest.guestAccessToken)
        )

        return response.optJSONObject("request")
    }

    suspend fun reverseGeocodeCurrentLocation(
        latitude: Double,
        longitude: Double
    ): RequestHelpReverseLocation? {
        ensureInitialized()

        val response = withTimeoutOrNull(ReverseGeocodeTimeoutMillis) {
            JsonHttpClient.request(
                path = String.format(
                    Locale.US,
                    "/location/reverse?lat=%.6f&lon=%.6f",
                    latitude,
                    longitude
                )
            )
        } ?: return null

        val item = response.optJSONObject("item") ?: return null
        val administrative = item.optJSONObject("administrative") ?: JSONObject()

        return RequestHelpReverseLocation(
            countryCode = administrative.optTrimmedString("countryCode"),
            country = administrative.optTrimmedString("country"),
            city = administrative.optTrimmedString("city"),
            district = administrative.optTrimmedString("district"),
            neighborhood = administrative.optTrimmedString("neighborhood"),
            extraAddress = administrative.optTrimmedString("extraAddress"),
            displayName = item.optTrimmedString("displayName")
        )
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

    internal suspend fun pushUpdateOperation(operation: SyncOperationEntity, token: String?) {
        val entity = database.helpRequestDao().getByLocalId(operation.entityId) ?: run {
            database.syncOperationDao().delete(operation.operationId)
            return
        }
        val remoteId = resolveRemoteRequestIdForSync(entity)
        if (remoteId.isNullOrBlank()) {
            database.syncOperationDao().updateStatus(
                operationId = operation.operationId,
                status = SyncOperationStatus.PENDING,
                attemptCount = operation.attemptCount,
                lastAttemptAtEpochMillis = operation.lastAttemptAtEpochMillis,
                error = DeferredStatusSyncMessage
            )
            return
        }

        val guestAccessToken = entity.guestAccessToken

        val response = JsonHttpClient.request(
            path = "/help-requests/$remoteId",
            method = "PATCH",
            token = token.takeIf { entity.ownerType == LocalOwnerType.AUTHENTICATED && !it.isNullOrBlank() },
            body = JSONObject(operation.payloadJson),
            headers = guestAccessHeaders(guestAccessToken).takeIf { entity.ownerType == LocalOwnerType.GUEST } ?: emptyMap()
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

    internal suspend fun pushStatusOperation(operation: SyncOperationEntity, token: String?) {
        val entity = database.helpRequestDao().getByLocalId(operation.entityId) ?: run {
            database.syncOperationDao().delete(operation.operationId)
            return
        }
        val remoteId = resolveRemoteRequestIdForSync(entity)
        if (remoteId.isNullOrBlank()) {
            database.syncOperationDao().updateStatus(
                operationId = operation.operationId,
                status = SyncOperationStatus.PENDING,
                attemptCount = operation.attemptCount,
                lastAttemptAtEpochMillis = operation.lastAttemptAtEpochMillis,
                error = DeferredStatusSyncMessage
            )
            return
        }

        val nextStatus = JSONObject(operation.payloadJson).optString("status").ifBlank { entity.status }
        val guestAccessToken = entity.guestAccessToken

        val response = JsonHttpClient.request(
            path = "/help-requests/$remoteId/status",
            method = "PATCH",
            token = token.takeIf { entity.ownerType == LocalOwnerType.AUTHENTICATED && !it.isNullOrBlank() },
            body = JSONObject().put("status", nextStatus),
            headers = guestAccessHeaders(guestAccessToken).takeIf { entity.ownerType == LocalOwnerType.GUEST } ?: emptyMap()
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

    internal fun resolveRemoteRequestIdForSync(entity: HelpRequestEntity): String? {
        return entity.remoteId ?: entity.localId.takeUnless { it.startsWith("local_") }
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

    private fun guestAccessHeaders(guestAccessToken: String?): Map<String, String> {
        return guestAccessToken
            ?.takeIf { it.isNotBlank() }
            ?.let { mapOf("x-help-request-access-token" to it) }
            ?: emptyMap()
    }

    private fun HelpRequestEntity.isActiveHelpRequestForStatusUpdate(): Boolean {
        return status.trim().uppercase(Locale.ROOT) !in setOf("RESOLVED", "CANCELLED") &&
            syncStatus != SyncStatus.CONFLICTED &&
            !isDeleted
    }
}

private fun JSONObject.optTrimmedString(key: String): String? {
    return optString(key).trim().takeIf { it.isNotBlank() }
}

private fun String.isUsefulBackendValue(): Boolean {
    val value = trim()
    return value.isNotBlank() && value != "null"
}

internal fun RequestHelpSubmission.toJson(): JSONObject {
    return JSONObject().apply {
        put("helpTypes", JSONArray(helpTypes))
        put("otherHelpText", otherHelpText)
        put("affectedPeopleCount", affectedPeopleCount)
        put("description", description)
        put("riskFlags", JSONArray(riskFlags))
        put("vulnerableGroups", JSONArray(vulnerableGroups))
        put("shareProfileHealthInfoWithVolunteer", shareProfileHealthInfoWithVolunteer)
        put(
            "location",
            JSONObject().apply {
                put("country", location.country)
                put("city", location.city)
                put("district", location.district)
                put("neighborhood", location.neighborhood)
                put("extraAddress", location.extraAddress)
                if (location.latitude != null && location.longitude != null) {
                    put("latitude", location.latitude)
                    put("longitude", location.longitude)
                    put(
                        "coordinate",
                        JSONObject().apply {
                            put("latitude", location.latitude)
                            put("longitude", location.longitude)
                            location.coordinateAccuracyMeters?.let { put("accuracyMeters", it) }
                            location.coordinateSource?.let { put("source", it) }
                            location.coordinateCapturedAt?.let { put("capturedAt", it) }
                        }
                    )
                }
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

internal fun buildEmergencyDraftSubmission(
    profile: ProfileData,
    currentLocation: CurrentDeviceLocation?,
    reverseLocation: RequestHelpReverseLocation?
): RequestHelpSubmission {
    val phoneParts = normalizePhoneParts(profile.phone)
    val primaryPhone = phoneParts.phone
        .takeIf { phoneParts.countryCode == "+90" }
        ?.toLongOrNull()
        ?.takeIf { it in 5000000000L..5999999999L }
        ?: throw EmergencyDraftRequirementsException(
            "A valid Turkish mobile phone number is required before creating a quick emergency draft."
        )
    val contactName = profile.fullName?.trim()?.takeIf { it.isNotBlank() }
        ?: listOfNotNull(profile.firstName, profile.lastName)
            .joinToString(" ") { it.trim() }
            .trim()
            .takeIf { it.isNotBlank() }
        ?: throw EmergencyDraftRequirementsException(
            "A real contact name is required before creating a quick emergency draft."
        )
    val latitude = currentLocation?.latitude
    val longitude = currentLocation?.longitude
    val coordinateSource = currentLocation?.let { RequestHelpGpsCoordinateSource }
    val coordinateCapturedAt = currentLocation?.capturedAt
    val country = reverseLocation?.country?.trim()?.takeIf { it.isNotBlank() }
    val city = reverseLocation?.city?.trim()?.takeIf { it.isNotBlank() }
    val district = reverseLocation?.district?.trim()?.takeIf { it.isNotBlank() }
    val neighborhood = reverseLocation?.neighborhood?.trim()?.takeIf { it.isNotBlank() }

    if (
        latitude == null ||
        longitude == null ||
        country == null ||
        city == null ||
        district == null ||
        neighborhood == null
    ) {
        throw EmergencyDraftRequirementsException(
            "A real emergency location is required before creating a quick emergency draft."
        )
    }

    val extraAddress = reverseLocation.extraAddress?.trim()?.takeIf { it.isNotBlank() } ?: ""

    return RequestHelpSubmission(
        helpTypes = listOf("search_rescue"),
        otherHelpText = "",
        affectedPeopleCount = 1,
        description = "Emergency assistance requested from mobile app. Details pending.",
        riskFlags = emptyList(),
        vulnerableGroups = emptyList(),
        shareProfileHealthInfoWithVolunteer = false,
        location = RequestHelpLocationSubmission(
            country = country,
            city = city,
            district = district,
            neighborhood = neighborhood,
            extraAddress = extraAddress,
            latitude = latitude,
            longitude = longitude,
            coordinateSource = coordinateSource,
            coordinateCapturedAt = coordinateCapturedAt,
            coordinateAccuracyMeters = currentLocation.accuracyMeters
        ),
        contact = RequestHelpContactSubmission(
            fullName = contactName,
            phone = primaryPhone,
            alternativePhone = null
        ),
        consentGiven = true
    )
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
        bloodType = "",
        shareProfileHealthInfoWithVolunteer = shareProfileHealthInfoWithVolunteer,
        country = location.country,
        city = location.city,
        district = location.district,
        neighborhood = location.neighborhood,
        extraAddress = location.extraAddress,
        latitude = location.latitude,
        longitude = location.longitude,
        coordinateSource = location.coordinateSource,
        coordinateCapturedAt = location.coordinateCapturedAt,
        coordinateAccuracyMeters = location.coordinateAccuracyMeters,
        contactFullName = contact.fullName,
        contactPhone = contact.phone.toString(),
        contactAlternativePhone = contact.alternativePhone?.toString(),
        status = PendingHelpRequestStatus,
        urgencyLevel = null,
        priorityLevel = null,
        resolvedAt = null,
        cancelledAt = null,
        helperFirstName = null,
        helperLastName = null,
        helperPhone = null,
        helperProfession = null,
        helperExpertise = null,
        helpersJson = JSONArray().toString(),
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
    val helpers = optJSONArray("helpers")
        ?.toAssignedResponderSnapshots()
        ?.takeIf { it.isNotEmpty() }
        ?: optJSONObject("helper")
            ?.toAssignedResponderSnapshot()
            ?.let(::listOf)
        ?: emptyList()
    val primaryHelper = helpers.firstOrNull()

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
        shareProfileHealthInfoWithVolunteer = optBoolean("shareProfileHealthInfoWithVolunteer", false),
        country = location.optString("country"),
        city = location.optString("city"),
        district = location.optString("district"),
        neighborhood = location.optString("neighborhood"),
        extraAddress = location.optString("extraAddress"),
        latitude = readLocationLatitude(location, existing),
        longitude = readLocationLongitude(location, existing),
        coordinateSource = readLocationCoordinateSource(location, existing),
        coordinateCapturedAt = readLocationCoordinateCapturedAt(location, existing),
        coordinateAccuracyMeters = readLocationCoordinateAccuracyMeters(location, existing),
        contactFullName = contact.optString("fullName"),
        contactPhone = contact.opt("phone")?.toString().orEmpty(),
        contactAlternativePhone = contact.opt("alternativePhone")?.toString()?.takeIf { it.isNotBlank() && it != "null" },
        status = optString("status").ifBlank { existing?.status ?: "SYNCED" },
        urgencyLevel = optString("urgencyLevel").takeIf { it.isNotBlank() } ?: existing?.urgencyLevel,
        priorityLevel = optString("priorityLevel").takeIf { it.isNotBlank() } ?: existing?.priorityLevel,
        resolvedAt = optString("resolvedAt").takeIf { it.isUsefulBackendValue() } ?: existing?.resolvedAt,
        cancelledAt = optString("cancelledAt").takeIf { it.isUsefulBackendValue() } ?: existing?.cancelledAt,
        helperFirstName = primaryHelper?.firstName,
        helperLastName = primaryHelper?.lastName,
        helperPhone = primaryHelper?.phone,
        helperProfession = primaryHelper?.profession,
        helperExpertise = primaryHelper?.expertise,
        helpersJson = helpers.toJsonArrayString(),
        syncStatus = SyncStatus.SYNCED,
        pendingError = null,
        createdAtEpochMillis = existing?.createdAtEpochMillis ?: now,
        updatedAtEpochMillis = now,
        lastSyncedAtEpochMillis = now,
        serverCreatedAt = optString("createdAt").takeIf { it.isNotBlank() } ?: existing?.serverCreatedAt,
        isDeleted = false
    )
}

internal fun RequestHelpSubmission.withPreservedCoordinates(
    existing: HelpRequestEntity,
    preserveExistingCoordinates: Boolean = true
): RequestHelpSubmission {
    if (!preserveExistingCoordinates) {
        return this
    }

    if (location.latitude != null && location.longitude != null) {
        return this
    }

    if (existing.latitude == null || existing.longitude == null) {
        return this
    }

    return copy(
        location = location.copy(
            latitude = existing.latitude,
            longitude = existing.longitude,
            coordinateSource = existing.coordinateSource,
            coordinateCapturedAt = existing.coordinateCapturedAt,
            coordinateAccuracyMeters = existing.coordinateAccuracyMeters
        )
    )
}

private fun readLocationLatitude(location: JSONObject, existing: HelpRequestEntity?): Double? {
    return location.optNullableDouble("latitude")
        ?: location.optJSONObject("coordinate")?.optNullableDouble("latitude")
        ?: existing?.latitude
}

private fun readLocationLongitude(location: JSONObject, existing: HelpRequestEntity?): Double? {
    return location.optNullableDouble("longitude")
        ?: location.optJSONObject("coordinate")?.optNullableDouble("longitude")
        ?: existing?.longitude
}

private fun readLocationCoordinateSource(location: JSONObject, existing: HelpRequestEntity?): String? {
    return location.optJSONObject("coordinate")?.optString("source")?.takeIf { it.isNotBlank() }
        ?: existing?.coordinateSource
}

private fun readLocationCoordinateCapturedAt(location: JSONObject, existing: HelpRequestEntity?): String? {
    return location.optJSONObject("coordinate")?.optString("capturedAt")?.takeIf { it.isNotBlank() }
        ?: existing?.coordinateCapturedAt
}

private fun readLocationCoordinateAccuracyMeters(location: JSONObject, existing: HelpRequestEntity?): Double? {
    return location.optJSONObject("coordinate")?.optNullableDouble("accuracyMeters")
        ?: existing?.coordinateAccuracyMeters
}

private fun CurrentDeviceLocation.toRequestHelpCoordinateSnapshot(): RequestHelpCoordinateSnapshot {
    return RequestHelpCoordinateSnapshot(
        latitude = latitude,
        longitude = longitude,
        coordinateSource = RequestHelpGpsCoordinateSource,
        coordinateCapturedAt = capturedAt,
        coordinateAccuracyMeters = accuracyMeters
    )
}

private fun JSONObject.optNullableDouble(key: String): Double? {
    if (!has(key) || isNull(key)) {
        return null
    }

    return optDouble(key).takeIf { !it.isNaN() }
}

internal fun JSONArray?.orEmptyJsonArrayString(): String = (this ?: JSONArray()).toString()

internal fun JSONArray.toAssignedResponderSnapshots(): List<AssignedResponderSnapshot> {
    return buildList {
        for (index in 0 until length()) {
            optJSONObject(index)
                ?.toAssignedResponderSnapshot()
                ?.let(::add)
        }
    }
}

internal fun JSONObject.toAssignedResponderSnapshot(): AssignedResponderSnapshot {
    return AssignedResponderSnapshot(
        firstName = optString("firstName").trim().takeIf { it.isNotBlank() },
        lastName = optString("lastName").trim().takeIf { it.isNotBlank() },
        phone = opt("phone")?.toString()?.takeIf { it.isNotBlank() && it != "null" },
        profession = optString("profession").trim().takeIf { it.isNotBlank() },
        expertise = optString("expertise").trim().takeIf { it.isNotBlank() }
    )
}

internal fun List<AssignedResponderSnapshot>.toJsonArrayString(): String {
    return JSONArray().apply {
        this@toJsonArrayString.forEach { helper ->
            put(
                JSONObject().apply {
                    put("firstName", helper.firstName)
                    put("lastName", helper.lastName)
                    put("phone", helper.phone)
                    put("profession", helper.profession)
                    put("expertise", helper.expertise)
                }
            )
        }
    }.toString()
}

internal fun String.jsonArrayToStringList(): List<String> {
    val json = runCatching { JSONArray(this) }.getOrNull() ?: return emptyList()
    return buildList {
        for (index in 0 until json.length()) {
            val value = json.optString(index).trim()
            if (value.isNotBlank()) add(value)
        }
    }
}
