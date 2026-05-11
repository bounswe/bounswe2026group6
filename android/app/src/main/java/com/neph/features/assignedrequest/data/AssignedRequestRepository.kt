package com.neph.features.assignedrequest.data

import com.neph.core.NephAppContext
import com.neph.core.database.AssignedRequestEntity
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.database.SyncOperationEntity
import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.core.sync.SyncEntityType
import com.neph.core.sync.SyncOperationType
import com.neph.core.sync.SyncStatus
import com.neph.features.requesthelp.data.buildDurationLabel
import com.neph.features.requesthelp.data.formatLifecycleTimestamp
import com.neph.features.requesthelp.data.formatOperationalLevel
import com.neph.features.requesthelp.data.jsonArrayToStringList
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject

data class AssignedRequestUiModel(
    val assignmentId: String,
    val requestId: String,
    val helpType: String,
    val helpTypes: List<String>,
    val helpTypeSummary: String,
    val otherHelpText: String?,
    val description: String,
    val shortDescription: String,
    val affectedPeopleCount: Int?,
    val riskFlags: List<String>,
    val vulnerableGroups: List<String>,
    val bloodType: String?,
    val shareProfileHealthInfoWithVolunteer: Boolean,
    val medicalConditions: List<String>,
    val chronicDiseases: List<String>,
    val allergies: List<String>,
    val latitude: Double?,
    val longitude: Double?,
    val locationLabel: String,
    val status: String,
    val statusLabel: String,
    val requesterName: String?,
    val requesterEmail: String?,
    val contactFullName: String?,
    val contactPhone: String?,
    val contactAlternativePhone: String?,
    val assignedAt: String?,
    val urgencyLabel: String?,
    val priorityLabel: String?,
    val openedAtLabel: String?,
    val openDurationLabel: String?,
    val syncStatus: String = SyncStatus.SYNCED,
    val pendingError: String? = null
) {
    val isPendingSync: Boolean
        get() = syncStatus == SyncStatus.PENDING_UPDATE || syncStatus == SyncStatus.PENDING_DELETE

    val isFailedSync: Boolean
        get() = syncStatus == SyncStatus.FAILED || syncStatus == SyncStatus.CONFLICTED
}

data class AssignmentRouteUiModel(
    val distanceKm: Double,
    val estimatedTimeMin: Int?,
    val source: String
)

object AssignedRequestRepository {
    private val database get() = NephDatabaseProvider.requireInstance()

    fun observeCurrentAssignment(): Flow<AssignedRequestUiModel?> {
        return database.assignedRequestDao().observeCurrent().map { it?.toUiModel() }
    }

    suspend fun fetchAssignedRequests(token: String): List<AssignedRequestUiModel> {
        return fetchCurrentAssignment(token)?.let(::listOf) ?: emptyList()
    }

    suspend fun fetchCurrentAssignment(token: String): AssignedRequestUiModel? {
        return try {
            val response = JsonHttpClient.request(
                path = "/availability/my-assignment",
                token = token
            )

            val assignment = response.optJSONObject("assignment")
            if (assignment == null) {
                database.assignedRequestDao().clearSyncedAssignments()
                return null
            }
            val entity = mapAssignmentEntity(assignment, syncStatus = SyncStatus.SYNCED)
            database.assignedRequestDao().clearSyncedAssignments()
            database.assignedRequestDao().upsert(entity)
            entity.toUiModel()
        } catch (error: ApiException) {
            if (error.status == 404) {
                database.assignedRequestDao().clearSyncedAssignments()
                return null
            }
            throw error
        }
    }

    suspend fun cancelAssignment(token: String, assignmentId: String): AssignedRequestUiModel? {
        val current = database.assignedRequestDao().getByAssignmentId(assignmentId)
            ?: return null
        val now = System.currentTimeMillis()
        val pending = current.copy(
            syncStatus = SyncStatus.PENDING_DELETE,
            pendingError = null,
            locallyCancelled = false,
            fetchedAtEpochMillis = now
        )
        database.assignedRequestDao().upsert(pending)
        database.syncOperationDao().upsert(
            SyncOperationEntity(
                entityType = SyncEntityType.ASSIGNED_REQUEST,
                entityId = assignmentId,
                operationType = SyncOperationType.CANCEL_ASSIGNMENT,
                payloadJson = JSONObject().put("assignmentId", assignmentId).toString(),
                createdAtEpochMillis = now
            )
        )
        OfflineSyncScheduler.enqueueSync(NephAppContext.get(), reason = "assignment-cancelled")
        return pending.toUiModel()
    }

    suspend fun clearLocalCache() {
        database.assignedRequestDao().clearAll()
        database.syncOperationDao().deleteByEntityType(SyncEntityType.ASSIGNED_REQUEST)
    }

