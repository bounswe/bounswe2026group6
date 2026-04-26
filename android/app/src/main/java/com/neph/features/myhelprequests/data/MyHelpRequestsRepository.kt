package com.neph.features.myhelprequests.data

import com.neph.core.NephAppContext
import com.neph.core.database.HelpRequestEntity
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.database.SyncOperationEntity
import com.neph.core.network.JsonHttpClient
import com.neph.core.sync.LocalOwnerType
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.core.sync.SyncEntityType
import com.neph.core.sync.SyncOperationType
import com.neph.core.sync.SyncStatus
import com.neph.features.requesthelp.data.buildDurationLabel
import com.neph.features.requesthelp.data.formatLifecycleTimestamp
import com.neph.features.requesthelp.data.formatOperationalLevel
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.features.requesthelp.data.jsonArrayToStringList
import com.neph.features.requesthelp.data.toHelpRequestEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject

data class MyHelpRequestUiModel(
    val id: String,
    val guestAccessToken: String? = null,
    val helpTypes: List<String>,
    val helpTypeSummary: String,
    val description: String,
    val shortDescription: String,
    val locationLabel: String,
    val status: String,
    val statusLabel: String,
    val isActive: Boolean,
    val contactName: String?,
    val contactPhone: String?,
    val alternativePhone: String?,
    val responders: List<AssignedResponderUiModel>,
    val helperFirstName: String?,
    val helperLastName: String?,
    val helperPhone: String?,
    val helperProfession: String?,
    val helperExpertise: String?,
    val helperFullName: String?,
    val createdAt: String?,
    val urgencyLabel: String?,
    val priorityLabel: String?,
    val closedAtLabel: String?,
    val closedStateLabel: String?,
    val openDurationLabel: String?,
    val syncStatus: String = SyncStatus.SYNCED,
    val pendingError: String? = null,
    val lastSyncedAt: String? = null
) {
    val isPendingSync: Boolean
        get() = syncStatus == SyncStatus.PENDING_CREATE || syncStatus == SyncStatus.PENDING_UPDATE

    val isFailedSync: Boolean
        get() = syncStatus == SyncStatus.FAILED || syncStatus == SyncStatus.CONFLICTED
}

data class MyHelpRequestsOverviewUiModel(
    val totalRequests: Int,
    val activeRequests: List<MyHelpRequestUiModel>,
    val historyRequests: List<MyHelpRequestUiModel>,
    val resolvedCount: Int,
    val cancelledCount: Int,
    val assignedResponderCount: Int
) {
    val activeCount: Int
        get() = activeRequests.size

    val historyCount: Int
        get() = historyRequests.size

    val hasMultipleRequestContext: Boolean
        get() = totalRequests > 1 || historyCount > 0
}

data class AssignedResponderUiModel(
    val firstName: String?,
    val lastName: String?,
    val phone: String?,
    val profession: String?,
    val expertise: String?
) {
    val fullName: String?
        get() = listOfNotNull(firstName, lastName).joinToString(" ").trim().takeIf { it.isNotBlank() }

    val hasVisibleDetails: Boolean
        get() = fullName != null || phone != null || profession != null || expertise != null
}

object MyHelpRequestsRepository {
    private val database get() = NephDatabaseProvider.requireInstance()

    fun observeHelpRequests(isAuthenticated: Boolean): Flow<List<MyHelpRequestUiModel>> {
        val ownerType = if (isAuthenticated) LocalOwnerType.AUTHENTICATED else LocalOwnerType.GUEST
        return database.helpRequestDao()
            .observeByOwner(ownerType)
            .map { entities -> entities.distinctBy { it.remoteId ?: it.localId }.map { it.toUiModel() } }
    }

    suspend fun fetchMyHelpRequests(token: String): List<MyHelpRequestUiModel> {
        RequestHelpRepository.refreshAuthenticatedHelpRequests(token)
        return database.helpRequestDao()
            .getByOwner(LocalOwnerType.AUTHENTICATED)
            .map { it.toUiModel() }
            .distinctBy { it.id }
    }

    suspend fun fetchGuestHelpRequests(): List<MyHelpRequestUiModel> {
        RequestHelpRepository.refreshGuestHelpRequests()
        return database.helpRequestDao()
            .getByOwner(LocalOwnerType.GUEST)
            .map { it.toUiModel() }
            .distinctBy { it.id }
    }

    suspend fun markRequestAsResolved(token: String, requestId: String): MyHelpRequestUiModel? {
        return markLocalRequestStatus(
            requestId = requestId,
            ownerType = LocalOwnerType.AUTHENTICATED,
            nextStatus = "RESOLVED"
        )
    }

