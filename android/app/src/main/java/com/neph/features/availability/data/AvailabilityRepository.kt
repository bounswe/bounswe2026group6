package com.neph.features.availability.data

import android.content.Context
import android.content.SharedPreferences
import com.neph.core.network.JsonHttpClient
import org.json.JSONObject

data class AvailabilityState(
    val isAvailable: Boolean = false,
    val assignmentId: String? = null
)

object AvailabilityAccessPolicy {
    // Logged-in users only.
    private const val EnforceAuthentication = true

    fun canAccess(token: String?): Boolean = !EnforceAuthentication || !token.isNullOrBlank()

    fun shouldRedirectToLogin(): Boolean = EnforceAuthentication
}

object AvailabilityRepository {
    private const val PrefsName = "neph_availability"
    private const val AvailabilityKey = "is_available"
    private const val AssignmentIdKey = "assignment_id"

    private lateinit var prefs: SharedPreferences
    private var cachedState = AvailabilityState()

    fun initialize(context: Context) {
        if (!::prefs.isInitialized) {
            prefs = context.applicationContext.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            cachedState = AvailabilityState(
                isAvailable = prefs.getBoolean(AvailabilityKey, false),
                assignmentId = prefs.getString(AssignmentIdKey, null)
            )
        }
    }

    fun getAvailabilityState(): AvailabilityState {
        ensureInitialized()
        return cachedState
    }

    fun setAvailabilityStateForUi(state: AvailabilityState) {
        ensureInitialized()
        saveAvailabilityState(state)
    }

    suspend fun refreshAssignmentState(token: String): AvailabilityState {
        ensureInitialized()

        val response = JsonHttpClient.request(
            path = "/availability/status",
            token = token
        )

        val assignment = response.optJSONObject("assignment")
        val nextState = AvailabilityState(
            isAvailable = response.optBoolean("isAvailable", false),
            assignmentId = assignment?.optString("assignment_id")?.takeIf { it.isNotBlank() }
        )

        saveAvailabilityState(nextState)
        return nextState
    }

    suspend fun setAvailability(
        isAvailable: Boolean,
        token: String?
    ): AvailabilityState {
        ensureInitialized()

        val response = JsonHttpClient.request(
            path = "/availability/toggle",
            method = "POST",
            token = token?.takeIf { it.isNotBlank() },
            body = JSONObject().put("isAvailable", isAvailable)
        )

        val volunteer = response.optJSONObject("volunteer")
        val assignment = response.optJSONObject("assignment")

        val nextState = AvailabilityState(
            isAvailable = volunteer?.optBoolean("is_available") ?: isAvailable,
            assignmentId = assignment?.optString("assignment_id")?.takeIf { it.isNotBlank() }
        )

        saveAvailabilityState(nextState)
        return nextState
    }

    private fun saveAvailabilityState(state: AvailabilityState) {
        cachedState = state
        prefs.edit().apply {
            putBoolean(AvailabilityKey, state.isAvailable)
            if (state.assignmentId.isNullOrBlank()) {
                remove(AssignmentIdKey)
            } else {
                putString(AssignmentIdKey, state.assignmentId)
            }
        }.apply()
    }

    private fun ensureInitialized() {
        check(::prefs.isInitialized) {
            "AvailabilityRepository must be initialized before use."
        }
    }
}
