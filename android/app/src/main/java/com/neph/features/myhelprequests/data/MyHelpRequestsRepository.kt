package com.neph.features.myhelprequests.data

import com.neph.core.NephAppContext
import com.neph.core.database.HelpRequestEntity
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.database.SyncOperationEntity
import com.neph.core.format.formatInstantWithRelativeDay
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
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale

data class MyHelpRequestUiModel(
    val id: String,
    val localId: String,
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
    val lastSyncedAt: String? = null,
    val isGuideOnly: Boolean = false
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
        guestAccessToken: String? = null
    ): MyHelpRequestUiModel? {
        return markLocalRequestStatus(
            requestId = requestId,
            ownerType = LocalOwnerType.GUEST,
            nextStatus = "RESOLVED",
            guestAccessToken = guestAccessToken
        )
    }

    suspend fun markRequestAsCancelled(token: String, requestId: String): MyHelpRequestUiModel? {
        return markLocalRequestStatus(
            requestId = requestId,
            ownerType = LocalOwnerType.AUTHENTICATED,
            nextStatus = "CANCELLED"
        )
    }

    suspend fun markGuestRequestAsCancelled(
        requestId: String,
        guestAccessToken: String? = null
    ): MyHelpRequestUiModel? {
        return markLocalRequestStatus(
            requestId = requestId,
            ownerType = LocalOwnerType.GUEST,
            nextStatus = "CANCELLED",
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
            resolvedAt = if (nextStatus == "RESOLVED") now.toIsoLikeString() else entity.resolvedAt,
            cancelledAt = if (nextStatus == "CANCELLED") now.toIsoLikeString() else entity.cancelledAt,
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
    val displayDescription = buildDescriptionText(description)
    val normalizedStatus = status.trim().uppercase()
    val riskStatusLabel = when (syncStatus) {
        SyncStatus.PENDING_CREATE -> if (normalizedStatus.isTerminalRequestStatus()) {
            formatStatus(status)
        } else {
            "Saved offline, waiting to sync"
        }
        SyncStatus.PENDING_UPDATE -> if (normalizedStatus.isTerminalRequestStatus()) {
            formatStatus(status)
        } else {
            "Update waiting to sync"
        }
        SyncStatus.FAILED -> if (normalizedStatus.isTerminalRequestStatus()) formatStatus(status) else "Sync failed"
        SyncStatus.CONFLICTED -> if (normalizedStatus.isTerminalRequestStatus()) formatStatus(status) else "Needs review"
        else -> formatStatus(status)
    }
    val displayId = remoteId ?: localId
    val created = serverCreatedAt?.let(::formatLifecycleTimestamp)
        ?: formatEpochMillis(createdAtEpochMillis)
    val closedAtRaw = cancelledAt ?: resolvedAt
    val closedStateLabel = when (normalizedStatus) {
        "RESOLVED" -> "Resolved"
        "CANCELLED" -> "Cancelled"
        else -> null
    }
    val fallbackResponder = AssignedResponderUiModel(
        firstName = normalizeDisplayText(helperFirstName),
        lastName = normalizeDisplayText(helperLastName),
        phone = normalizeDisplayText(helperPhone),
        profession = normalizeDisplayText(helperProfession),
        expertise = formatHelperExpertise(helperExpertise)
    ).takeIf { it.hasVisibleDetails }
    val responders = helpersJson.jsonArrayToAssignedResponderList()
        .ifEmpty { listOfNotNull(fallbackResponder) }
    val primaryResponder = responders.firstOrNull()

    return MyHelpRequestUiModel(
        id = displayId,
        localId = localId,
        guestAccessToken = guestAccessToken,
        helpTypes = helpTypes,
        helpTypeSummary = buildHelpTypeSummary(helpTypes),
        description = displayDescription,
        shortDescription = buildShortDescription(description),
        locationLabel = buildLocationLabel(country, city, district, neighborhood, extraAddress),
        status = status,
        statusLabel = riskStatusLabel,
        isActive = !normalizedStatus.isTerminalRequestStatus(),
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
                    if (value.hasVisibleDetails) {
                        add(value)
                    }
                }
            }
        }
        ?: emptyList()
}