    suspend fun fetchAssignmentRoute(token: String, assignmentId: String): AssignmentRouteUiModel? {
        val response = JsonHttpClient.request(
            path = "/assignments/$assignmentId/route",
            token = token
        )

        if (response.optString("error") == "location_unavailable") {
            return null
        }

        val distanceKm = response.optDouble("distance_km", Double.NaN)
        if (!distanceKm.isFinite() || distanceKm < 0.0) {
            return null
        }

        val estimatedTimeMin = response.opt("estimated_time_min")
            ?.toString()
            ?.toDoubleOrNull()
            ?.toInt()
            ?.takeIf { it > 0 }

        return AssignmentRouteUiModel(
            distanceKm = distanceKm,
            estimatedTimeMin = estimatedTimeMin,
            source = response.optString("source").ifBlank { "fallback" }
        )
    }

    internal suspend fun pushCancelOperation(operation: SyncOperationEntity, token: String?) {
        if (token.isNullOrBlank()) return
        val assignmentId = JSONObject(operation.payloadJson).optString("assignmentId")
            .ifBlank { operation.entityId }
        JsonHttpClient.request(
            path = "/availability/assignments/$assignmentId/cancel",
            method = "POST",
            token = token
        )
        database.syncOperationDao().delete(operation.operationId)
        database.assignedRequestDao().clearAll()
        fetchCurrentAssignment(token)
    }

    internal suspend fun markCancelFailed(assignmentId: String, message: String?) {
        val current = database.assignedRequestDao().getByAssignmentId(assignmentId) ?: return
        database.assignedRequestDao().upsert(
            current.copy(
                syncStatus = SyncStatus.FAILED,
                pendingError = message,
                fetchedAtEpochMillis = System.currentTimeMillis()
            )
        )
    }

    internal fun mapAssignmentEntity(assignment: JSONObject, syncStatus: String): AssignedRequestEntity {
        val description = assignment.optString("description").trim()
        val firstName = assignment.optString("requester_first_name").trim()
        val lastName = assignment.optString("requester_last_name").trim()
        val requesterName = listOf(firstName, lastName)
            .filter { it.isNotBlank() }
            .joinToString(" ")
            .takeIf { it.isNotBlank() }
        val helpTypes = assignment.optJSONArray("help_types").toStringList()
        val status = assignment.optString("request_status").ifBlank { "ASSIGNED" }
        val urgencyLevel = assignment.optString("urgencyLevel")
            .ifBlank { assignment.optString("urgency_level") }
            .trim()
            .ifBlank { null }
        val priorityLevel = assignment.optString("priorityLevel")
            .ifBlank { assignment.optString("priority_level") }
            .trim()
            .ifBlank { null }
        val openedAt = assignment.optString("openedAt")
            .ifBlank { assignment.optString("opened_at") }
            .trim()
            .ifBlank { null }
        val now = System.currentTimeMillis()

        return AssignedRequestEntity(
            assignmentId = assignment.optString("assignment_id"),
            requestId = assignment.optString("request_id"),
            helpType = formatValue(assignment.optString("need_type")),
            helpTypesJson = JSONArray(helpTypes).toString(),
            otherHelpText = assignment.optString("other_help_text").trim().takeIf { it.isNotBlank() },
            description = description,
            affectedPeopleCount = assignment.opt("affected_people_count")?.toString()?.toIntOrNull(),
            riskFlagsJson = JSONArray(assignment.optJSONArray("risk_flags").toStringList()).toString(),
            vulnerableGroupsJson = JSONArray(assignment.optJSONArray("vulnerable_groups").toStringList()).toString(),
            bloodType = assignment.optString("blood_type").trim().takeIf { it.isNotBlank() },
            shareProfileHealthInfoWithVolunteer = assignment.optBoolean("share_profile_health_info_with_volunteer", false),
            medicalConditionsJson = JSONArray(assignment.optJSONArray("medical_conditions").toStringList()).toString(),
            chronicDiseasesJson = JSONArray(assignment.optJSONArray("chronic_diseases").toStringList()).toString(),
            allergiesJson = JSONArray(assignment.optJSONArray("allergies").toStringList()).toString(),
            latitude = readAssignmentCoordinate(assignment, "latitude"),
            longitude = readAssignmentCoordinate(assignment, "longitude"),
            locationLabel = buildLocationLabel(assignment),
            status = status,
            urgencyLevel = urgencyLevel,
            priorityLevel = priorityLevel,
            requesterName = requesterName,
            requesterEmail = assignment.optString("requester_email").takeIf { it.isNotBlank() },
            contactFullName = assignment.optString("contact_full_name").trim().takeIf { it.isNotBlank() },
            contactPhone = assignment.opt("contact_phone")?.toString()?.takeIf { it.isNotBlank() },
            contactAlternativePhone = assignment.opt("contact_alternative_phone")?.toString()
                ?.takeIf { it.isNotBlank() },
            assignedAt = assignment.optString("assigned_at").takeIf { it.isNotBlank() }?.let(::formatLifecycleTimestamp),
            openedAt = openedAt,
            syncStatus = syncStatus,
            pendingError = null,
            fetchedAtEpochMillis = now,
            lastSyncedAtEpochMillis = now,
            locallyCancelled = false
        )
    }

