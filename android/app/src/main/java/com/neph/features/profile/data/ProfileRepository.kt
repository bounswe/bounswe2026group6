package com.neph.features.profile.data

import android.content.Context
import android.content.SharedPreferences
import com.neph.BuildConfig
import com.neph.core.network.JsonHttpClient
import com.neph.features.auth.data.AuthSessionStore
import org.json.JSONArray
import org.json.JSONObject
import kotlinx.coroutines.CancellationException
import java.util.Locale

object ProfileRepository {
    private const val PrefsName = "neph_profile"

    private lateinit var prefs: SharedPreferences
    private var cachedProfile = ProfileData()

    internal const val LocationSharingInitializationMessage =
        "To enable Share Current Location, capture and save a valid location from your profile first."

    class LocationSharingInitializationRequiredException(
        message: String = LocationSharingInitializationMessage
    ) : IllegalStateException(message)

    fun initialize(context: Context) {
        if (!::prefs.isInitialized) {
            prefs = context.applicationContext.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            cachedProfile = readProfileFromPrefs()
        }
    }

    fun saveProfile(new: ProfileData) {
        ensureInitialized()
        cachedProfile = new
        persistProfile(new)
    }

    fun clearProfile() {
        ensureInitialized()
        cachedProfile = ProfileData()
        prefs.edit().clear().apply()
    }

    fun getProfile(): ProfileData {
        ensureInitialized()
        return cachedProfile
    }

    fun resetForTesting() {
        requireDebugBuildForTestingReset()

        cachedProfile = ProfileData()
        if (::prefs.isInitialized) {
            prefs.edit().clear().commit()
        }
    }

    private fun requireDebugBuildForTestingReset() {
        check(BuildConfig.DEBUG) {
            "ProfileRepository.resetForTesting() is only available in debug/e2e test builds."
        }
    }

    suspend fun fetchAndCacheRemoteProfile(): ProfileData {
        ensureInitialized()

        try {
            LocationTreeRepository.ensureLocationData()
        } catch (_: Exception) {
            // Keep fallback location mapping when location tree is unavailable.
        }

        val token = AuthSessionStore.getAccessToken().orEmpty()
        check(token.isNotBlank()) { "Access token is required before loading the profile." }

        val userResponse = JsonHttpClient.request(
            path = "/auth/me",
            token = token
        )
        val currentEmail = userResponse.optString("email").ifBlank { cachedProfile.email.orEmpty() }
        if (currentEmail.isNotBlank() && currentEmail != cachedProfile.email) {
            saveProfile(cachedProfile.copy(email = currentEmail))
        }

        val cachedSnapshot = cachedProfile

        val profileResponse = JsonHttpClient.request(
            path = "/profiles/me",
            token = token
        )

        val mapped = mapBackendProfile(
            profileJson = profileResponse,
            email = currentEmail,
            cachedProfileSnapshot = cachedSnapshot
        )
        saveProfile(mapped)
        return mapped
    }

