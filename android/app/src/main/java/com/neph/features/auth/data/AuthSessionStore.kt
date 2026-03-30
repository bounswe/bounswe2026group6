package com.neph.features.auth.data

import android.content.Context
import android.content.SharedPreferences

object AuthSessionStore {
    private const val PrefsName = "neph_auth"
    private const val AccessTokenKey = "access_token"
    private const val PendingVerificationEmailKey = "pending_verification_email"

    private lateinit var prefs: SharedPreferences
    private var sessionToken: String? = null

    fun initialize(context: Context) {
        if (!::prefs.isInitialized) {
            prefs = context.applicationContext.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            sessionToken = prefs.getString(AccessTokenKey, null)
        }
    }

    fun getAccessToken(): String? {
        ensureInitialized()
        return sessionToken ?: prefs.getString(AccessTokenKey, null)
    }

    fun saveAccessToken(token: String, rememberMe: Boolean) {
        ensureInitialized()
        sessionToken = token
        prefs.edit().apply {
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
        prefs.edit().remove(AccessTokenKey).apply()
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

    private fun ensureInitialized() {
        check(::prefs.isInitialized) {
            "AuthSessionStore must be initialized before use."
        }
    }
}
