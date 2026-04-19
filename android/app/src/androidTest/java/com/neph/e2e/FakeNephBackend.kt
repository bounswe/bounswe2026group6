package com.neph.e2e

import android.net.Uri
import android.util.Log
import com.neph.core.network.ApiException
import mockwebserver3.Dispatcher
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.RecordedRequest
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

private const val FakeBackendPort = 13006
private const val ApiPathPrefix = "/api"

data class FakeProfileState(
    var firstName: String = "",
    var lastName: String = "",
    var phoneNumber: String? = null,
    var age: Int? = null,
    var gender: String? = null,
    var height: Double? = null,
    var weight: Double? = null,
    var bloodType: String? = null,
    var medicalConditions: List<String> = emptyList(),
    var chronicDiseases: List<String> = emptyList(),
    var allergies: List<String> = emptyList(),
    var country: String? = null,
    var city: String? = null,
    var address: String? = null,
    var locationSharingEnabled: Boolean = false,
    var profession: String? = null,
    var expertiseAreas: List<String> = emptyList()
)

private data class FakeUserState(
    val userId: String = "user-1",
    var email: String,
    var password: String,
    var verified: Boolean,
    var accessToken: String = "access-token-1",
    var profile: FakeProfileState? = null
)

class FakeNephBackend {
    private var server: MockWebServer? = null
    private var userState: FakeUserState? = null

