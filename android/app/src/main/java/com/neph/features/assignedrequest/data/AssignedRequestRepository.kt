package com.neph.features.assignedrequest.data

import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
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
    val locationLabel: String,
    val status: String,
    val statusLabel: String,
    val requesterName: String?,
    val requesterEmail: String?,
    val contactFullName: String?,
    val contactPhone: String?,
    val contactAlternativePhone: String?,
    val assignedAt: String?
)

object AssignedRequestRepository {
    suspend fun fetchAssignedRequests(token: String): List<AssignedRequestUiModel> {
        return fetchCurrentAssignment(token)?.let(::listOf) ?: emptyList()
    }

    suspend fun fetchCurrentAssignment(token: String): AssignedRequestUiModel? {
        try {
            val response = JsonHttpClient.request(
                path = "/availability/my-assignment",
                token = token
            )

            val assignment = response.optJSONObject("assignment") ?: return null
            return mapAssignment(assignment)
        } catch (error: ApiException) {
            if (error.status == 404) {
                return null
            }
            throw error
        }
    }

    suspend fun cancelAssignment(token: String, assignmentId: String): AssignedRequestUiModel? {
        val response = JsonHttpClient.request(
            path = "/availability/assignments/$assignmentId/cancel",
            method = "POST",
            token = token
        )

        return response.optJSONObject("newAssignment")?.let(::mapAssignment)
    }

    private fun mapAssignment(assignment: JSONObject): AssignedRequestUiModel {
        val description = assignment.optString("description").trim()
        val firstName = assignment.optString("requester_first_name").trim()
        val lastName = assignment.optString("requester_last_name").trim()
        val requesterName = listOf(firstName, lastName)
            .filter { it.isNotBlank() }
            .joinToString(" ")
            .takeIf { it.isNotBlank() }
        val helpTypes = assignment.optJSONArray("help_types").toStringList().map(::formatValue)
        val status = assignment.optString("request_status").ifBlank { "ASSIGNED" }

        return AssignedRequestUiModel(
            assignmentId = assignment.optString("assignment_id"),
            requestId = assignment.optString("request_id"),
            helpType = formatValue(assignment.optString("need_type")),
            helpTypes = helpTypes,
            helpTypeSummary = buildHelpTypeSummary(helpTypes, assignment.optString("need_type")),
            otherHelpText = assignment.optString("other_help_text").trim().takeIf { it.isNotBlank() },
            description = description,
            shortDescription = buildShortDescription(description),
            affectedPeopleCount = assignment.opt("affected_people_count")?.toString()?.toIntOrNull(),
            riskFlags = assignment.optJSONArray("risk_flags").toStringList().map(::formatValue),
            vulnerableGroups = assignment.optJSONArray("vulnerable_groups").toStringList().map(::formatValue),
            bloodType = assignment.optString("blood_type").trim().takeIf { it.isNotBlank() },
            locationLabel = buildLocationLabel(assignment),
            status = status,
            statusLabel = formatStatus(status),
            requesterName = requesterName,
            requesterEmail = assignment.optString("requester_email").takeIf { it.isNotBlank() },
            contactFullName = assignment.optString("contact_full_name").trim().takeIf { it.isNotBlank() },
            contactPhone = assignment.opt("contact_phone")?.toString()?.takeIf { it.isNotBlank() },
            contactAlternativePhone = assignment.opt("contact_alternative_phone")?.toString()
                ?.takeIf { it.isNotBlank() },
            assignedAt = assignment.optString("assigned_at").takeIf { it.isNotBlank() }?.let(::formatTimestamp)
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
        return value
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

    private fun formatTimestamp(raw: String): String {
        return raw
            .replace('T', ' ')
            .substringBefore('.')
            .substringBefore('Z')
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
