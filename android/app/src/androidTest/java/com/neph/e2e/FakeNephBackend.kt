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
import java.time.Instant
import java.util.Locale

private const val FakeBackendPort = 13006
private const val ApiPathPrefix = "/api"
private val IsoAlpha2CountryCodePattern = Regex("^[A-Za-z]{2}$")
private val LocationPatchAllowedKeys = setOf(
    "address",
    "city",
    "country",
    "latitude",
    "longitude",
    "displayAddress",
    "placeId",
    "administrative",
    "coordinate"
)

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
    var displayAddress: String? = null,
    var countryCode: String? = null,
    var district: String? = null,
    var neighborhood: String? = null,
    var extraAddress: String? = null,
    var postalCode: String? = null,
    var placeId: String? = null,
    var latitude: Double? = null,
    var longitude: Double? = null,
    var locationLastUpdated: String? = null,
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

private object MissingJsonField

private data class NormalizedLocationPatch(
    val address: String?,
    val displayAddress: String?,
    val city: String?,
    val country: String?,
    val countryCode: String?,
    val district: String?,
    val neighborhood: String?,
    val extraAddress: String?,
    val postalCode: String?,
    val placeId: String?,
    val latitude: Double?,
    val longitude: Double?
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
            route == "/help-requests/active" && method == "GET" -> handleActiveHelpRequests(uri)
            route == "/location/tree" && method == "GET" -> handleLocationTree(uri)
            route == "/gathering-areas/nearby" && method == "GET" -> handleNearbyGatheringAreas(uri)
            else -> throw ApiException(
                message = "Unhandled fake backend request: $method $path",
                status = 500,
                code = "UNHANDLED_FAKE_ROUTE"
            )
        }
    }

    private fun handleNearbyGatheringAreas(uri: Uri): JSONObject {
        val lat = uri.getQueryParameter("lat")?.toDoubleOrNull()
            ?: throw ApiException("lat must be a number between -90 and 90", 400, "VALIDATION_ERROR")
        val lon = uri.getQueryParameter("lon")?.toDoubleOrNull()
            ?: throw ApiException("lon must be a number between -180 and 180", 400, "VALIDATION_ERROR")

        if (lat !in -90.0..90.0) {
            throw ApiException("lat must be a number between -90 and 90", 400, "VALIDATION_ERROR")
        }

        if (lon !in -180.0..180.0) {
            throw ApiException("lon must be a number between -180 and 180", 400, "VALIDATION_ERROR")
        }

        val radius = (uri.getQueryParameter("radius")?.toIntOrNull() ?: 2000).coerceIn(1, 10_000)
        val limit = (uri.getQueryParameter("limit")?.toIntOrNull() ?: 20).coerceIn(1, 50)

        val features = JSONArray().apply {
            put(
                JSONObject()
                    .put("type", "Feature")
                    .put(
                        "geometry",
                        JSONObject()
                            .put("type", "Point")
                            .put("coordinates", JSONArray().put(lon + 0.0012).put(lat + 0.0009))
                    )
                    .put(
                        "properties",
                        JSONObject()
                            .put("id", "fake-ga-1")
                            .put("osmType", "node")
                            .put("name", "Local Assembly Point")
                            .put("category", "assembly_point")
                            .put("distanceMeters", 180)
                            .put(
                                "rawTags",
                                JSONObject()
                                    .put("name", "Local Assembly Point")
                                    .put("addr:street", "Ataturk Blvd")
                            )
                    )
            )

            put(
                JSONObject()
                    .put("type", "Feature")
                    .put(
                        "geometry",
                        JSONObject()
                            .put("type", "Point")
                            .put("coordinates", JSONArray().put(lon - 0.0021).put(lat - 0.0015))
                    )
                    .put(
                        "properties",
                        JSONObject()
                            .put("id", "fake-ga-2")
                            .put("osmType", "node")
                            .put("name", "Community Shelter")
                            .put("category", "shelter")
                            .put("distanceMeters", 360)
                            .put(
                                "rawTags",
                                JSONObject()
                                    .put("name", "Community Shelter")
                                    .put("description", "Municipal sports hall")
                            )
                    )
            )
        }

        return JSONObject()
            .put("center", JSONObject().put("lat", lat).put("lon", lon))
            .put("radius", radius)
            .put("source", "overpass")
            .put(
                "meta",
                JSONObject()
                    .put("requestedLimit", limit)
                    .put("returnedCount", minOf(limit, features.length()))
            )
            .put(
                "collection",
                JSONObject()
                    .put("type", "FeatureCollection")
                    .put("features", JSONArray().apply {
                        for (i in 0 until minOf(limit, features.length())) {
                            put(features.getJSONObject(i))
                        }
                    })
            )
    }

    private fun handleActiveHelpRequests(uri: Uri): JSONObject {
        val status = uri.getQueryParameter("status").orEmpty().uppercase(Locale.ROOT).ifBlank { "PENDING" }
        if (status != "PENDING") {
            throw ApiException("`status` contains invalid values: $status.", 400, "VALIDATION_FAILED")
        }

        val limit = (uri.getQueryParameter("limit")?.toIntOrNull() ?: 300).coerceIn(1, 300)
        val offset = (uri.getQueryParameter("offset")?.toIntOrNull() ?: 0).coerceAtLeast(0)

        val allRequests = JSONArray().apply {
            put(
                JSONObject()
                    .put("requestId", "fake-map-first-aid")
                    .put("type", "first_aid")
                    .put("status", "PENDING")
                    .put("urgencyLevel", "HIGH")
                    .put("createdAt", "2026-05-01T10:15:00.000Z")
                    .put("assignmentState", "UNASSIGNED")
                    .put(
                        "location",
                        JSONObject()
                            .put("latitude", 41.043)
                            .put("longitude", 29.009)
                            .put("city", "istanbul")
                            .put("district", "besiktas")
                    )
            )
            put(
                JSONObject()
                    .put("requestId", "fake-map-shelter")
                    .put("type", "shelter")
                    .put("status", "PENDING")
                    .put("urgencyLevel", "MEDIUM")
                    .put("createdAt", "2026-05-01T10:05:00.000Z")
                    .put("assignmentState", "UNASSIGNED")
                    .put(
                        "location",
                        JSONObject()
                            .put("latitude", 41.066)
                            .put("longitude", 28.993)
                            .put("city", "istanbul")
                            .put("district", "sisli")
                    )
            )
            put(
                JSONObject()
                    .put("requestId", "fake-map-assigned")
                    .put("type", "search_and_rescue")
                    .put("status", "PENDING")
                    .put("urgencyLevel", "HIGH")
                    .put("createdAt", "2026-05-01T09:55:00.000Z")
                    .put("assignmentState", "ASSIGNED")
                    .put(
                        "location",
                        JSONObject()
                            .put("latitude", 41.079)
                            .put("longitude", 29.022)
                            .put("city", "istanbul")
                            .put("district", "sariyer")
                    )
            )
        }

        return JSONObject()
            .put("requests", JSONArray().apply {
                for (index in offset until minOf(offset + limit, allRequests.length())) {
                    put(allRequests.getJSONObject(index))
                }
            })
            .put("total", allRequests.length())
            .put("pagination", JSONObject().put("limit", limit).put("offset", offset))
    }

    private fun handleLocationTree(uri: Uri): JSONObject {
        val countryCode = uri.getQueryParameter("countryCode").orEmpty().uppercase().ifBlank { "TR" }
        if (countryCode != "TR") {
            throw ApiException("No location tree found for countryCode", 404, "NOT_FOUND")
        }

        return JSONObject()
            .put("countryCode", "TR")
            .put(
                "tree",
                JSONObject().put(
                    "TR",
                    JSONObject()
                        .put("label", "Turkey")
                        .put(
                            "cities",
                            JSONObject()
                                .put(
                                    "istanbul",
                                    JSONObject()
                                        .put("label", "Istanbul")
                                        .put(
                                            "districts",
                                            JSONObject()
                                                .put(
                                                    "kadikoy",
                                                    JSONObject()
                                                        .put("label", "Kadıköy")
                                                        .put(
                                                            "neighborhoods",
                                                            JSONArray()
                                                                .put(JSONObject().put("label", "Bostancı").put("value", "bostanci"))
                                                                .put(JSONObject().put("label", "Erenköy").put("value", "erenkoy"))
                                                        )
                                                )
                                                .put(
                                                    "besiktas",
                                                    JSONObject()
                                                        .put("label", "Beşiktaş")
                                                        .put(
                                                            "neighborhoods",
                                                            JSONArray()
                                                                .put(JSONObject().put("label", "Balmumcu").put("value", "balmumcu"))
                                                                .put(JSONObject().put("label", "Kuruçeşme").put("value", "kurucesme"))
                                                        )
                                                )
                                        )
                                )
                                .put(
                                    "ankara",
                                    JSONObject()
                                        .put("label", "Ankara")
                                        .put(
                                            "districts",
                                            JSONObject()
                                                .put(
                                                    "cankaya",
                                                    JSONObject()
                                                        .put("label", "Çankaya")
                                                        .put(
                                                            "neighborhoods",
                                                            JSONArray()
                                                                .put(JSONObject().put("label", "Anıttepe").put("value", "anittepe"))
                                                        )
                                                )
                                        )
                                )
                        )
                )
            )
            .put(
                "meta",
                JSONObject()
                    .put("cityCount", 2)
                    .put("districtCount", 3)
                    .put("neighborhoodCount", 5)
            )
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
        val payload = body ?: JSONObject()

        validateLocationPatchPayload(payload)

        val administrative = payload.optJSONObject("administrative")
        val coordinate = payload.optJSONObject("coordinate")

        val hasAddress =
            payload.has("address") ||
                payload.has("displayAddress") ||
                administrative.hasOwn("neighborhood") ||
                administrative.hasOwn("district") ||
                administrative.hasOwn("extraAddress")
        val hasDisplayAddress = hasAddress || payload.has("displayAddress")
        val hasCity = payload.has("city") || administrative.hasOwn("city")
        val hasCountry = payload.has("country") || administrative.hasOwn("country")
        val hasCountryCode = administrative.hasOwn("countryCode")
        val hasDistrict = administrative.hasOwn("district")
        val hasNeighborhood = administrative.hasOwn("neighborhood")
        val hasExtraAddress = administrative.hasOwn("extraAddress")
        val hasPostalCode = administrative.hasOwn("postalCode")
        val hasPlaceId = payload.has("placeId")
        val hasLatitude = payload.has("latitude") || coordinate.hasOwn("latitude")
        val hasLongitude = payload.has("longitude") || coordinate.hasOwn("longitude")

        val normalized = normalizeLocationPatch(payload, administrative, coordinate)

        if (hasAddress) {
            profile.address = normalized.address
        }
        if (hasDisplayAddress) {
            profile.displayAddress = normalized.displayAddress
        }
        if (hasCity) {
            profile.city = normalized.city
        }
        if (hasCountry) {
            profile.country = normalized.country
        }
        if (hasCountryCode) {
            profile.countryCode = normalized.countryCode
        }
        if (hasDistrict) {
            profile.district = normalized.district
        }
        if (hasNeighborhood) {
            profile.neighborhood = normalized.neighborhood
        }
        if (hasExtraAddress) {
            profile.extraAddress = normalized.extraAddress
        }
        if (hasPostalCode) {
            profile.postalCode = normalized.postalCode
        }
        if (hasPlaceId) {
            profile.placeId = normalized.placeId
        }
        if (hasLatitude) {
            profile.latitude = normalized.latitude
        }
        if (hasLongitude) {
            profile.longitude = normalized.longitude
        }

        if (
            hasAddress || hasDisplayAddress || hasCity || hasCountry || hasCountryCode || hasDistrict ||
                hasNeighborhood || hasExtraAddress || hasPostalCode || hasPlaceId || hasLatitude || hasLongitude
        ) {
            profile.locationLastUpdated = Instant.now().toString()
        }

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
                    .putNullable("address", profile.address)
                    .putNullable("displayAddress", profile.displayAddress ?: profile.address)
                    .putNullable("city", profile.city)
                    .putNullable("country", profile.country)
                    .put(
                        "administrative",
                        JSONObject()
                            .putNullable("countryCode", profile.countryCode)
                            .putNullable("country", profile.country)
                            .putNullable("city", profile.city)
                            .putNullable("district", profile.district)
                            .putNullable("neighborhood", profile.neighborhood)
                            .putNullable("extraAddress", profile.extraAddress)
                            .putNullable("postalCode", profile.postalCode)
                    )
                    .putNullable("placeId", profile.placeId)
                    .putNullable("latitude", profile.latitude)
                    .putNullable("longitude", profile.longitude)
                    .put(
                        "coordinate",
                        if (profile.latitude == null || profile.longitude == null) {
                            JSONObject.NULL
                        } else {
                            JSONObject()
                                .put("latitude", profile.latitude)
                                .put("longitude", profile.longitude)
                                .put("accuracyMeters", JSONObject.NULL)
                                .put("source", JSONObject.NULL)
                                .put("capturedAt", profile.locationLastUpdated ?: "2026-04-19T00:00:00Z")
                        }
                    )
                    .put("lastUpdated", profile.locationLastUpdated ?: "2026-04-19T00:00:00Z")
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

private fun buildAdministrativeAddress(administrative: JSONObject?): String? {
    if (administrative == null) {
        return null
    }

    return listOf(
        administrative.optStringOrNull("neighborhood"),
        administrative.optStringOrNull("district"),
        administrative.optStringOrNull("extraAddress")
    )
        .mapNotNull { it?.trim()?.takeIf(String::isNotBlank) }
        .joinToString(", ")
        .ifBlank { null }
}

private fun normalizeLocationPatch(
    payload: JSONObject,
    administrative: JSONObject?,
    coordinate: JSONObject?
): NormalizedLocationPatch {
    val fallbackAddress = buildAdministrativeAddress(administrative)

    val displayAddressValue = selectNullish(
        payload.fieldOrMissing("displayAddress"),
        payload.fieldOrMissing("address"),
        fallbackAddress
    )
    val addressValue = selectNullish(
        payload.fieldOrMissing("address"),
        payload.fieldOrMissing("displayAddress"),
        fallbackAddress
    )
    val cityValue = selectNullish(
        payload.fieldOrMissing("city"),
        administrative.fieldOrMissing("city")
    )
    val countryValue = selectNullish(
        payload.fieldOrMissing("country"),
        administrative.fieldOrMissing("country")
    )
    val countryCodeValue = administrative.fieldOrMissing("countryCode")
    val districtValue = administrative.fieldOrMissing("district")
    val neighborhoodValue = administrative.fieldOrMissing("neighborhood")
    val extraAddressValue = administrative.fieldOrMissing("extraAddress")
    val postalCodeValue = administrative.fieldOrMissing("postalCode")
    val placeIdValue = payload.fieldOrMissing("placeId")
    val latitudeValue = selectNullish(
        payload.fieldOrMissing("latitude"),
        coordinate.fieldOrMissing("latitude")
    )
    val longitudeValue = selectNullish(
        payload.fieldOrMissing("longitude"),
        coordinate.fieldOrMissing("longitude")
    )

    return NormalizedLocationPatch(
        address = normalizeOptionalString(addressValue),
        displayAddress = normalizeOptionalString(displayAddressValue),
        city = normalizeOptionalString(cityValue),
        country = normalizeOptionalString(countryValue),
        countryCode = normalizeOptionalString(countryCodeValue, uppercase = true),
        district = normalizeOptionalString(districtValue),
        neighborhood = normalizeOptionalString(neighborhoodValue),
        extraAddress = normalizeOptionalString(extraAddressValue),
        postalCode = normalizeOptionalString(postalCodeValue),
        placeId = normalizeOptionalString(placeIdValue),
        latitude = normalizeOptionalDouble(latitudeValue),
        longitude = normalizeOptionalDouble(longitudeValue)
    )
}

private fun validateLocationPatchPayload(payload: JSONObject) {
    val hasKnownField = jsonKeys(payload).any { LocationPatchAllowedKeys.contains(it) }
    if (!hasKnownField) {
        throw ApiException(
            message = "At least one location field must be provided",
            status = 400,
            code = "VALIDATION_ERROR"
        )
    }

    if (payload.has("administrative") && payload.optJSONObject("administrative") == null) {
        throw ApiException(
            message = "administrative must be an object",
            status = 400,
            code = "VALIDATION_ERROR"
        )
    }

    if (payload.has("coordinate") && payload.optJSONObject("coordinate") == null) {
        throw ApiException(
            message = "coordinate must be an object",
            status = 400,
            code = "VALIDATION_ERROR"
        )
    }

    val administrative = payload.optJSONObject("administrative")
    val coordinate = payload.optJSONObject("coordinate")

    validateFlatCoordinatePair(payload)
    validateFlatCoordinateRanges(payload)
    validateLocationStringFields(payload)
    validateCoordinateObject(payload, coordinate)
    validateAdministrativeObject(administrative)
}

private fun validateFlatCoordinatePair(payload: JSONObject) {
    val latitudeProvided = payload.has("latitude")
    val longitudeProvided = payload.has("longitude")
    if (latitudeProvided != longitudeProvided) {
        throw ApiException(
            message = "latitude and longitude must be provided together",
            status = 400,
            code = "VALIDATION_ERROR"
        )
    }
}

private fun validateFlatCoordinateRanges(payload: JSONObject) {
    if (payload.has("latitude") && !payload.isNull("latitude")) {
        val latitude = payload.opt("latitude")
        if (latitude !is Number || latitude.toDouble() !in -90.0..90.0) {
            throw ApiException(
                message = "latitude must be between -90 and 90",
                status = 400,
                code = "VALIDATION_ERROR"
            )
        }
    }

    if (payload.has("longitude") && !payload.isNull("longitude")) {
        val longitude = payload.opt("longitude")
        if (longitude !is Number || longitude.toDouble() !in -180.0..180.0) {
            throw ApiException(
                message = "longitude must be between -180 and 180",
                status = 400,
                code = "VALIDATION_ERROR"
            )
        }
    }
}

private fun validateLocationStringFields(payload: JSONObject) {
    for (field in listOf("address", "city", "country", "displayAddress", "placeId")) {
        if (payload.has(field) && !payload.isNull(field) && payload.opt(field) !is String) {
            throw ApiException(
                message = "$field must be a string or null",
                status = 400,
                code = "VALIDATION_ERROR"
            )
        }
    }
}

private fun validateCoordinateObject(payload: JSONObject, coordinate: JSONObject?) {
    if (coordinate == null) {
        return
    }

    val coordinateHasLatitude = coordinate.has("latitude")
    val coordinateHasLongitude = coordinate.has("longitude")
    if (coordinateHasLatitude != coordinateHasLongitude) {
        throw ApiException(
            message = "coordinate.latitude and coordinate.longitude must be provided together",
            status = 400,
            code = "VALIDATION_ERROR"
        )
    }

    if (coordinateHasLatitude && !coordinate.isNull("latitude")) {
        val latitude = coordinate.opt("latitude")
        if (latitude !is Number || latitude.toDouble() !in -90.0..90.0) {
            throw ApiException(
                message = "coordinate.latitude must be between -90 and 90",
                status = 400,
                code = "VALIDATION_ERROR"
            )
        }
    }

    if (coordinateHasLongitude && !coordinate.isNull("longitude")) {
        val longitude = coordinate.opt("longitude")
        if (longitude !is Number || longitude.toDouble() !in -180.0..180.0) {
            throw ApiException(
                message = "coordinate.longitude must be between -180 and 180",
                status = 400,
                code = "VALIDATION_ERROR"
            )
        }
    }

    if (coordinate.has("accuracyMeters") && !coordinate.isNull("accuracyMeters")) {
        val accuracyMeters = coordinate.opt("accuracyMeters")
        if (accuracyMeters !is Number || accuracyMeters.toDouble() < 0.0) {
            throw ApiException(
                message = "coordinate.accuracyMeters must be a number >= 0",
                status = 400,
                code = "VALIDATION_ERROR"
            )
        }
    }

    if (coordinate.has("source") && !coordinate.isNull("source") && coordinate.opt("source") !is String) {
        throw ApiException(
            message = "coordinate.source must be a string or null",
            status = 400,
            code = "VALIDATION_ERROR"
        )
    }

    if (coordinate.has("capturedAt") && !coordinate.isNull("capturedAt") && coordinate.opt("capturedAt") !is String) {
        throw ApiException(
            message = "coordinate.capturedAt must be a string or null",
            status = 400,
            code = "VALIDATION_ERROR"
        )
    }

    if (
        payload.has("latitude") &&
            coordinate.has("latitude") &&
            !payload.isNull("latitude") &&
            !coordinate.isNull("latitude")
    ) {
        val latitude = payload.opt("latitude") as? Number
        val coordinateLatitude = coordinate.opt("latitude") as? Number
        if (latitude != null && coordinateLatitude != null && latitude.toDouble() != coordinateLatitude.toDouble()) {
            throw ApiException(
                message = "latitude conflicts with coordinate.latitude",
                status = 400,
                code = "VALIDATION_ERROR"
            )
        }
    }

    if (
        payload.has("longitude") &&
            coordinate.has("longitude") &&
            !payload.isNull("longitude") &&
            !coordinate.isNull("longitude")
    ) {
        val longitude = payload.opt("longitude") as? Number
        val coordinateLongitude = coordinate.opt("longitude") as? Number
        if (longitude != null && coordinateLongitude != null && longitude.toDouble() != coordinateLongitude.toDouble()) {
            throw ApiException(
                message = "longitude conflicts with coordinate.longitude",
                status = 400,
                code = "VALIDATION_ERROR"
            )
        }
    }
}

private fun validateAdministrativeObject(administrative: JSONObject?) {
    if (administrative == null) {
        return
    }

    for (field in listOf("countryCode", "country", "city", "district", "neighborhood", "extraAddress", "postalCode")) {
        if (administrative.has(field) && !administrative.isNull(field) && administrative.opt(field) !is String) {
            throw ApiException(
                message = "administrative.$field must be a string or null",
                status = 400,
                code = "VALIDATION_ERROR"
            )
        }
    }

    if (administrative.has("countryCode") && !administrative.isNull("countryCode")) {
        val rawCountryCode = administrative.optString("countryCode").trim()
        if (!IsoAlpha2CountryCodePattern.matches(rawCountryCode)) {
            throw ApiException(
                message = "administrative.countryCode must be a 2-letter ISO code",
                status = 400,
                code = "VALIDATION_ERROR"
            )
        }
    }
}

private fun jsonKeys(json: JSONObject): List<String> {
    val iterator = json.keys()
    val keys = mutableListOf<String>()
    while (iterator.hasNext()) {
        keys.add(iterator.next())
    }
    return keys
}

private fun JSONObject?.hasOwn(key: String): Boolean {
    return this != null && has(key)
}

private fun JSONObject?.fieldOrMissing(key: String): Any? {
    if (this == null || !has(key)) {
        return MissingJsonField
    }

    return if (isNull(key)) null else opt(key)
}

private fun selectNullish(vararg values: Any?): Any? {
    for (value in values) {
        if (value === MissingJsonField || value == null || value == JSONObject.NULL) {
            continue
        }

        return value
    }

    return null
}

private fun normalizeOptionalString(value: Any?, uppercase: Boolean = false): String? {
    if (value !is String) {
        return null
    }

    val trimmed = value.trim()
    if (trimmed.isBlank()) {
        return null
    }

    return if (uppercase) {
        trimmed.uppercase(Locale.ROOT)
    } else {
        trimmed
    }
}

private fun normalizeOptionalDouble(value: Any?): Double? {
    return when (value) {
        is Number -> value.toDouble()
        is String -> value.trim().toDoubleOrNull()
        else -> null
    }
}

private fun JSONObject.putNullable(key: String, value: String?): JSONObject {
    return put(key, value ?: JSONObject.NULL)
}

private fun JSONObject.putNullable(key: String, value: Double?): JSONObject {
    return put(key, value ?: JSONObject.NULL)
}