    fun start() {
        if (server != null) return
        val nextServer = MockWebServer().apply {
            dispatcher = object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse {
                    return handleHttpRequest(request)
                }
            }
            start(FakeBackendPort)
        }
        server = nextServer
    }

    fun shutdown() {
        server?.close()
        server = null
    }

    @Synchronized
    fun reset() {
        userState = null
    }

    @Synchronized
    fun seedVerifiedUser(
        email: String,
        password: String,
        profile: FakeProfileState? = null
    ) {
        userState = FakeUserState(
            email = email.trim(),
            password = password,
            verified = true,
            profile = profile
        )
    }

    private fun handleHttpRequest(request: RecordedRequest): MockResponse {
        val pathWithQuery = request.fakeBackendPathWithQuery()
        val method = request.method
        val token = request.headers["Authorization"]
            ?.removePrefix("Bearer")
            ?.trim()
            ?.takeIf { it.isNotBlank() }
        val body = request.jsonBody()

        return try {
            val payload = handle(pathWithQuery, method, body, token)
            jsonResponse(payload)
        } catch (error: ApiException) {
            jsonResponse(
                JSONObject()
                    .put("message", error.message)
                    .putNullable("code", error.code),
                status = error.status.takeIf { it > 0 } ?: 500
            )
        } catch (error: Exception) {
            Log.w("FakeNephBackend", "Unhandled fake backend failure", error)
            jsonResponse(
                JSONObject()
                    .put("message", error.message ?: "Unhandled fake backend failure")
                    .put("code", "UNHANDLED_FAKE_BACKEND_FAILURE"),
                status = 500
            )
        }
    }

    @Synchronized
    private fun handle(
        path: String,
        method: String,
        body: JSONObject?,
        token: String?
    ): JSONObject {
        Log.d("FakeNephBackend", "handle $method $path token=${token.orEmpty()}")
        val uri = Uri.parse(path)
        val route = uri.path.orEmpty()

        return when {
            route == "/auth/signup" && method == "POST" -> handleSignup(body)
            route == "/auth/verify-email" && method == "GET" -> handleVerifyEmail(uri)
            route == "/auth/login" && method == "POST" -> handleLogin(body)
            route == "/auth/resend-verification" && method == "POST" -> handleResendVerification(body)
            route == "/auth/forgot-password" && method == "POST" -> handleForgotPassword(body)
            route == "/auth/reset-password" && method == "POST" -> handleResetPassword(body)
            route == "/auth/me" && method == "GET" -> handleCurrentUser(token)
            route == "/profiles/me" && method == "GET" -> handleGetProfile(token)
            route == "/profiles/me" && method == "PATCH" -> handlePatchProfile(token, body)
            route == "/profiles/me/physical" && method == "PATCH" -> handlePatchPhysical(token, body)
            route == "/profiles/me/health" && method == "PATCH" -> handlePatchHealth(token, body)
            route == "/profiles/me/location" && method == "PATCH" -> handlePatchLocation(token, body)
            route == "/profiles/me/privacy" && method == "PATCH" -> handlePatchPrivacy(token, body)
            route == "/profiles/me/profession" && method == "PATCH" -> handlePatchProfession(token, body)
            route == "/profiles/me/expertise-areas" && method == "PUT" -> handlePutExpertise(token, body)
            route == "/availability/status" && method == "GET" -> handleAvailabilityStatus(token)
            route == "/availability/my-assignment" && method == "GET" -> handleCurrentAssignment(token)
            route == "/help-requests" && method == "GET" -> handleHelpRequestList(token)
            else -> throw ApiException(
                message = "Unhandled fake backend request: $method $path",
                status = 500,
                code = "UNHANDLED_FAKE_ROUTE"
            )
        }
    }

    private fun handleSignup(body: JSONObject?): JSONObject {
        val email = body.requiredString("email").trim()
        val password = body.requiredString("password")

        if (userState?.email.equals(email, ignoreCase = true)) {
            throw ApiException("Email already exists", 409, "EMAIL_ALREADY_EXISTS")
        }

        userState = FakeUserState(
            email = email,
            password = password,
            verified = false,
            profile = FakeProfileState()
        )

        return JSONObject()
            .put("message", "User created successfully. Please check your email to verify your account.")
            .put("user", currentUserJson(requireUser()))
    }

    private fun handleVerifyEmail(uri: Uri): JSONObject {
        val token = uri.getQueryParameter("token").orEmpty()
        if (token.isBlank()) {
            throw ApiException("Invalid or expired verification token", 400, "INVALID_VERIFICATION_TOKEN")
        }

        val user = requireUser()
        user.verified = true
        return JSONObject()
            .put("message", "Email verified successfully")
            .put("accessToken", user.accessToken)
            .put("user", currentUserJson(user))
    }

    private fun handleLogin(body: JSONObject?): JSONObject {
        val user = requireUser()
        val email = body.requiredString("email").trim()
        val password = body.requiredString("password")

        if (!email.equals(user.email, ignoreCase = true) || password != user.password) {
            throw ApiException("Invalid email or password", 401, "INVALID_CREDENTIALS")
        }

        if (!user.verified) {
            throw ApiException("Email is not verified", 401, "EMAIL_NOT_VERIFIED")
        }

        return JSONObject()
            .put("message", "Login successful")
            .put("accessToken", user.accessToken)
            .put("user", currentUserJson(user))
    }

    private fun handleResendVerification(body: JSONObject?): JSONObject {
        val user = requireUser()
        val email = body.requiredString("email").trim()
        if (!email.equals(user.email, ignoreCase = true)) {
            throw ApiException("User not found", 400, "USER_NOT_FOUND")
        }

        return JSONObject().put("message", "Verification email sent. Please check your inbox.")
    }

    private fun handleForgotPassword(body: JSONObject?): JSONObject {
        val user = requireUser()
        val email = body.requiredString("email").trim()
        if (!email.equals(user.email, ignoreCase = true)) {
            throw ApiException("User not found", 404, "USER_NOT_FOUND")
        }

        return JSONObject().put("message", "Password reset email sent. Please check your inbox.")
    }

    private fun handleResetPassword(body: JSONObject?): JSONObject {
        val token = body.requiredString("token").trim()
        if (token.isBlank()) {
            throw ApiException("Invalid reset token", 400, "INVALID_RESET_TOKEN")
        }

        val user = requireUser()
        user.password = body.requiredString("newPassword")

        return JSONObject().put(
            "message",
            "Password reset successfully. You can now log in with your new password."
        )
    }

    private fun handleCurrentUser(token: String?): JSONObject {
        return currentUserJson(requireAuthorizedUser(token))
    }

    private fun handleGetProfile(token: String?): JSONObject {
        val user = requireAuthorizedUser(token)
        val profile = user.profile ?: throw ApiException("Profile not found", 404, "PROFILE_NOT_FOUND")
        return profileResponseJson(user, profile)
    }

    private fun handlePatchProfile(token: String?, body: JSONObject?): JSONObject {
        val user = requireAuthorizedUser(token)
        val profile = ensureProfile(user)
        profile.firstName = body.requiredString("firstName")
        profile.lastName = body.requiredString("lastName")
        profile.phoneNumber = body.optStringOrNull("phoneNumber")
        return profileResponseJson(user, profile)
    }

    private fun handlePatchPhysical(token: String?, body: JSONObject?): JSONObject {
        val user = requireAuthorizedUser(token)
        val profile = ensureProfile(user)
        profile.age = body.optIntOrNull("age")
        profile.gender = body.optStringOrNull("gender")
        profile.height = body.optDoubleOrNull("height")
        profile.weight = body.optDoubleOrNull("weight")
        return profileResponseJson(user, profile)
    }

    private fun handlePatchHealth(token: String?, body: JSONObject?): JSONObject {
        val user = requireAuthorizedUser(token)
        val profile = ensureProfile(user)
        profile.medicalConditions = body.optStringList("medicalConditions")
        profile.chronicDiseases = body.optStringList("chronicDiseases")
        profile.allergies = body.optStringList("allergies")
        profile.bloodType = body.optStringOrNull("bloodType")
        return profileResponseJson(user, profile)
    }

    private fun handlePatchLocation(token: String?, body: JSONObject?): JSONObject {
        val user = requireAuthorizedUser(token)
        val profile = ensureProfile(user)
        profile.country = body.optStringOrNull("country")
        profile.city = body.optStringOrNull("city")
        profile.address = body.optStringOrNull("address")
        return profileResponseJson(user, profile)
    }

    private fun handlePatchPrivacy(token: String?, body: JSONObject?): JSONObject {
        val user = requireAuthorizedUser(token)
        val profile = ensureProfile(user)
        profile.locationSharingEnabled = body?.optBoolean("locationSharingEnabled")
            ?: profile.locationSharingEnabled
        return profileResponseJson(user, profile)
    }

    private fun handlePatchProfession(token: String?, body: JSONObject?): JSONObject {
        val user = requireAuthorizedUser(token)
        val profile = ensureProfile(user)
        profile.profession = body.optStringOrNull("profession")
        return profileResponseJson(user, profile)
    }

    private fun handlePutExpertise(token: String?, body: JSONObject?): JSONObject {
        val user = requireAuthorizedUser(token)
        val profile = ensureProfile(user)
        profile.expertiseAreas = body.optStringList("expertiseAreas")
        return profileResponseJson(user, profile)
    }

    private fun handleAvailabilityStatus(token: String?): JSONObject {
        requireAuthorizedUser(token)
        return JSONObject()
            .put("isAvailable", false)
            .put("assignment", JSONObject.NULL)
    }

    private fun handleCurrentAssignment(token: String?): JSONObject {
        requireAuthorizedUser(token)
        return JSONObject().put("assignment", JSONObject.NULL)
    }

    private fun handleHelpRequestList(token: String?): JSONObject {
        requireAuthorizedUser(token)
        return JSONObject().put("requests", JSONArray())
    }

    private fun profileResponseJson(user: FakeUserState, profile: FakeProfileState): JSONObject {
        val expertiseArray = JSONArray()
        if (!profile.profession.isNullOrBlank() || profile.expertiseAreas.isNotEmpty()) {
            expertiseArray.put(
                JSONObject()
                    .put("expertiseId", "expertise-1")
                    .put("profession", profile.profession)
                    .put("expertiseArea", profile.expertiseAreas.firstOrNull())
                    .put("expertiseAreas", JSONArray(profile.expertiseAreas))
                    .put("isVerified", false)
            )
        }

        return JSONObject()
            .put(
                "profile",
                JSONObject()
                    .put("profileId", "profile-1")
                    .put("userId", user.userId)
                    .put("firstName", profile.firstName)
                    .put("lastName", profile.lastName)
                    .put("phoneNumber", profile.phoneNumber)
            )
            .put(
                "privacySettings",
                JSONObject()
                    .put("profileVisibility", "PRIVATE")
                    .put("healthInfoVisibility", "PRIVATE")
                    .put("locationVisibility", "PRIVATE")
                    .put("locationSharingEnabled", profile.locationSharingEnabled)
            )
            .put(
                "healthInfo",
                JSONObject()
                    .put("medicalConditions", JSONArray(profile.medicalConditions))
                    .put("chronicDiseases", JSONArray(profile.chronicDiseases))
                    .put("allergies", JSONArray(profile.allergies))
                    .put("medications", JSONArray())
                    .put("bloodType", profile.bloodType)
            )
            .put(
                "physicalInfo",
                JSONObject()
                    .put("age", profile.age)
                    .put("gender", profile.gender)
                    .put("height", profile.height)
                    .put("weight", profile.weight)
            )
            .put(
                "locationProfile",
                JSONObject()
                    .put("address", profile.address)
                    .put("city", profile.city)
                    .put("country", profile.country)
                    .put("latitude", JSONObject.NULL)
                    .put("longitude", JSONObject.NULL)
                    .put("lastUpdated", "2026-04-19T00:00:00Z")
            )
            .put("expertise", expertiseArray)
    }

    private fun currentUserJson(user: FakeUserState): JSONObject {
        return JSONObject()
            .put("userId", user.userId)
            .put("email", user.email)
            .put("isEmailVerified", user.verified)
            .put("acceptedTerms", true)
            .put("isAdmin", false)
            .put("adminRole", JSONObject.NULL)
    }

    private fun requireUser(): FakeUserState {
        return userState ?: throw ApiException(
            "Fake user must be initialized before handling requests.",
            500,
            "FAKE_USER_NOT_INITIALIZED"
        )
    }

    private fun requireAuthorizedUser(token: String?): FakeUserState {
        val user = requireUser()
        if (token.isNullOrBlank() || token != user.accessToken) {
            throw ApiException("Unauthorized", 401, "UNAUTHORIZED")
        }
        return user
    }

    private fun ensureProfile(user: FakeUserState): FakeProfileState {
        val existing = user.profile
        if (existing != null) {
            return existing
        }

        val created = FakeProfileState()
        user.profile = created
        return created
    }
}