    suspend fun markGuestRequestAsResolved(
        requestId: String,
        guestAccessToken: String
    ): MyHelpRequestUiModel? {
        return markLocalRequestStatus(
            requestId = requestId,
            ownerType = LocalOwnerType.GUEST,
            nextStatus = "RESOLVED",
            guestAccessToken = guestAccessToken
        )
    }

    internal suspend fun upsertRemoteHelpRequest(
        ownerType: String,
        request: JSONObject,
        guestAccessToken: String?
    ) {
        val remoteId = request.optString("id").takeIf { it.isNotBlank() } ?: return
        val existing = database.helpRequestDao().getByRemoteId(remoteId)
        database.helpRequestDao().upsert(
            request.toHelpRequestEntity(
                ownerType = ownerType,
                existing = existing,
                guestAccessToken = guestAccessToken ?: existing?.guestAccessToken,
                now = System.currentTimeMillis()
            )
        )
    }

    private suspend fun markLocalRequestStatus(
        requestId: String,
        ownerType: String,
        nextStatus: String,
        guestAccessToken: String? = null
    ): MyHelpRequestUiModel? {
        val now = System.currentTimeMillis()
        val entity = database.helpRequestDao().getByLocalId(requestId)
            ?: database.helpRequestDao().getByRemoteId(requestId)
            ?: return null

        val nextEntity = entity.copy(
            status = nextStatus,
            guestAccessToken = guestAccessToken ?: entity.guestAccessToken,
            syncStatus = if (entity.syncStatus == SyncStatus.PENDING_CREATE) {
                SyncStatus.PENDING_CREATE
            } else {
                SyncStatus.PENDING_UPDATE
            },
            pendingError = null,
            updatedAtEpochMillis = now
        )
        database.helpRequestDao().upsert(nextEntity)
        database.syncOperationDao().upsert(
            SyncOperationEntity(
                entityType = SyncEntityType.HELP_REQUEST,
                entityId = entity.localId,
                operationType = SyncOperationType.UPDATE_HELP_REQUEST_STATUS,
                payloadJson = JSONObject().put("status", nextStatus).toString(),
                createdAtEpochMillis = now
            )
        )
        OfflineSyncScheduler.enqueueSync(NephAppContext.get(), reason = "help-request-status")
        return nextEntity.toUiModel().takeIf { nextEntity.ownerType == ownerType }
    }

    internal fun mapRequest(
        request: JSONObject,
        guestAccessToken: String? = null
    ): MyHelpRequestUiModel {
        return request.toHelpRequestEntity(
            ownerType = if (guestAccessToken == null) LocalOwnerType.AUTHENTICATED else LocalOwnerType.GUEST,
            existing = null,
            guestAccessToken = guestAccessToken,
            now = System.currentTimeMillis()
        ).toUiModel()
    }
}

internal fun buildMyHelpRequestsOverview(
    requests: List<MyHelpRequestUiModel>
): MyHelpRequestsOverviewUiModel {
    val activeRequests = requests.filter { it.isActive }
    val historyRequests = requests.filterNot { it.isActive }

    return MyHelpRequestsOverviewUiModel(
        totalRequests = requests.size,
        activeRequests = activeRequests,
        historyRequests = historyRequests,
        resolvedCount = requests.count { it.status.trim().uppercase() == "RESOLVED" },
        cancelledCount = requests.count { it.status.trim().uppercase() == "CANCELLED" },
        assignedResponderCount = activeRequests.sumOf { request -> request.responders.size }
    )
}

