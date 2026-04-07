package com.neph.features.requesthelp.data

import android.content.Context
import android.content.SharedPreferences
import com.neph.core.network.JsonHttpClient
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

data class RequestHelpLocationSubmission(
    val provinceCode: String,
    val districtId: String,
    val neighborhoodId: String,
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
    val guestAccessToken: String? = null
)

data class GuestTrackedHelpRequest(
    val requestId: String,
    val guestAccessToken: String
)

object RequestHelpRepository {
    private const val PrefsName = "neph_guest_help_requests"
    private const val GuestRequestsKey = "guest_requests"

    private lateinit var prefs: SharedPreferences

    fun initialize(context: Context) {
        if (!::prefs.isInitialized) {
            prefs = context.applicationContext.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
        }
    }

    suspend fun hasActiveHelpRequest(token: String): Boolean {
        val response = JsonHttpClient.request(
            path = "/help-requests",
            token = token
        )

        val requests = response.optJSONArray("requests") ?: return false
        for (index in 0 until requests.length()) {
            val request = requests.optJSONObject(index) ?: continue
            val status = request.optString("status").trim().uppercase()
            if (status != "RESOLVED" && status != "CANCELLED") {
                return true
            }
        }

        return false
    }

    suspend fun createHelpRequest(
        token: String?,
        submission: RequestHelpSubmission
    ): CreateHelpRequestResult {
        val response = JsonHttpClient.request(
            path = "/help-requests",
            method = "POST",
            token = token,
            body = JSONObject().apply {
                put("helpTypes", JSONArray(submission.helpTypes))
                put("otherHelpText", submission.otherHelpText)
                put("affectedPeopleCount", submission.affectedPeopleCount)
                put("description", submission.description)
                put("riskFlags", JSONArray(submission.riskFlags))
                put("vulnerableGroups", JSONArray(submission.vulnerableGroups))
                put("bloodType", submission.bloodType)
                put(
                    "location",
                    JSONObject().apply {
                        put("provinceCode", submission.location.provinceCode)
                        put("districtId", submission.location.districtId)
                        put("neighborhoodId", submission.location.neighborhoodId)
                        put("extraAddress", submission.location.extraAddress)
                    }
                )
                put(
                    "contact",
                    JSONObject().apply {
                        put("fullName", submission.contact.fullName)
                        put("phone", submission.contact.phone)
                        submission.contact.alternativePhone?.let {
                            put("alternativePhone", it)
                        }
                    }
                )
                put("consentGiven", submission.consentGiven)
            }
        )

        val requestId = response.optJSONObject("request")?.optString("id")
            ?.takeIf { it.isNotBlank() }
            ?: ""
        val guestAccessToken = response.optString("guestAccessToken").takeIf { it.isNotBlank() }

        if (token.isNullOrBlank() && requestId.isNotBlank() && guestAccessToken != null) {
            saveGuestTrackedRequest(
                GuestTrackedHelpRequest(
                    requestId = requestId,
                    guestAccessToken = guestAccessToken
                )
            )
        }

        return CreateHelpRequestResult(
            requestId = requestId,
            guestAccessToken = guestAccessToken
        )
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