private fun RecordedRequest.fakeBackendPathWithQuery(): String {
    val encodedPath = url.encodedPath
    val appPath = if (encodedPath == ApiPathPrefix) {
        "/"
    } else {
        encodedPath.removePrefix(ApiPathPrefix).ifBlank { "/" }
    }
    val encodedQuery = url.encodedQuery
    return if (encodedQuery.isNullOrBlank()) appPath else "$appPath?$encodedQuery"
}

private fun RecordedRequest.jsonBody(): JSONObject? {
    val raw = body?.utf8()?.trim().orEmpty()
    if (raw.isBlank()) return null
    return try {
        JSONObject(raw)
    } catch (_: JSONException) {
        throw ApiException("Invalid JSON request body", 400, "INVALID_JSON")
    }
}

private fun jsonResponse(body: JSONObject, status: Int = 200): MockResponse {
    return MockResponse.Builder()
        .code(status)
        .setHeader("Content-Type", "application/json; charset=utf-8")
        .body(body.toString())
        .build()
}

private fun JSONObject?.requiredString(key: String): String {
    val json = this ?: throw ApiException("Missing request body", 400, "VALIDATION_ERROR")
    val value = json.optString(key).trim()
    if (value.isBlank()) {
        throw ApiException("Missing $key", 400, "VALIDATION_ERROR")
    }
    return value
}

private fun JSONObject?.optStringOrNull(key: String): String? {
    if (this == null || isNull(key)) {
        return null
    }

    return optString(key).trim().ifBlank { null }
}

private fun JSONObject?.optStringList(key: String): List<String> {
    val json = this ?: return emptyList()
    val array = json.optJSONArray(key) ?: return emptyList()
    return buildList {
        for (index in 0 until array.length()) {
            val value = array.optString(index).trim()
            if (value.isNotBlank()) {
                add(value)
            }
        }
    }
}

private fun JSONObject?.optIntOrNull(key: String): Int? {
    if (this == null || isNull(key)) {
        return null
    }

    return optInt(key)
}

private fun JSONObject?.optDoubleOrNull(key: String): Double? {
    if (this == null || isNull(key)) {
        return null
    }

    return optDouble(key)
}

private fun JSONObject.putNullable(key: String, value: String?): JSONObject {
    return put(key, value ?: JSONObject.NULL)
}