    internal fun AssignedRequestEntity.toUiModel(): AssignedRequestUiModel {
        val formattedHelpTypes = helpTypesJson.jsonArrayToStringList().map(::formatValue)
        val statusLabel = when (syncStatus) {
            SyncStatus.PENDING_DELETE -> "Release waiting to sync"
            SyncStatus.FAILED -> "Sync failed"
            SyncStatus.CONFLICTED -> "Needs review"
            else -> formatStatus(status)
        }

        return AssignedRequestUiModel(
            assignmentId = assignmentId,
            requestId = requestId,
            helpType = helpType,
            helpTypes = formattedHelpTypes,
            helpTypeSummary = buildHelpTypeSummary(formattedHelpTypes, helpType),
            otherHelpText = otherHelpText,
            description = description,
            shortDescription = buildShortDescription(description),
            affectedPeopleCount = affectedPeopleCount,
            riskFlags = riskFlagsJson.jsonArrayToStringList().map(::formatValue),
            vulnerableGroups = vulnerableGroupsJson.jsonArrayToStringList().map(::formatValue),
            bloodType = bloodType,
            shareProfileHealthInfoWithVolunteer = shareProfileHealthInfoWithVolunteer,
            medicalConditions = medicalConditionsJson.jsonArrayToStringList(),
            chronicDiseases = chronicDiseasesJson.jsonArrayToStringList(),
            allergies = allergiesJson.jsonArrayToStringList(),
            latitude = latitude,
            longitude = longitude,
            locationLabel = locationLabel,
            status = status,
            statusLabel = statusLabel,
            requesterName = requesterName,
            requesterEmail = requesterEmail,
            contactFullName = contactFullName,
            contactPhone = contactPhone,
            contactAlternativePhone = contactAlternativePhone,
            assignedAt = assignedAt,
            urgencyLabel = formatOperationalLevel(urgencyLevel),
            priorityLabel = formatOperationalLevel(priorityLevel),
            openedAtLabel = formatLifecycleTimestamp(openedAt),
            openDurationLabel = buildDurationLabel(openedAtRaw = openedAt),
            syncStatus = syncStatus,
            pendingError = pendingError
        )
    }

    private fun buildHelpTypeSummary(helpTypes: List<String>, fallbackNeedType: String): String {
        if (helpTypes.isNotEmpty()) {
            return if (helpTypes.size == 1) {
                helpTypes.first()
            } else {
                "${helpTypes.first()} +${helpTypes.size - 1}"
            }
        }

        return formatValue(fallbackNeedType)
    }

    private fun formatValue(value: String): String {
        val normalizedValue = value.trim().lowercase()
        val explicitLabel = when (normalizedValue) {
            "search_rescue",
            "search_and_rescue",
            "sar",
            "fire_brigade",
            "rescue" -> "Search and Rescue"
            "food_water",
            "food/water" -> "Food / Water"
            "first_aid",
            "medical" -> "First Aid"
            else -> null
        }
        if (explicitLabel != null) {
            return explicitLabel
        }

        return normalizedValue
            .trim()
            .split('_')
            .filter { it.isNotBlank() }
            .joinToString(" ") { part ->
                part.lowercase().replaceFirstChar { it.uppercase() }
            }
            .ifBlank { "General Support" }
    }

    private fun buildLocationLabel(assignment: JSONObject): String {
        val locationParts = listOf(
            assignment.optString("request_country").trim(),
            assignment.optString("request_city").trim(),
            assignment.optString("request_district").trim(),
            assignment.optString("request_neighborhood").trim(),
            assignment.optString("request_extra_address").trim()
        ).filter { it.isNotBlank() }

        if (locationParts.isNotEmpty()) {
            return locationParts.joinToString(" / ")
        }

        val latitude = assignment.optDouble("latitude", Double.NaN)
        val longitude = assignment.optDouble("longitude", Double.NaN)
        return if (!latitude.isNaN() && !longitude.isNaN()) {
            "Lat ${"%.4f".format(latitude)}, Lon ${"%.4f".format(longitude)}"
        } else {
            "Location unavailable"
        }
    }

    private fun readAssignmentCoordinate(assignment: JSONObject, key: String): Double? {
        if (!assignment.has(key) || assignment.isNull(key)) {
            return null
        }
        return assignment.optDouble(key).takeIf { it.isFinite() }
    }

    private fun formatStatus(status: String): String {
        return when (status.trim().uppercase()) {
            "ASSIGNED" -> "Assigned to you"
            "IN_PROGRESS" -> "In progress"
            "RESOLVED" -> "Resolved"
            "CANCELLED" -> "Cancelled"
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
}
