package com.neph.features.auth.data

import android.content.Context
import android.content.SharedPreferences
import com.neph.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

object AuthSessionStore {
    private const val PrefsName = "neph_auth"
    private const val AccessTokenKey = "access_token"
    private const val PendingVerificationEmailKey = "pending_verification_email"
    private const val GuestModeKey = "guest_mode"

    private lateinit var prefs: SharedPreferences
    private val accessTokenState = MutableStateFlow<String?>(null)
    private var sessionToken: String? = null

    fun initialize(context: Context) {
        if (!::prefs.isInitialized) {
            prefs = context.applicationContext.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            sessionToken = prefs.getString(AccessTokenKey, null)
            accessTokenState.value = sessionToken
        }
    }

    val accessTokenFlow: StateFlow<String?> = accessTokenState

    fun getAccessToken(): String? {
        ensureInitialized()
        return sessionToken ?: prefs.getString(AccessTokenKey, null)
    }

    fun saveAccessToken(token: String, rememberMe: Boolean) {
        ensureInitialized()
        sessionToken = token
        accessTokenState.value = token
        prefs.edit().apply {
            putBoolean(GuestModeKey, false)
            if (rememberMe) {
                putString(AccessTokenKey, token)
            } else {
                remove(AccessTokenKey)
            }
        }.apply()
    }

    fun clearAccessToken() {
        ensureInitialized()
        sessionToken = null
        accessTokenState.value = null
        prefs.edit().remove(AccessTokenKey).apply()
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
}
