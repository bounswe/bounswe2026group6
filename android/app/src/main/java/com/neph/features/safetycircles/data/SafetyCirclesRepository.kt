package com.neph.features.safetycircles.data

import com.neph.core.network.JsonHttpClient
import com.neph.features.profile.data.CurrentDeviceLocation
import org.json.JSONObject

data class SafetyCircleSummary(
    val circleId: String,
    val name: String,
    val ownerUserId: String,
    val memberCount: Int
)

data class SafetyCircleMember(
    val userId: String,
    val displayName: String?,
    val emergencyContactPhone: String?,
    val role: String,
    val status: String,
    val note: String?,
    val lastCheckedInAt: String?,
    val hasSharedLocation: Boolean
)

data class SafetyCircleInvite(
    val inviteId: String,
    val circleId: String,
    val circleName: String?,
    val inviterDisplayName: String?,
    val status: String
)

data class SafetyCircleDetail(
    val circle: SafetyCircleSummary,
    val currentUserRole: String,
    val members: List<SafetyCircleMember>
)

object SafetyCirclesRepository {
    suspend fun listCircles(token: String): List<SafetyCircleSummary> {
        val response = JsonHttpClient.request(
            path = "/safety-circles",
            token = token
        )
        val circles = response.optJSONArray("circles") ?: return emptyList()
        return buildList {
            for (index in 0 until circles.length()) {
                circles.optJSONObject(index)?.toCircleSummary()?.let(::add)
            }
        }
    }

    suspend fun createCircle(token: String, name: String): SafetyCircleSummary {
        val response = JsonHttpClient.request(
            path = "/safety-circles",
            method = "POST",
            token = token,
            body = JSONObject().put("name", name.trim())
        )
        return response.getJSONObject("circle").toCircleSummary()
    }

    suspend fun getCircle(token: String, circleId: String): SafetyCircleDetail {
        val response = JsonHttpClient.request(
            path = "/safety-circles/$circleId",
            token = token
        )
        val membersJson = response.optJSONArray("members")
        return SafetyCircleDetail(
            circle = response.getJSONObject("circle").toCircleSummary(),
            currentUserRole = response.optString("currentUserRole").ifBlank { "member" },
            members = buildList {
                if (membersJson != null) {
                    for (index in 0 until membersJson.length()) {
                        membersJson.optJSONObject(index)?.toCircleMember()?.let(::add)
                    }
                }
            }
        )
    }

    suspend fun invite(token: String, circleId: String, invitee: String) {
        val trimmed = invitee.trim()
        val key = if (trimmed.contains("@")) "inviteeEmail" else "inviteeUserId"
        JsonHttpClient.request(
            path = "/safety-circles/$circleId/invites",
            method = "POST",
            token = token,
            body = JSONObject().put(key, trimmed)
        )
    }

    suspend fun listInvites(token: String): List<SafetyCircleInvite> {
        val response = JsonHttpClient.request(
            path = "/safety-circles/invites",
            token = token
        )
        val invites = response.optJSONArray("invites") ?: return emptyList()
        return buildList {
            for (index in 0 until invites.length()) {
                invites.optJSONObject(index)?.toInvite()?.let(::add)
            }
        }
    }

    suspend fun respondToInvite(token: String, inviteId: String, accept: Boolean) {
        JsonHttpClient.request(
            path = "/safety-circles/invites/$inviteId/respond",
            method = "POST",
            token = token,
            body = JSONObject().put("decision", if (accept) "accept" else "reject")
        )
    }

    suspend fun checkIn(
        token: String,
        circleId: String,
        status: String,
        location: CurrentDeviceLocation? = null,
        shareLocationConsent: Boolean = false
    ) {
        val sharedLocation = location.takeIf { shareLocationConsent }
        val body = JSONObject()
            .put("status", status)
            .put("shareLocationConsent", sharedLocation != null)

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

        JsonHttpClient.request(
            path = "/safety-circles/$circleId/check-in",
            method = "PATCH",
            token = token,
            body = body
        )
    }

    suspend fun leave(token: String, circleId: String) {
        JsonHttpClient.request(
            path = "/safety-circles/$circleId/members/me",
            method = "DELETE",
            token = token
        )
    }

    suspend fun deleteCircle(token: String, circleId: String) {
        JsonHttpClient.request(
            path = "/safety-circles/$circleId",
            method = "DELETE",
            token = token
        )
    }

    suspend fun transferOwnership(token: String, circleId: String, nextOwnerUserId: String) {
        JsonHttpClient.request(
            path = "/safety-circles/$circleId/owner",
            method = "PATCH",
            token = token,
            body = JSONObject().put("nextOwnerUserId", nextOwnerUserId)
        )
    }
}

private fun JSONObject.toCircleSummary(): SafetyCircleSummary {
    return SafetyCircleSummary(
        circleId = getString("circleId"),
        name = optString("name").ifBlank { "Safety Circle" },
        ownerUserId = optString("ownerUserId"),
        memberCount = optInt("memberCount", 0)
    )
}

private fun JSONObject.toCircleMember(): SafetyCircleMember {
    return SafetyCircleMember(
        userId = optString("userId"),
        displayName = optString("displayName").takeIf { it.isNotBlank() && it != "null" },
        emergencyContactPhone = optJSONObject("emergencyContact")
            ?.optString("phoneNumber")
            ?.takeIf { it.isNotBlank() && it != "null" },
        role = optString("role").ifBlank { "member" },
        status = optString("status").ifBlank { "unknown" },
        note = optString("note").takeIf { it.isNotBlank() && it != "null" },
        lastCheckedInAt = optString("lastCheckedInAt").takeIf { it.isNotBlank() && it != "null" },
        hasSharedLocation = !isNull("location")
    )
}

private fun JSONObject.toInvite(): SafetyCircleInvite {
    return SafetyCircleInvite(
        inviteId = getString("inviteId"),
        circleId = optString("circleId"),
        circleName = optString("circleName").takeIf { it.isNotBlank() && it != "null" },
        inviterDisplayName = optString("inviterDisplayName").takeIf { it.isNotBlank() && it != "null" },
        status = optString("status")
    )
}
