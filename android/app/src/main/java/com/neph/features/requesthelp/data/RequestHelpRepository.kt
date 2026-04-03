package com.neph.features.requesthelp.data

import com.neph.core.network.JsonHttpClient
import org.json.JSONArray
import org.json.JSONObject

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

object RequestHelpRepository {
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
        token: String,
        submission: RequestHelpSubmission
    ): String {
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
                        put("country", submission.location.country)
                        put("city", submission.location.city)
                        put("district", submission.location.district)
                        put("neighborhood", submission.location.neighborhood)
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

        return response.optJSONObject("request")?.optString("id")
            ?.takeIf { it.isNotBlank() }
            ?: ""
    }
}