private fun org.json.JSONObject.toAssignedResponderUiModel(): AssignedResponderUiModel {
    return AssignedResponderUiModel(
        firstName = normalizeDisplayText(opt("firstName")?.toString()),
        lastName = normalizeDisplayText(opt("lastName")?.toString()),
        phone = normalizeDisplayText(opt("phone")?.toString()),
        profession = normalizeDisplayText(opt("profession")?.toString()),
        expertise = formatHelperExpertise(opt("expertise")?.toString())
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

private fun String.isTerminalRequestStatus(): Boolean = this == "RESOLVED" || this == "CANCELLED"

private fun Long.toIsoLikeString(): String {
    val formatter = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
    formatter.timeZone = java.util.TimeZone.getTimeZone("UTC")
    return formatter.format(java.util.Date(this))
}

private const val NoDescriptionProvided = "No description provided."

private fun buildDescriptionText(description: String): String {
    return normalizeDisplayText(description) ?: NoDescriptionProvided
}

private fun buildShortDescription(description: String): String {
    val normalized = buildDescriptionText(description)
    return if (normalized.length > 160) {
        normalized.take(157).trimEnd() + "..."
    } else {
        normalized
    }
}

private fun normalizeDisplayText(value: String?): String? {
    val normalized = value
        ?.replace('\n', ' ')
        ?.replace(Regex("\\s+"), " ")
        ?.trim()
        .orEmpty()

    return normalized.takeUnless { it.isBlank() || it.equals("null", ignoreCase = true) }
}

private fun formatHelperExpertise(rawValue: String?): String? {
    val value = normalizeDisplayText(rawValue) ?: return null

    if (value.startsWith("{")) {
        return parseExpertiseObject(value)
    }

    if (value.startsWith("[")) {
        val labels = parseExpertiseArray(value) ?: return null
        return labels
            .mapNotNull(::formatHelperExpertise)
            .distinct()
            .joinToString(", ")
            .takeIf { it.isNotBlank() }
    }

    val normalized = value
        .lowercase(Locale.ROOT)
        .replace('_', ' ')
        .replace(Regex("\\s+"), " ")
        .trim()
    val compact = normalized.replace(Regex("[^a-z0-9]+"), "")

    if (
        normalized.startsWith("no ") && "first aid" in normalized ||
        "does not know first aid" in normalized ||
        "doesn't know first aid" in normalized ||
        "not know first aid" in normalized ||
        compact == "firstaidfalse"
    ) {
        return null
    }

    if ("first aid" in normalized || compact == "firstaid" || compact == "firstaidtrue") {
        return "Knows first aid"
    }

    if (value.endsWith("?")) {
        return null
    }

    return value
}

private fun parseExpertiseArray(value: String): List<String>? {
    if (!value.startsWith("[")) {
        return null
    }

    val array = runCatching { JSONArray(value) }.getOrNull() ?: return null
    return buildList {
        for (index in 0 until array.length()) {
            normalizeDisplayText(array.opt(index)?.toString())?.let(::add)
        }
    }
}

private fun parseExpertiseObject(value: String): String? {
    if (!value.startsWith("{")) {
        return null
    }

    val json = runCatching { JSONObject(value) }.getOrNull() ?: return null
    if (json.has("firstAid")) {
        return if (json.optBoolean("firstAid", false)) "Knows first aid" else null
    }

    if (json.has("first_aid")) {
        return if (json.optBoolean("first_aid", false)) "Knows first aid" else null
    }

    return null
}

private fun formatEpochMillis(raw: Long): String {
    return formatInstantWithRelativeDay(
        instant = Instant.ofEpochMilli(raw),
        fallbackFormatter = EpochDisplayFormatter,
        timeFormatter = EpochTimeFormatter,
        relativeSeparator = " "
    )
}

private val EpochDisplayFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm", Locale.US)

private val EpochTimeFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("HH:mm", Locale.US)

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
