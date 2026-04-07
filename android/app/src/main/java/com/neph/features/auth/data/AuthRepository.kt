package com.neph.features.auth.data

import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
import com.neph.features.profile.data.ProfileData
import com.neph.features.profile.data.ProfileRepository
import org.json.JSONObject
import java.net.URLEncoder
import kotlinx.coroutines.CancellationException

enum class LoginDestination {
    PROFILE,
    COMPLETE_PROFILE
}

object AuthRepository {
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
        val userEmail = user?.optString("email")?.ifBlank { normalizedEmail } ?: normalizedEmail
        val canReuseLocalProfileFields = previousProfile.email
            ?.trim()
            ?.equals(userEmail, ignoreCase = true)
            ?: false

        AuthSessionStore.saveAccessToken(accessToken, rememberMe)
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
            LoginDestination.PROFILE
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (error: ApiException) {
            when (error.status) {
                404 -> {
                    AuthSessionStore.clearPendingVerificationEmail()
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
        AuthSessionStore.clearAccessToken()
        AuthSessionStore.clearPendingVerificationEmail()
        ProfileRepository.clearProfile()
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
