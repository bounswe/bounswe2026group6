package com.neph.features.profile.data

import android.content.Context
import android.content.SharedPreferences
import com.neph.core.network.JsonHttpClient
import com.neph.features.auth.data.AuthSessionStore
import kotlinx.coroutines.CancellationException
import org.json.JSONArray
import org.json.JSONObject

object ProfileRepository {
    private const val PrefsName = "neph_profile"

    private lateinit var prefs: SharedPreferences
    private var cachedProfile = ProfileData()

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

    suspend fun fetchAndCacheRemoteProfile(): ProfileData {
        ensureInitialized()
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

    suspend fun syncProfile(profile: ProfileData): ProfileData {
        ensureInitialized()
        val token = AuthSessionStore.getAccessToken().orEmpty()
        check(token.isNotBlank()) { "Access token is required before saving the profile." }

        val normalizedName = profile.fullName?.trim().orEmpty()
        val (firstName, lastName) = splitFullName(normalizedName)

        return try {
            JsonHttpClient.request(
                path = "/profiles/me",
                method = "PATCH",
                token = token,
                body = JSONObject().apply {
                    put("firstName", firstName)
                    put("lastName", lastName)
                    putNullable("phoneNumber", profile.phone?.trim()?.takeIf(String::isNotBlank))
                }
            )

            JsonHttpClient.request(
                path = "/profiles/me/physical",
                method = "PATCH",
                token = token,
                body = JSONObject().apply {
                    calculateAge(profile.birthDate)?.let { put("age", it) }
                    putNullable("gender", profile.gender)
                    profile.height?.let { put("height", it.toDouble()) }
                    profile.weight?.let { put("weight", it.toDouble()) }
                }
            )

            JsonHttpClient.request(
                path = "/profiles/me/health",
                method = "PATCH",
                token = token,
                body = JSONObject().apply {
                    put("medicalConditions", JSONArray(parseListField(profile.medicalHistory)))
                    put("chronicDiseases", JSONArray(parseListField(profile.chronicDiseases)))
                    put("allergies", JSONArray(parseListField(profile.allergies)))
                    putNullable("bloodType", profile.bloodType)
                }
            )

            JsonHttpClient.request(
                path = "/profiles/me/location",
                method = "PATCH",
                token = token,
                body = JSONObject().apply {
                    putNullable("provinceCode", profile.provinceCode)
                    putNullable("districtId", profile.districtId)
                    putNullable("neighborhoodId", profile.neighborhoodId)
                    putNullable("extraAddress", profile.extraAddress)
                }
            )

            JsonHttpClient.request(
                path = "/profiles/me/privacy",
                method = "PATCH",
                token = token,
                body = JSONObject().apply {
                    put("locationSharingEnabled", profile.shareLocation ?: false)
                }
            )

            JsonHttpClient.request(
                path = "/profiles/me/profession",
                method = "PATCH",
                token = token,
                body = JSONObject().apply {
                    putNullable("profession", profile.profession)
                }
            )

            JsonHttpClient.request(
                path = "/profiles/me/expertise-areas",
                method = "PUT",
                token = token,
                body = JSONObject().apply {
                    put("expertiseAreas", JSONArray(profile.expertise))
                }
            )

            saveProfile(profile)

            val refreshed = fetchAndCacheRemoteProfile().copy(
                birthDate = profile.birthDate
            )
            saveProfile(refreshed)
            refreshed
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (error: Exception) {
            try {
                val refreshed = fetchAndCacheRemoteProfile().copy(
                    birthDate = profile.birthDate
                )
                saveProfile(refreshed)
            } catch (_: Exception) {
                // Keep the last known local state if backend refresh also fails.
            }
            throw error
        }
    }

    private fun persistProfile(profile: ProfileData) {
        prefs.edit().apply {
            putString("fullName", profile.fullName)
            putString("email", profile.email)
            putString("phone", profile.phone)
            putString("profession", profile.profession)
            putString("expertise", JSONArray(profile.expertise).toString())
            putFloatOrRemove("height", profile.height)
            putFloatOrRemove("weight", profile.weight)
            putString("bloodType", profile.bloodType)
            putString("gender", profile.gender)
            putString("birthDate", profile.birthDate)
            putString("medicalHistory", profile.medicalHistory)
            putString("chronicDiseases", profile.chronicDiseases)
            putString("allergies", profile.allergies)
            putString("provinceCode", profile.provinceCode)
            putString("province", profile.province)
            putString("districtId", profile.districtId)
            putString("district", profile.district)
            putString("neighborhoodId", profile.neighborhoodId)
            putString("neighborhood", profile.neighborhood)
            putString("extraAddress", profile.extraAddress)
            putBoolean("shareLocation", profile.shareLocation ?: false)
        }.apply()
    }

    private fun readProfileFromPrefs(): ProfileData {
        val expertiseJson = prefs.getString("expertise", null)
        val expertise = if (expertiseJson.isNullOrBlank()) {
            emptyList()
        } else {
            try {
                JSONArray(expertiseJson).toStringList()
            } catch (_: Exception) {
                emptyList()
            }
        }

        return ProfileData(
            fullName = prefs.getString("fullName", null),
            email = prefs.getString("email", null),
            phone = prefs.getString("phone", null),
            profession = prefs.getString("profession", null),
            expertise = expertise,
            height = prefs.getNullableFloat("height"),
            weight = prefs.getNullableFloat("weight"),
            bloodType = prefs.getString("bloodType", null),
            gender = prefs.getString("gender", null),
            birthDate = prefs.getString("birthDate", null),
            medicalHistory = prefs.getString("medicalHistory", null),
            chronicDiseases = prefs.getString("chronicDiseases", null),
            allergies = prefs.getString("allergies", null),
            provinceCode = prefs.getString("provinceCode", null),
            province = prefs.getString("province", null),
            districtId = prefs.getString("districtId", null),
            district = prefs.getString("district", null),
            neighborhoodId = prefs.getString("neighborhoodId", null),
            neighborhood = prefs.getString("neighborhood", null),
            extraAddress = prefs.getString("extraAddress", null),
            shareLocation = if (prefs.contains("shareLocation")) prefs.getBoolean("shareLocation", false) else null
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

        return ProfileData(
            fullName = listOf(
                profile.optStringOrNull("firstName"),
                profile.optStringOrNull("lastName")
            ).filterNotNull().joinToString(" ").trim().takeIf { it.isNotBlank() },
            email = email.takeIf { it.isNotBlank() } ?: cachedProfileSnapshot.email,
            phone = profile.optStringOrNull("phoneNumber"),
            profession = expertise?.optStringOrNull("profession"),
            expertise = expertise?.optJSONArray("expertiseAreas").toStringList(),
            height = physicalInfo.optNullableFloat("height"),
            weight = physicalInfo.optNullableFloat("weight"),
            bloodType = healthInfo.optStringOrNull("bloodType"),
            gender = physicalInfo.optStringOrNull("gender"),
            birthDate = cachedProfileSnapshot.birthDate,
            medicalHistory = healthInfo.optJSONArray("medicalConditions").toStringList().joinToString(", ").takeIf { it.isNotBlank() },
            chronicDiseases = healthInfo.optJSONArray("chronicDiseases").toStringList().joinToString(", ").takeIf { it.isNotBlank() },
            allergies = healthInfo.optJSONArray("allergies").toStringList().joinToString(", ").takeIf { it.isNotBlank() },
            provinceCode = locationProfile.optStringOrNull("provinceCode"),
            province = locationProfile.optStringOrNull("province"),
            districtId = locationProfile.optStringOrNull("districtId"),
            district = locationProfile.optStringOrNull("district"),
            neighborhoodId = locationProfile.optStringOrNull("neighborhoodId"),
            neighborhood = locationProfile.optStringOrNull("neighborhood"),
            extraAddress = locationProfile.optStringOrNull("extraAddress")
                ?: locationProfile.optStringOrNull("address")
                ?: cachedProfileSnapshot.extraAddress,
            shareLocation = privacySettings.optNullableBoolean("locationSharingEnabled")
        )
    }

    private fun SharedPreferences.Editor.putFloatOrRemove(key: String, value: Float?) {
        if (value == null) {
            remove(key)
        } else {
            putFloat(key, value)
        }
    }

    private fun SharedPreferences.getNullableFloat(key: String): Float? {
        return if (contains(key)) getFloat(key, 0f) else null
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

    private fun JSONObject.optNullableBoolean(key: String): Boolean? {
        return if (has(key) && !isNull(key)) optBoolean(key) else null
    }

    private fun ensureInitialized() {
        check(::prefs.isInitialized) {
            "ProfileRepository must be initialized before use."
        }
    }
}