internal fun HelpRequestEntity.toUiModel(): MyHelpRequestUiModel {
    val helpTypes = helpTypesJson.jsonArrayToStringList().map(::formatHelpType)
    val riskStatusLabel = when (syncStatus) {
        SyncStatus.PENDING_CREATE -> "Saved offline, waiting to sync"
        SyncStatus.PENDING_UPDATE -> "Update waiting to sync"
        SyncStatus.FAILED -> "Sync failed"
        SyncStatus.CONFLICTED -> "Needs review"
        else -> formatStatus(status)
    }
    val displayId = remoteId ?: localId
    val created = serverCreatedAt?.let(::formatLifecycleTimestamp)
        ?: formatEpochMillis(createdAtEpochMillis)
    val closedAtRaw = cancelledAt ?: resolvedAt
    val closedStateLabel = when (status.trim().uppercase()) {
        "RESOLVED" -> "Resolved"
        "CANCELLED" -> "Cancelled"
        else -> null
    }
    val responders = helpersJson.jsonArrayToAssignedResponderList()
        .ifEmpty {
            buildList {
                if (
                    helperFirstName != null ||
                    helperLastName != null ||
                    helperPhone != null ||
                    helperProfession != null ||
                    helperExpertise != null
                ) {
                    add(
                        AssignedResponderUiModel(
                            firstName = helperFirstName,
                            lastName = helperLastName,
                            phone = helperPhone,
                            profession = helperProfession,
                            expertise = helperExpertise
                        )
                    )
                }
            }
        }
    val primaryResponder = responders.firstOrNull()

    return MyHelpRequestUiModel(
        id = displayId,
        guestAccessToken = guestAccessToken,
        helpTypes = helpTypes,
        helpTypeSummary = buildHelpTypeSummary(helpTypes),
        description = description,
        shortDescription = buildShortDescription(description),
        locationLabel = buildLocationLabel(country, city, district, neighborhood, extraAddress),
        status = status,
        statusLabel = riskStatusLabel,
        isActive = status != "RESOLVED" && status != "CANCELLED",
        contactName = contactFullName.takeIf { it.isNotBlank() },
        contactPhone = contactPhone.takeIf { it.isNotBlank() },
        alternativePhone = contactAlternativePhone,
        responders = responders,
        helperFirstName = primaryResponder?.firstName,
        helperLastName = primaryResponder?.lastName,
        helperPhone = primaryResponder?.phone,
        helperProfession = primaryResponder?.profession,
        helperExpertise = primaryResponder?.expertise,
        helperFullName = primaryResponder?.fullName,
        createdAt = created,
        urgencyLabel = formatOperationalLevel(urgencyLevel),
        priorityLabel = formatOperationalLevel(priorityLevel),
        closedAtLabel = formatLifecycleTimestamp(closedAtRaw),
        closedStateLabel = closedStateLabel,
        openDurationLabel = buildDurationLabel(
            openedAtRaw = serverCreatedAt,
            closedAtRaw = closedAtRaw,
            fallbackOpenedAtEpochMillis = createdAtEpochMillis
        ),
        syncStatus = syncStatus,
        pendingError = pendingError,
        lastSyncedAt = lastSyncedAtEpochMillis?.let(::formatEpochMillis)
    )
}

private fun String.jsonArrayToAssignedResponderList(): List<AssignedResponderUiModel> {
    return runCatching { JSONArray(this) }
        .getOrNull()
        ?.let { json ->
            buildList {
                for (index in 0 until json.length()) {
                    val value = json.optJSONObject(index)?.toAssignedResponderUiModel() ?: continue
                    add(value)
                }
            }
        }
        ?: emptyList()
}

private fun org.json.JSONObject.toAssignedResponderUiModel(): AssignedResponderUiModel {
    return AssignedResponderUiModel(
        firstName = optString("firstName").trim().takeIf { it.isNotBlank() },
        lastName = optString("lastName").trim().takeIf { it.isNotBlank() },
        phone = opt("phone")?.toString()?.takeIf { it.isNotBlank() && it != "null" },
        profession = optString("profession").trim().takeIf { it.isNotBlank() },
        expertise = optString("expertise").trim().takeIf { it.isNotBlank() }
    )
}

private fun buildHelpTypeSummary(helpTypes: List<String>): String {
    if (helpTypes.isEmpty()) {
        return "General Support"
    }

    return if (helpTypes.size == 1) {
        helpTypes.first()
    } else {
        "${helpTypes.first()} +${helpTypes.size - 1}"
    }
}

private fun formatHelpType(value: String): String {
    return value
        .trim()
        .split('_')
        .filter { it.isNotBlank() }
        .joinToString(" ") { part ->
            part.lowercase().replaceFirstChar { it.uppercase() }
        }
        .ifBlank { "General Support" }
}

private fun buildLocationLabel(
    country: String,
    city: String,
    district: String,
    neighborhood: String,
    extraAddress: String
): String {
    val parts = listOf(country, city, district, neighborhood, extraAddress)
        .map { it.trim() }
        .filter { it.isNotBlank() }

    return parts.joinToString(" / ").ifBlank { "Location unavailable" }
}

private fun formatStatus(status: String): String {
    return when (status.trim().uppercase()) {
        "SYNCED" -> "Awaiting match"
        "MATCHED" -> "Responder assigned"
        "RESOLVED" -> "Resolved"
        "CANCELLED" -> "Cancelled"
        "PENDING_SYNC" -> "Pending sync"
        else -> "Status unavailable"
    }
}

private fun buildShortDescription(description: String): String {
    val normalized = description.replace('\n', ' ').replace(Regex("\\s+"), " ").trim()
    if (normalized.isBlank()) return "No description provided."
    return if (normalized.length > 160) {
        normalized.take(157).trimEnd() + "..."
    } else {
        normalized
    }
}

private fun formatEpochMillis(raw: Long): String {
    val formatter = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.US)
    return formatter.format(java.util.Date(raw))
}

@Suppress("unused")
private fun JSONArray?.toStringList(): List<String> {
    if (this == null) {
        return emptyList()
    }

    return buildList {
        for (index in 0 until length()) {
            val value = optString(index).trim()
            if (value.isNotBlank()) {
                add(value)
            }
        }
    }
}
