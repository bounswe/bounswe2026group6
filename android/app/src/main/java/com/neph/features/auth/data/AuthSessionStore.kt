package com.neph.features.auth.data

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import com.neph.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject

object AuthSessionStore {
    private const val PrefsName = "neph_auth"
    private const val AccessTokenKey = "access_token"
    private const val CurrentUserIdKey = "current_user_id"
    private const val PendingVerificationEmailKey = "pending_verification_email"
    private const val GuestModeKey = "guest_mode"

    private lateinit var prefs: SharedPreferences
    private val accessTokenState = MutableStateFlow<String?>(null)
    private var sessionToken: String? = null
    private var sessionUserId: String? = null

    fun initialize(context: Context) {
        if (!::prefs.isInitialized) {
            prefs = context.applicationContext.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            sessionToken = prefs.getString(AccessTokenKey, null)
            sessionUserId = prefs.getString(CurrentUserIdKey, null)
            accessTokenState.value = sessionToken
        }
    }

    val accessTokenFlow: StateFlow<String?> = accessTokenState

    fun getAccessToken(): String? {
        ensureInitialized()
        return sessionToken ?: prefs.getString(AccessTokenKey, null)
    }

    fun getCurrentUserId(): String? {
        ensureInitialized()
        val storedUserId = sessionUserId ?: prefs.getString(CurrentUserIdKey, null)
        if (!storedUserId.isNullOrBlank()) {
            return storedUserId
        }

        val userIdFromToken = extractUserIdFromAccessToken(sessionToken ?: prefs.getString(AccessTokenKey, null))
        if (!userIdFromToken.isNullOrBlank()) {
            sessionUserId = userIdFromToken
            prefs.edit().putString(CurrentUserIdKey, userIdFromToken).apply()
        }
        return userIdFromToken
    }

    fun saveAccessToken(token: String, rememberMe: Boolean, userId: String? = null) {
        ensureInitialized()
        val normalizedUserId = userId?.trim()?.takeIf { it.isNotBlank() }
        sessionToken = token
        sessionUserId = normalizedUserId
        accessTokenState.value = token
        prefs.edit().apply {
            putBoolean(GuestModeKey, false)
            if (rememberMe) {
                putString(AccessTokenKey, token)
                if (normalizedUserId != null) {
                    putString(CurrentUserIdKey, normalizedUserId)
                } else {
                    remove(CurrentUserIdKey)
                }
            } else {
                remove(AccessTokenKey)
                remove(CurrentUserIdKey)
            }
        }.apply()
    }

    fun clearAccessToken() {
        ensureInitialized()
        sessionToken = null
        sessionUserId = null
        accessTokenState.value = null
        prefs.edit()
            .remove(AccessTokenKey)
            .remove(CurrentUserIdKey)
            .apply()
    }

    fun setGuestMode(enabled: Boolean) {
        ensureInitialized()
        prefs.edit().putBoolean(GuestModeKey, enabled).apply()
    }

    fun isGuestMode(): Boolean {
        ensureInitialized()
        return prefs.getBoolean(GuestModeKey, false)
    }

    fun setPendingVerificationEmail(email: String?) {
        ensureInitialized()
        prefs.edit().apply {
            if (email.isNullOrBlank()) {
                remove(PendingVerificationEmailKey)
            } else {
                putString(PendingVerificationEmailKey, email.trim())
            }
        }.apply()
    }

    fun getPendingVerificationEmail(): String? {
        ensureInitialized()
        return prefs.getString(PendingVerificationEmailKey, null)
    }

    fun clearPendingVerificationEmail() {
        ensureInitialized()
        prefs.edit().remove(PendingVerificationEmailKey).apply()
    }

    fun resetForTesting() {
        requireDebugBuildForTestingReset()

        if (::prefs.isInitialized) {
            prefs.edit().clear().commit()
        }

        sessionToken = null
        sessionUserId = null
        accessTokenState.value = null
    }

    private fun requireDebugBuildForTestingReset() {
        check(BuildConfig.DEBUG) {
            "AuthSessionStore.resetForTesting() is only available in debug/e2e test builds."
        }
    }

    private fun ensureInitialized() {
        check(::prefs.isInitialized) {
            "AuthSessionStore must be initialized before use."
        }
    }

    private fun extractUserIdFromAccessToken(token: String?): String? {
        val payload = token
            ?.split('.')
            ?.getOrNull(1)
            ?: return null
        return runCatching {
            val decoded = Base64.decode(payload, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
            JSONObject(String(decoded, Charsets.UTF_8))
                .optString("userId")
                .trim()
                .takeIf { it.isNotBlank() }
        }.getOrNull()
    }
}
