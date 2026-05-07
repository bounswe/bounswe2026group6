package com.neph.features.auth.data

import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import com.neph.core.NephAppContext
import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.features.assignedrequest.data.AssignedRequestRepository
import com.neph.features.availability.data.AvailabilityRepository
import com.neph.features.notifications.data.PushTokenSync
import com.neph.features.notifications.data.NotificationsRepository
import com.neph.features.nearbyusers.data.NearbyVisibleUsersRepository
import com.neph.features.operationallocation.data.OperationalLocationRepository
import com.neph.features.profile.data.ProfileData
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.features.safetystatus.data.SafetyStatusRepository
import org.json.JSONObject
import java.net.URLEncoder
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

enum class LoginDestination {
    PROFILE,
    COMPLETE_PROFILE
}

object AuthRepository {
    private val ioScope = CoroutineScope(Dispatchers.IO)
    suspend fun signup(
        email: String,
        password: String,
        acceptedTerms: Boolean
    ): String {
        val normalizedEmail = email.trim()
        val response = JsonHttpClient.request(
            path = "/auth/signup",
            method = "POST",
            body = JSONObject()
                .put("email", normalizedEmail)
                .put("password", password)
                .put("acceptedTerms", acceptedTerms)
        )

        AuthSessionStore.setPendingVerificationEmail(normalizedEmail)
        ProfileRepository.clearProfile()
        ProfileRepository.saveProfile(
            ProfileData(
                email = normalizedEmail
            )
        )

        return response.optString("message").ifBlank {
            "Account created successfully. Please verify your email."
        }
    }

