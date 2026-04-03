package com.neph.features.myhelprequests.data

import com.neph.core.network.JsonHttpClient
import org.json.JSONArray
import org.json.JSONObject

data class MyHelpRequestUiModel(
    val id: String,
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
    val createdAt: String?
)

object MyHelpRequestsRepository {
    suspend fun fetchMyHelpRequests(token: String): List<MyHelpRequestUiModel> {
        val response = JsonHttpClient.request(
            path = "/help-requests",
            token = token
        )

        val requests = response.optJSONArray("requests") ?: return emptyList()
        return buildList {
            for (index in 0 until requests.length()) {
                val request = requests.optJSONObject(index) ?: continue
                add(mapRequest(request))
            }
        }
    }

    suspend fun markRequestAsResolved(token: String, requestId: String): MyHelpRequestUiModel? {
        val response = JsonHttpClient.request(
            path = "/help-requests/$requestId/status",
            method = "PATCH",
            token = token,
            body = JSONObject().put("status", "RESOLVED")
        )

        return response.optJSONObject("request")?.let(::mapRequest)
    }

    private fun mapRequest(request: JSONObject): MyHelpRequestUiModel {
        val description = request.optString("description").trim()
        val helpTypes = request.optJSONArray("helpTypes").toStringList().map(::formatHelpType)
        val status = request.optString("status").ifBlank { "Unknown" }
        val contact = request.optJSONObject("contact")

        return MyHelpRequestUiModel(
            id = request.optString("id"),
            helpTypes = helpTypes,
            helpTypeSummary = buildHelpTypeSummary(helpTypes),
            description = description,
            shortDescription = buildShortDescription(description),
            locationLabel = buildLocationLabel(request.optJSONObject("location")),
            status = status,
            statusLabel = formatStatus(status),
            isActive = status != "RESOLVED" && status != "CANCELLED",
            contactName = contact?.optString("fullName")?.trim()?.takeIf { it.isNotBlank() },
            contactPhone = contact?.opt("phone")?.toString()?.takeIf { it.isNotBlank() },
            alternativePhone = contact?.opt("alternativePhone")?.toString()?.takeIf { it.isNotBlank() },
            createdAt = request.optString("createdAt").takeIf { it.isNotBlank() }?.let(::formatTimestamp)
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

    private fun buildLocationLabel(location: JSONObject?): String {
        if (location == null) {
            return "Location unavailable"
        }

        val parts = listOf(
            location.optString("country").trim(),
            location.optString("city").trim(),
            location.optString("district").trim(),
            location.optString("neighborhood").trim(),
            location.optString("extraAddress").trim()
        ).filter { it.isNotBlank() }

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