    suspend fun syncProfile(
        profile: ProfileData,
        currentDeviceLocation: CurrentDeviceLocation? = null,
        forceClearSharedCoordinates: Boolean = false
    ): ProfileData {
        ensureInitialized()

        val token = AuthSessionStore.getAccessToken().orEmpty()
        check(token.isNotBlank()) { "Access token is required before saving the profile." }

        val trustedSavedCoordinates = if (
            cachedProfile.shareLocation != true &&
            profile.shareLocation == true &&
            currentDeviceLocation == null
        ) {
            hasTrustedRemoteSharedCoordinates(token)
        } else {
            false
        }

        if (
            isFirstTimeShareEnableWithoutCoordinates(
                previousProfile = cachedProfile,
                nextProfile = profile,
                currentDeviceLocation = currentDeviceLocation,
                hasTrustedSavedCoordinates = trustedSavedCoordinates
            )
        ) {
            throw LocationSharingInitializationRequiredException()
        }

        try {
            LocationTreeRepository.ensureLocationData()
        } catch (_: Exception) {
            // Keep fallback location mapping when location tree is unavailable.
        }

        val fallbackNames = splitFullName(profile.fullName.orEmpty())
        val firstName = profile.firstName?.trim()?.takeIf(String::isNotBlank) ?: fallbackNames.first
        val lastName = profile.lastName?.trim()?.takeIf(String::isNotBlank) ?: fallbackNames.second
        val normalizedDateOfBirth = normalizeDateOfBirth(profile.dateOfBirth)
        val resolvedAge = profile.age ?: calculateAgeFromDateOfBirth(normalizedDateOfBirth)
        val normalizedProfile = profile.copy(
            firstName = firstName,
            lastName = lastName,
            fullName = composeFullName(firstName, lastName),
            dateOfBirth = normalizedDateOfBirth,
            age = resolvedAge,
            expertise = normalizeExpertise(profile.expertise)
        )

        return try {
            JsonHttpClient.request(
                path = "/profiles/me",
                method = "PATCH",
                token = token,
                body = JSONObject().apply {
                    put("firstName", firstName)
                    put("lastName", lastName)
                    putNullable("phoneNumber", normalizedProfile.phone?.trim()?.takeIf(String::isNotBlank))
                }
            )

            JsonHttpClient.request(
                path = "/profiles/me/physical",
                method = "PATCH",
                token = token,
                body = JSONObject().apply {
                    putNullable("dateOfBirth", normalizedDateOfBirth)
                    if (normalizedDateOfBirth == null) {
                        resolvedAge?.let { put("age", it) }
                    }
                    putNullable("gender", normalizedProfile.gender)
                    normalizedProfile.height?.let { put("height", it.toDouble()) }
                    normalizedProfile.weight?.let { put("weight", it.toDouble()) }
                }
            )

            JsonHttpClient.request(
                path = "/profiles/me/health",
                method = "PATCH",
                token = token,
                body = JSONObject().apply {
                    put("medicalConditions", JSONArray(parseListField(normalizedProfile.medicalHistory)))
                    put("chronicDiseases", JSONArray(parseListField(normalizedProfile.chronicDiseases)))
                    put("allergies", JSONArray(parseListField(normalizedProfile.allergies)))
                    putNullable("bloodType", normalizedProfile.bloodType)
                }
            )

            patchLocationProfile(
                token = token,
                profile = profile,
                currentDeviceLocation = currentDeviceLocation,
                forceClearSharedCoordinates = forceClearSharedCoordinates
            )

            JsonHttpClient.request(
                path = "/profiles/me/privacy",
                method = "PATCH",
                token = token,
                body = JSONObject().apply {
                    put("profileVisibility", normalizedProfile.profileVisibility ?: "PRIVATE")
                    put("healthInfoVisibility", normalizedProfile.healthInfoVisibility ?: "PRIVATE")
                    put("locationVisibility", normalizedProfile.locationVisibility ?: "PRIVATE")
                    put("locationSharingEnabled", profile.shareLocation ?: false)
                }
            )

            JsonHttpClient.request(
                path = "/profiles/me/profession",
                method = "PATCH",
                token = token,
                body = JSONObject().apply {
                    putNullable("profession", normalizedProfile.profession)
                }
            )

            JsonHttpClient.request(
                path = "/profiles/me/expertise-areas",
                method = "PUT",
                token = token,
                body = JSONObject().apply {
                    put("expertiseAreas", JSONArray(normalizedProfile.expertise))
                }
            )

            saveProfile(normalizedProfile)

            val refreshed = fetchAndCacheRemoteProfile()
            saveProfile(refreshed)
            refreshed
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (error: Exception) {
            try {
                val refreshed = fetchAndCacheRemoteProfile()
                saveProfile(refreshed)
            } catch (_: Exception) {
                // Keep the last known local state if backend refresh also fails.
            }
            throw error
        }
    }

    internal fun isFirstTimeShareEnableWithoutCoordinates(
        previousProfile: ProfileData,
        nextProfile: ProfileData,
        currentDeviceLocation: CurrentDeviceLocation?,
        hasTrustedSavedCoordinates: Boolean
    ): Boolean {
        val enablingFromDisabledToEnabled = previousProfile.shareLocation != true && nextProfile.shareLocation == true
        if (!enablingFromDisabledToEnabled) {
            return false
        }

        val hasFreshCurrentCoordinates = currentDeviceLocation != null

        return !hasTrustedSavedCoordinates && !hasFreshCurrentCoordinates
    }

    suspend fun syncPrivacySettings(
        profileVisibility: String,
        healthInfoVisibility: String,
        locationVisibility: String,
        locationSharingEnabled: Boolean
    ): ProfileData {
        ensureInitialized()

        val token = AuthSessionStore.getAccessToken().orEmpty()
        check(token.isNotBlank()) { "Access token is required before saving privacy settings." }

        val response = JsonHttpClient.request(
            path = "/profiles/me/privacy",
            method = "PATCH",
            token = token,
            body = JSONObject().apply {
                put("profileVisibility", normalizeVisibility(profileVisibility))
                put("healthInfoVisibility", normalizeVisibility(healthInfoVisibility))
                put("locationVisibility", normalizeVisibility(locationVisibility))
                put("locationSharingEnabled", locationSharingEnabled)
            }
        )

        val updated = mapBackendProfile(
            profileJson = response,
            email = cachedProfile.email.orEmpty(),
            cachedProfileSnapshot = cachedProfile
        )
        saveProfile(updated)
        return updated
    }

    private suspend fun hasTrustedRemoteSharedCoordinates(token: String): Boolean {
        val profileResponse = JsonHttpClient.request(
            path = "/profiles/me",
            token = token
        )
        val locationProfile = profileResponse.optJSONObject("locationProfile") ?: JSONObject()
        val coordinate = locationProfile.optJSONObject("coordinate") ?: JSONObject()
        val sharedLatitude = coordinate.optNullableDouble("latitude")
            ?: locationProfile.optNullableDouble("latitude")
        val sharedLongitude = coordinate.optNullableDouble("longitude")
            ?: locationProfile.optNullableDouble("longitude")

        return sharedLatitude != null && sharedLongitude != null
    }

    suspend fun syncLocationOnLaunch(
        profile: ProfileData,
        currentDeviceLocation: CurrentDeviceLocation? = null,
        forceClearSharedCoordinates: Boolean = false
    ) {
        ensureInitialized()

        try {
            LocationTreeRepository.ensureLocationData()
        } catch (_: Exception) {
            // Keep fallback location mapping when location tree is unavailable.
        }

        val token = AuthSessionStore.getAccessToken().orEmpty()
        check(token.isNotBlank()) { "Access token is required before sending launch location update." }

        patchLocationProfile(
            token = token,
            profile = profile,
            currentDeviceLocation = currentDeviceLocation,
            forceClearSharedCoordinates = forceClearSharedCoordinates
        )
    }

    private suspend fun patchLocationProfile(
        token: String,
        profile: ProfileData,
        currentDeviceLocation: CurrentDeviceLocation? = null,
        forceClearSharedCoordinates: Boolean = false
    ) {
        JsonHttpClient.request(
            path = "/profiles/me/location",
            method = "PATCH",
            token = token,
            body = buildLocationPatchPayload(
                profile = profile,
                currentDeviceLocation = currentDeviceLocation,
                forceClearSharedCoordinates = forceClearSharedCoordinates
            )
        )
    }

    internal fun buildLocationPatchPayload(
        profile: ProfileData,
        currentDeviceLocation: CurrentDeviceLocation? = null,
        forceClearSharedCoordinates: Boolean = false
    ): JSONObject {
        val selectedCountry = profile.country?.trim()?.takeIf(String::isNotBlank)
        val resolvedCountryKey = resolveCountrySelectionKey(selectedCountry)
        val countryLookupValue = resolvedCountryKey ?: selectedCountry
        val backendCountryCode = resolvedCountryKey?.uppercase(Locale.ROOT)
        val countryLabel = resolveCountryLabel(countryLookupValue)
        val cityLabel = resolveCityLabel(countryLookupValue, profile.city)
        val districtLabel = resolveDistrictLabel(countryLookupValue, profile.city, profile.district)
        val neighborhoodLabel = resolveNeighborhoodLabel(
            countryLookupValue,
            profile.city,
            profile.district,
            profile.neighborhood
        )
        val normalizedExtraAddress = profile.extraAddress?.trim()?.takeIf(String::isNotBlank)
        val displayAddress = buildAddress(districtLabel, neighborhoodLabel, normalizedExtraAddress)

        return JSONObject().apply {
            putNullable("country", countryLabel)
            putNullable("city", cityLabel)
            putNullable("address", displayAddress)
            putNullable("displayAddress", displayAddress)

            put(
                "administrative",
                JSONObject().apply {
                    putNullable("countryCode", backendCountryCode)
                    putNullable("country", countryLabel)
                    putNullable("city", cityLabel)
                    putNullable("district", districtLabel)
                    putNullable("neighborhood", neighborhoodLabel)
                    putNullable("extraAddress", normalizedExtraAddress)
                }
            )

            when {
                profile.shareLocation != true || forceClearSharedCoordinates -> {
                    putNullable("latitude", null)
                    putNullable("longitude", null)
                    put(
                        "coordinate",
                        JSONObject().apply {
                            putNullable("latitude", null)
                            putNullable("longitude", null)
                            putNullable("accuracyMeters", null)
                            putNullable("source", null)
                            putNullable("capturedAt", null)
                        }
                    )
                }

                currentDeviceLocation != null -> {
                    put("latitude", currentDeviceLocation.latitude)
                    put("longitude", currentDeviceLocation.longitude)
                    put(
                        "coordinate",
                        JSONObject().apply {
                            put("latitude", currentDeviceLocation.latitude)
                            put("longitude", currentDeviceLocation.longitude)
                            putNullable("accuracyMeters", currentDeviceLocation.accuracyMeters)
                            putNullable("source", currentDeviceLocation.source)
                            putNullable("capturedAt", currentDeviceLocation.capturedAt)
                        }
                    )
                }
            }
        }
    }

    private fun persistProfile(profile: ProfileData) {
        val resolvedFirstName = profile.firstName?.trim()?.takeIf(String::isNotBlank)
        val resolvedLastName = profile.lastName?.trim()?.takeIf(String::isNotBlank)
        val resolvedDateOfBirth = normalizeDateOfBirth(profile.dateOfBirth)
        val resolvedAge = profile.age ?: calculateAgeFromDateOfBirth(resolvedDateOfBirth)
        val resolvedExpertise = normalizeExpertise(profile.expertise)
        val resolvedFullName = composeFullName(resolvedFirstName, resolvedLastName) ?: profile.fullName

        prefs.edit().apply {
            putString("firstName", resolvedFirstName)
            putString("lastName", resolvedLastName)
            putString("fullName", resolvedFullName)
            putString("email", profile.email)
            putString("phone", profile.phone)
            putString("profession", profile.profession)
            putString("expertise", JSONArray(resolvedExpertise).toString())
            putFloatOrRemove("height", profile.height)
            putFloatOrRemove("weight", profile.weight)
            putString("bloodType", profile.bloodType)
            putString("gender", profile.gender)
            putString("dateOfBirth", resolvedDateOfBirth)
            putIntOrRemove("age", resolvedAge)
            putString("medicalHistory", profile.medicalHistory)
            putString("chronicDiseases", profile.chronicDiseases)
            putString("allergies", profile.allergies)
            putString("country", profile.country)
            putString("city", profile.city)
            putString("district", profile.district)
            putString("neighborhood", profile.neighborhood)
            putString("extraAddress", profile.extraAddress)
            putString("profileVisibility", normalizeVisibility(profile.profileVisibility))
            putString("healthInfoVisibility", normalizeVisibility(profile.healthInfoVisibility))
            putString("locationVisibility", normalizeVisibility(profile.locationVisibility))
            putBoolean("shareLocation", profile.shareLocation ?: false)
            putString("sharedLatitude", profile.sharedLatitude?.toString())
            putString("sharedLongitude", profile.sharedLongitude?.toString())
        }.apply()
    }

    private fun readProfileFromPrefs(): ProfileData {
        val expertiseJson = prefs.getString("expertise", null)
        val expertise = if (expertiseJson.isNullOrBlank()) {
            emptyList()
        } else {
            try {
                normalizeExpertise(JSONArray(expertiseJson).toStringList())
            } catch (_: Exception) {
                emptyList()
            }
        }

        val storedFirstName = prefs.getString("firstName", null)
        val storedLastName = prefs.getString("lastName", null)
        val storedDateOfBirth = normalizeDateOfBirth(prefs.getString("dateOfBirth", null))
        val storedAge = prefs.getNullableInt("age") ?: calculateAgeFromDateOfBirth(storedDateOfBirth)

        return ProfileData(
            firstName = storedFirstName,
            lastName = storedLastName,
            fullName = composeFullName(storedFirstName, storedLastName) ?: prefs.getString("fullName", null),
            email = prefs.getString("email", null),
            phone = prefs.getString("phone", null),
            profession = prefs.getString("profession", null),
            expertise = expertise,
            height = prefs.getNullableFloat("height"),
            weight = prefs.getNullableFloat("weight"),
            bloodType = prefs.getString("bloodType", null),
            gender = prefs.getString("gender", null),
            dateOfBirth = storedDateOfBirth,
            age = storedAge,
            medicalHistory = prefs.getString("medicalHistory", null),
            chronicDiseases = prefs.getString("chronicDiseases", null),
            allergies = prefs.getString("allergies", null),
            country = prefs.getString("country", null),
            city = prefs.getString("city", null),
            district = prefs.getString("district", null),
            neighborhood = prefs.getString("neighborhood", null),
            extraAddress = prefs.getString("extraAddress", null),
            profileVisibility = normalizeVisibility(prefs.getString("profileVisibility", null)),
            healthInfoVisibility = normalizeVisibility(prefs.getString("healthInfoVisibility", null)),
            locationVisibility = normalizeVisibility(prefs.getString("locationVisibility", null)),
            shareLocation = if (prefs.contains("shareLocation")) prefs.getBoolean("shareLocation", false) else null,
            sharedLatitude = prefs.getString("sharedLatitude", null)?.toDoubleOrNull(),
            sharedLongitude = prefs.getString("sharedLongitude", null)?.toDoubleOrNull()
        )
    }

    private fun mapBackendProfile(
        profileJson: JSONObject,
        email: String,
        cachedProfileSnapshot: ProfileData
    ): ProfileData {
        val profile = profileJson.optJSONObject("profile") ?: JSONObject()
        val physicalInfo = profileJson.optJSONObject("physicalInfo") ?: JSONObject()
        val healthInfo = profileJson.optJSONObject("healthInfo") ?: JSONObject()
        val locationProfile = profileJson.optJSONObject("locationProfile") ?: JSONObject()
        val privacySettings = profileJson.optJSONObject("privacySettings") ?: JSONObject()
        val expertise = profileJson.optJSONArray("expertise")?.optJSONObject(0)
        val administrative = locationProfile.optJSONObject("administrative") ?: JSONObject()
        val coordinate = locationProfile.optJSONObject("coordinate") ?: JSONObject()

        val countryLabel = administrative.optStringOrNull("country")
            ?: locationProfile.optStringOrNull("country")
        val cityLabel = administrative.optStringOrNull("city")
            ?: locationProfile.optStringOrNull("city")
        val countryCode = administrative.optStringOrNull("countryCode")
        val countryKey = countryCode
            ?.lowercase()
            ?.takeIf { locationData.containsKey(it) }
            ?: findCountryKeyByLabel(countryLabel)
        val cityKey = findCityKeyByLabel(countryKey, cityLabel)
        val address = locationProfile.optStringOrNull("displayAddress")
            ?: locationProfile.optStringOrNull("address")
        val parsedAddress = parseLocationAddress(countryKey, cityKey, address)
        val districtFromAdministrative = findDistrictKeyByLabel(
            countryKey,
            cityKey,
            administrative.optStringOrNull("district")
        )
        val districtKey = districtFromAdministrative.ifBlank { parsedAddress.first }
        val neighborhoodFromAdministrative = findNeighborhoodValueByLabel(
            countryKey,
            cityKey,
            districtKey,
            administrative.optStringOrNull("neighborhood")
        )
        val neighborhoodValue = neighborhoodFromAdministrative.ifBlank { parsedAddress.second }
        val extraAddressFromBackend = administrative.optStringOrNull("extraAddress")
            ?: parsedAddress.third
        val firstName = profile.optStringOrNull("firstName")
        val lastName = profile.optStringOrNull("lastName")
        val dateOfBirth = normalizeDateOfBirth(physicalInfo.optStringOrNull("dateOfBirth"))
        val resolvedAge = physicalInfo.optNullableInt("age") ?: calculateAgeFromDateOfBirth(dateOfBirth)
        val sharedLatitude = coordinate.optNullableDouble("latitude")
            ?: locationProfile.optNullableDouble("latitude")
        val sharedLongitude = coordinate.optNullableDouble("longitude")
            ?: locationProfile.optNullableDouble("longitude")

        return ProfileData(
            firstName = firstName,
            lastName = lastName,
            fullName = composeFullName(firstName, lastName),
            email = email.takeIf { it.isNotBlank() } ?: cachedProfileSnapshot.email,
            phone = profile.optStringOrNull("phoneNumber"),
            profession = expertise?.optStringOrNull("profession"),
            expertise = normalizeExpertise(expertise?.optJSONArray("expertiseAreas").toStringList()),
            height = physicalInfo.optNullableFloat("height"),
            weight = physicalInfo.optNullableFloat("weight"),
            bloodType = normalizeBloodType(healthInfo.optStringOrNull("bloodType")),
            gender = physicalInfo.optStringOrNull("gender"),
            dateOfBirth = dateOfBirth,
            age = resolvedAge,
            medicalHistory = healthInfo.optJSONArray("medicalConditions").toStringList().joinToString(", ").takeIf { it.isNotBlank() },
            chronicDiseases = healthInfo.optJSONArray("chronicDiseases").toStringList().joinToString(", ").takeIf { it.isNotBlank() },
            allergies = healthInfo.optJSONArray("allergies").toStringList().joinToString(", ").takeIf { it.isNotBlank() },
            country = countryKey.ifBlank { countryLabel.orEmpty() }.takeIf { it.isNotBlank() },
            city = cityKey.ifBlank { cityLabel.orEmpty() }.takeIf { it.isNotBlank() },
            district = districtKey
                .ifBlank { cachedProfileSnapshot.district.orEmpty() }
                .takeIf { it.isNotBlank() },
            neighborhood = neighborhoodValue
                .ifBlank { cachedProfileSnapshot.neighborhood.orEmpty() }
                .takeIf { it.isNotBlank() },
            extraAddress = extraAddressFromBackend
                ?: cachedProfileSnapshot.extraAddress,
            profileVisibility = normalizeVisibility(privacySettings.optStringOrNull("profileVisibility")),
            healthInfoVisibility = normalizeVisibility(privacySettings.optStringOrNull("healthInfoVisibility")),
            locationVisibility = normalizeVisibility(privacySettings.optStringOrNull("locationVisibility")),
            shareLocation = privacySettings.optNullableBoolean("locationSharingEnabled"),
            sharedLatitude = sharedLatitude,
            sharedLongitude = sharedLongitude
        )
    }

    private fun parseLocationAddress(
        countryKey: String,
        cityKey: String,
        address: String?
    ): Triple<String, String, String?> {
        val rawAddress = address?.trim().orEmpty()
        if (countryKey.isBlank() || cityKey.isBlank() || rawAddress.isBlank()) {
            val (districtLabel, neighborhoodLabel, extraAddress) = splitAddressParts(address)
            return Triple(
                findDistrictKeyByLabel(countryKey, cityKey, districtLabel),
                findNeighborhoodValueByLabel(
                    countryKey,
                    cityKey,
                    findDistrictKeyByLabel(countryKey, cityKey, districtLabel),
                    neighborhoodLabel
                ),
                extraAddress
            )
        }

        val city = locationData[countryKey]?.cities?.get(cityKey)
            ?: return Triple("", "", rawAddress)

        val tokens = rawAddress
            .split(',')
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .toMutableList()

        val normalizedTokens = tokens.associateBy { normalizeAddressToken(it) }.toMutableMap()

        var matchedDistrictKey = ""
        city.districts.forEach { (districtKey, districtValue) ->
            if (matchedDistrictKey.isNotBlank()) return@forEach
            val districtCandidates = listOf(districtKey, districtValue.label)
                .map { normalizeAddressToken(it) }
            if (districtCandidates.any { normalizedTokens.containsKey(it) }) {
                matchedDistrictKey = districtKey
                districtCandidates.forEach { normalizedTokens.remove(it) }
            }
        }

        var matchedNeighborhoodValue = ""
        if (matchedDistrictKey.isNotBlank()) {
            val district = city.districts[matchedDistrictKey]
            district?.neighborhoods?.forEach { neighborhood ->
                if (matchedNeighborhoodValue.isNotBlank()) return@forEach
                val neighborhoodCandidates = listOf(neighborhood.value, neighborhood.label)
                    .map { normalizeAddressToken(it) }
                if (neighborhoodCandidates.any { normalizedTokens.containsKey(it) }) {
                    matchedNeighborhoodValue = neighborhood.value
                    neighborhoodCandidates.forEach { normalizedTokens.remove(it) }
                }
            }
        }

        val extraAddress = normalizedTokens.values.joinToString(", ").ifBlank { null }
        return Triple(matchedDistrictKey, matchedNeighborhoodValue, extraAddress)
    }

    private fun SharedPreferences.Editor.putFloatOrRemove(key: String, value: Float?) {
        if (value == null) {
            remove(key)
        } else {
            putFloat(key, value)
        }
    }

    private fun SharedPreferences.Editor.putIntOrRemove(key: String, value: Int?) {
        if (value == null) {
            remove(key)
        } else {
            putInt(key, value)
        }
    }

    private fun SharedPreferences.getNullableFloat(key: String): Float? {
        return if (contains(key)) getFloat(key, 0f) else null
    }

    private fun SharedPreferences.getNullableInt(key: String): Int? {
        return if (contains(key)) getInt(key, 0) else null
    }

    private fun JSONObject.putNullable(key: String, value: Any?) {
        put(key, value ?: JSONObject.NULL)
    }

    private fun JSONObject.optStringOrNull(key: String): String? {
        return optString(key).takeIf { it.isNotBlank() }
    }

    private fun JSONObject.optNullableFloat(key: String): Float? {
        return if (has(key) && !isNull(key)) optDouble(key).toFloat() else null
    }

    private fun JSONObject.optNullableInt(key: String): Int? {
        return if (has(key) && !isNull(key)) optInt(key) else null
    }

    private fun JSONObject.optNullableBoolean(key: String): Boolean? {
        return if (has(key) && !isNull(key)) optBoolean(key) else null
    }

    private fun JSONObject.optNullableDouble(key: String): Double? {
        return if (has(key) && !isNull(key)) optDouble(key) else null
    }

    private fun normalizeVisibility(value: String?): String {
        return when (value?.uppercase(Locale.ROOT)) {
            "PUBLIC" -> "PUBLIC"
            "EMERGENCY_ONLY" -> "EMERGENCY_ONLY"
            else -> "PRIVATE"
        }
    }

    private fun ensureInitialized() {
        check(::prefs.isInitialized) {
            "ProfileRepository must be initialized before use."
        }
    }
}