    suspend fun login(
        email: String,
        password: String,
        rememberMe: Boolean
    ): LoginDestination {
        val normalizedEmail = email.trim()
        val previousProfile = ProfileRepository.getProfile()
        val response = JsonHttpClient.request(
            path = "/auth/login",
            method = "POST",
            body = JSONObject()
                .put("email", normalizedEmail)
                .put("password", password)
        )

        val accessToken = response.optString("accessToken")
        if (accessToken.isBlank()) {
            throw ApiException(
                message = "Login succeeded but no access token was returned.",
                status = 200,
                code = "INVALID_RESPONSE"
            )
        }

        val user = response.optJSONObject("user")
        val userId = user?.optString("userId")?.trim().orEmpty()
        val userEmail = user?.optString("email")?.ifBlank { normalizedEmail } ?: normalizedEmail
        val canReuseLocalProfileFields = previousProfile.email
            ?.trim()
            ?.equals(userEmail, ignoreCase = true)
            ?: false

        if (!canReuseLocalProfileFields) {
            OperationalLocationRepository.clearLocalCache()
            SafetyStatusRepository.clearLocalCache()
        }

        AuthSessionStore.saveAccessToken(accessToken, rememberMe, userId = userId)
        PushTokenSync.syncCurrentToken()
        ProfileRepository.clearProfile()
        ProfileRepository.saveProfile(
            if (canReuseLocalProfileFields) {
                previousProfile.copy(email = userEmail)
            } else {
                ProfileData(email = userEmail)
            }
        )

        return try {
            ProfileRepository.fetchAndCacheRemoteProfile()
            AuthSessionStore.clearPendingVerificationEmail()
            NephAppContext.getOrNull()?.let { OfflineSyncScheduler.enqueueSync(it, reason = "login") }
            LoginDestination.PROFILE
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (error: ApiException) {
            when (error.status) {
                404 -> {
                    AuthSessionStore.clearPendingVerificationEmail()
                    NephAppContext.getOrNull()?.let { OfflineSyncScheduler.enqueueSync(it, reason = "login-without-profile") }
                    LoginDestination.COMPLETE_PROFILE
                }
                401 -> {
                    AuthSessionStore.clearAccessToken()
                    ProfileRepository.clearProfile()
                    throw error
                }
                else -> {
                    throw error
                }
            }
        } catch (error: Exception) {
            throw error
        }
    }

    suspend fun verifyEmail(tokenOrLink: String): String {
        val token = extractTokenFromLink(tokenOrLink)
        val encodedToken = URLEncoder.encode(token, Charsets.UTF_8.name())

        val response = JsonHttpClient.request(
            path = "/auth/verify-email?token=$encodedToken"
        )

        val accessToken = response.optString("accessToken")
        if (accessToken.isNotBlank()) {
            val userId = response.optJSONObject("user")?.optString("userId")?.trim().orEmpty()
            AuthSessionStore.saveAccessToken(accessToken, rememberMe = true, userId = userId)
            PushTokenSync.syncCurrentToken()
            NephAppContext.getOrNull()?.let { OfflineSyncScheduler.enqueueSync(it, reason = "email-verified") }
        }

        AuthSessionStore.clearPendingVerificationEmail()
        return response.optString("message").ifBlank { "Email verified successfully." }
    }

    suspend fun resendVerification(): String {
        val email = AuthSessionStore.getPendingVerificationEmail()
            ?: throw ApiException(
                message = "No signup email is available. Please sign up again or log in after verifying from your email.",
                status = 400,
                code = "MISSING_EMAIL"
            )

        val response = JsonHttpClient.request(
            path = "/auth/resend-verification",
            method = "POST",
            body = JSONObject().put("email", email)
        )

        return response.optString("message").ifBlank {
            "Verification email sent. Please check your inbox."
        }
    }

    suspend fun forgotPassword(email: String): String {
        val response = JsonHttpClient.request(
            path = "/auth/forgot-password",
            method = "POST",
            body = JSONObject().put("email", email.trim())
        )

        return response.optString("message").ifBlank {
            "Password reset email sent. Please check your inbox."
        }
    }

    suspend fun resetPassword(tokenOrLink: String, newPassword: String): String {
        val response = JsonHttpClient.request(
            path = "/auth/reset-password",
            method = "POST",
            body = JSONObject()
                .put("token", extractTokenFromLink(tokenOrLink))
                .put("newPassword", newPassword)
        )

        return response.optString("message").ifBlank {
            "Password reset successfully. You can now log in with your new password."
        }
    }

    fun logout() {
        val accessToken = AuthSessionStore.getAccessToken()
        if (!accessToken.isNullOrBlank()) {
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { deviceToken ->
                    ioScope.launch {
                        try {
                            NotificationsRepository.unregisterDeviceToken(accessToken, deviceToken)
                        } catch (error: Exception) {
                            Log.w("AuthRepository", "Failed to unregister FCM token on logout", error)
                        }
                    }
                }
        }

        clearLocalAuthState()
    }

    suspend fun deleteAccount(): String {
        val accessToken = AuthSessionStore.getAccessToken()
            ?: throw ApiException(
                message = "Please log in again before deleting your account.",
                status = 401,
                code = "UNAUTHORIZED"
            )

        val response = JsonHttpClient.request(
            path = "/auth/me",
            method = "DELETE",
            token = accessToken
        )

        clearLocalAuthState()
        clearDeletedAccountOfflineState()
        return response.optString("message").ifBlank { "Account deleted successfully." }
    }

    private suspend fun clearDeletedAccountOfflineState() {
        clearDeletedAccountCache("authenticated help request cache") {
            RequestHelpRepository.clearAuthenticatedLocalCache()
        }
        clearDeletedAccountCache("assigned request cache") {
            AssignedRequestRepository.clearLocalCache()
        }
        clearDeletedAccountCache("availability cache") {
            AvailabilityRepository.clearLocalCache()
        }
        clearDeletedAccountCache("operational location cache") {
            OperationalLocationRepository.clearLocalCache()
        }
        clearDeletedAccountCache("safety status cache") {
            SafetyStatusRepository.clearLocalCache()
        }
    }

    private suspend fun clearDeletedAccountCache(
        cacheName: String,
        clear: suspend () -> Unit
    ) {
        try {
            clear()
        } catch (error: Exception) {
            Log.w("AuthRepository", "Failed to clear $cacheName after account deletion", error)
        }
    }

    private fun clearLocalAuthState() {
        AuthSessionStore.clearAccessToken()
        AuthSessionStore.clearPendingVerificationEmail()
        ProfileRepository.clearProfile()
        ioScope.launch {
            try {
                NearbyVisibleUsersRepository.clearLocalCache()
            } catch (error: Exception) {
                Log.w("AuthRepository", "Failed to clear nearby visible users on logout", error)
            }
            try {
                OperationalLocationRepository.clearLocalCache()
            } catch (error: Exception) {
                Log.w("AuthRepository", "Failed to clear operational location on logout", error)
            }
            try {
                SafetyStatusRepository.clearLocalCache()
            } catch (error: Exception) {
                Log.w("AuthRepository", "Failed to clear safety status on logout", error)
            }
        }
    }

    private fun extractTokenFromLink(tokenOrLink: String): String {
        val trimmed = tokenOrLink.trim()
        if (trimmed.isBlank()) {
            throw ApiException(
                message = "Paste the link or token from your email.",
                status = 400,
                code = "VALIDATION_ERROR"
            )
        }

        val tokenPrefix = "token="
        val tokenIndex = trimmed.indexOf(tokenPrefix)
        if (tokenIndex >= 0) {
            return trimmed.substring(tokenIndex + tokenPrefix.length)
                .substringBefore('&')
                .trim()
        }

        return trimmed
    }
}
