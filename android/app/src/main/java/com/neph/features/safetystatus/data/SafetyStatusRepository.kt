package com.neph.features.safetystatus.data

import com.neph.core.network.JsonHttpClient
import com.neph.features.profile.data.CurrentDeviceLocation
import org.json.JSONObject

object SafetyStatusRepository {
    suspend fun markSafe(
        token: String,
        note: String? = null,
        location: CurrentDeviceLocation? = null,
        shareLocationConsent: Boolean = false
    ) {
        val body = buildMarkSafePayload(
            note = note,
            location = location,
            shareLocationConsent = shareLocationConsent
        )

        JsonHttpClient.request(
            path = "/safety-status/me",
            method = "PATCH",
            token = token,
            body = body
        )
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
}
