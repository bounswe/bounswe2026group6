package com.neph.features.profile.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject

class ProfileRepositoryLocationPayloadTest {
    @Test
    fun buildPrivacySettingsPatchPayload_onlyIncludesPrivacyFields() {
        val payload = ProfileRepository.buildPrivacySettingsPatchPayload(
            profileVisibility = "public",
            healthInfoVisibility = "EMERGENCY_ONLY",
            locationVisibility = "unexpected-value",
            locationSharingEnabled = true
        )

        assertEquals(4, payload.length())
        assertEquals("PUBLIC", payload.getString("profileVisibility"))
        assertEquals("EMERGENCY_ONLY", payload.getString("healthInfoVisibility"))
        assertEquals("PRIVATE", payload.getString("locationVisibility"))
        assertTrue(payload.getBoolean("locationSharingEnabled"))
        assertFalse(payload.has("firstName"))
        assertFalse(payload.has("medicalConditions"))
        assertFalse(payload.has("latitude"))
        assertFalse(payload.has("profession"))
        assertFalse(payload.has("expertiseAreas"))
    }

    @Test
    fun defaultLocationVisibilityForPermission_tracksPermissionGrant() {
        assertEquals("EMERGENCY_ONLY", ProfileRepository.defaultLocationVisibilityForPermission(true))
        assertEquals("PRIVATE", ProfileRepository.defaultLocationVisibilityForPermission(false))
    }

    @Test
    fun resolveLocationVisibilityForPermissionBootstrap_preservesExistingLocationVisibility() {
        val profile = ProfileData(
            locationVisibility = "PUBLIC",
            locationVisibilityInitialized = true
        )

        val result = ProfileRepository.resolveLocationVisibilityForPermissionBootstrap(
            profile = profile,
            locationPermissionGranted = false
        )

        assertEquals("PUBLIC", result)
    }

    @Test
    fun resolveLocationVisibilityForPermissionBootstrap_usesPermissionDefaultWhenUninitialized() {
        val profile = ProfileData(
            locationVisibility = "PRIVATE",
            locationVisibilityInitialized = false
        )

        val result = ProfileRepository.resolveLocationVisibilityForPermissionBootstrap(
            profile = profile,
            locationPermissionGranted = true
        )

        assertEquals("EMERGENCY_ONLY", result)
    }

    @Test
    fun mergePrivacySettingsResponse_preservesUnrelatedCachedProfileFields() {
        val cached = ProfileData(
            firstName = "Ada",
            lastName = "Lovelace",
            fullName = "Ada Lovelace",
            email = "ada@example.com",
            phone = "+905551112233",
            profession = "Engineer",
            expertise = listOf("FIRST_AID"),
            height = 165f,
            weight = 58f,
            bloodType = "A+",
            gender = "FEMALE",
            dateOfBirth = "1990-05-01",
            age = 36,
            medicalHistory = "asthma",
            chronicDiseases = "diabetes",
            allergies = "pollen",
            country = "tr",
            city = "istanbul",
            district = "kadikoy",
            neighborhood = "moda",
            extraAddress = "Apt 4",
            profileVisibility = "PRIVATE",
            healthInfoVisibility = "PRIVATE",
            locationVisibility = "PRIVATE",
            shareLocation = false,
            sharedLatitude = 41.043,
            sharedLongitude = 29.009
        )

        val updated = ProfileRepository.mergePrivacySettingsResponse(
            cachedProfileSnapshot = cached,
            response = JSONObject().put(
                "privacySettings",
                JSONObject()
                    .put("profileVisibility", "PUBLIC")
                    .put("healthInfoVisibility", "EMERGENCY_ONLY")
                    .put("locationVisibility", "PUBLIC")
                    .put("locationSharingEnabled", true)
            ),
            requestedProfileVisibility = "PRIVATE",
            requestedHealthInfoVisibility = "PRIVATE",
            requestedLocationVisibility = "PRIVATE",
            requestedLocationSharingEnabled = false
        )

        assertEquals(cached.copy(
            profileVisibility = "PUBLIC",
            healthInfoVisibility = "EMERGENCY_ONLY",
            locationVisibility = "PUBLIC",
            locationVisibilityInitialized = true,
            shareLocation = true
        ), updated)
    }

    @Test
    fun isFirstTimeShareEnableWithoutCoordinates_returnsTrue_whenEnablingWithoutSavedOrFreshCoordinates() {
        val previous = ProfileData(shareLocation = false, sharedLatitude = null, sharedLongitude = null)
        val next = previous.copy(shareLocation = true)

        val result = ProfileRepository.isFirstTimeShareEnableWithoutCoordinates(
            previousProfile = previous,
            nextProfile = next,
            currentDeviceLocation = null,
            hasTrustedSavedCoordinates = false
        )

        assertTrue(result)
    }

    @Test
    fun isFirstTimeShareEnableWithoutCoordinates_returnsFalse_whenFreshCoordinatesExist() {
        val previous = ProfileData(shareLocation = false, sharedLatitude = null, sharedLongitude = null)
        val next = previous.copy(shareLocation = true)

        val result = ProfileRepository.isFirstTimeShareEnableWithoutCoordinates(
            previousProfile = previous,
            nextProfile = next,
            currentDeviceLocation = CurrentDeviceLocation(
                latitude = 41.043,
                longitude = 29.009,
                accuracyMeters = 10.0,
                capturedAt = "2026-04-20T10:20:30.000Z"
            ),
            hasTrustedSavedCoordinates = false
        )

        assertFalse(result)
    }

    @Test
    fun isFirstTimeShareEnableWithoutCoordinates_returnsTrue_whenOnlyLocalSavedCoordinatesExist() {
        val previous = ProfileData(shareLocation = false, sharedLatitude = 41.043, sharedLongitude = 29.009)
        val next = previous.copy(shareLocation = true)

        val result = ProfileRepository.isFirstTimeShareEnableWithoutCoordinates(
            previousProfile = previous,
            nextProfile = next,
            currentDeviceLocation = null,
            hasTrustedSavedCoordinates = false
        )

        assertTrue(result)
    }

    @Test
    fun isFirstTimeShareEnableWithoutCoordinates_returnsFalse_whenTrustedSavedCoordinatesExist() {
        val previous = ProfileData(shareLocation = false, sharedLatitude = null, sharedLongitude = null)
        val next = previous.copy(shareLocation = true)

        val result = ProfileRepository.isFirstTimeShareEnableWithoutCoordinates(
            previousProfile = previous,
            nextProfile = next,
            currentDeviceLocation = null,
            hasTrustedSavedCoordinates = true
        )

        assertFalse(result)
    }

    @Test
    fun isFirstTimeShareEnableWithoutCoordinates_returnsFalse_whenAlreadyEnabled() {
        val previous = ProfileData(shareLocation = true, sharedLatitude = null, sharedLongitude = null)
        val next = previous.copy(shareLocation = true)

        val result = ProfileRepository.isFirstTimeShareEnableWithoutCoordinates(
            previousProfile = previous,
            nextProfile = next,
            currentDeviceLocation = null,
            hasTrustedSavedCoordinates = false
        )

        assertFalse(result)
    }

    @Test
    fun buildLocationPatchPayload_includesCoordinateWhenSharingEnabledAndLocationAvailable() {
        val payload = ProfileRepository.buildLocationPatchPayload(
            profile = ProfileData(
                country = "tr",
                city = "ankara",
                district = "cankaya",
                neighborhood = "AnitTepeCode",
                extraAddress = "Building A",
                shareLocation = true
            ),
            currentDeviceLocation = CurrentDeviceLocation(
                latitude = 41.043,
                longitude = 29.009,
                accuracyMeters = 12.5,
                capturedAt = "2026-04-20T10:20:30.000Z",
                source = "DEVICE_GPS"
            )
        )

        assertEquals(41.043, payload.getDouble("latitude"), 0.0)
        assertEquals(29.009, payload.getDouble("longitude"), 0.0)

        val coordinate = payload.getJSONObject("coordinate")
        assertEquals(41.043, coordinate.getDouble("latitude"), 0.0)
        assertEquals(29.009, coordinate.getDouble("longitude"), 0.0)
        assertEquals(12.5, coordinate.getDouble("accuracyMeters"), 0.0)
        assertEquals("DEVICE_GPS", coordinate.getString("source"))
        assertEquals("2026-04-20T10:20:30.000Z", coordinate.getString("capturedAt"))
    }

    @Test
    fun buildLocationPatchPayload_clearsCoordinateWhenSharingDisabled() {
        val payload = ProfileRepository.buildLocationPatchPayload(
            profile = ProfileData(
                country = "tr",
                city = "ankara",
                district = "cankaya",
                neighborhood = "AnitTepeCode",
                shareLocation = false
            ),
            currentDeviceLocation = CurrentDeviceLocation(
                latitude = 41.043,
                longitude = 29.009,
                accuracyMeters = null,
                capturedAt = "2026-04-20T10:20:30.000Z"
            )
        )

        assertTrue(payload.has("latitude"))
        assertTrue(payload.isNull("latitude"))
        assertTrue(payload.has("longitude"))
        assertTrue(payload.isNull("longitude"))
        assertTrue(payload.has("coordinate"))
        val coordinate = payload.getJSONObject("coordinate")
        assertTrue(coordinate.has("latitude"))
        assertTrue(coordinate.isNull("latitude"))
        assertTrue(coordinate.has("longitude"))
        assertTrue(coordinate.isNull("longitude"))
    }

    @Test
    fun buildLocationPatchPayload_clearsCoordinateWhenLocationUnavailableAndForceClearRequested() {
        val payload = ProfileRepository.buildLocationPatchPayload(
            profile = ProfileData(
                country = "tr",
                city = "ankara",
                district = "cankaya",
                neighborhood = "AnitTepeCode",
                extraAddress = "Building A",
                shareLocation = true
            ),
            currentDeviceLocation = null,
            forceClearSharedCoordinates = true
        )

        assertTrue(payload.has("administrative"))
        assertNotNull(payload.opt("displayAddress"))
        assertTrue(payload.has("latitude"))
        assertTrue(payload.isNull("latitude"))
        assertTrue(payload.has("longitude"))
        assertTrue(payload.isNull("longitude"))
        assertTrue(payload.has("coordinate"))
        val coordinate = payload.getJSONObject("coordinate")
        assertTrue(coordinate.has("latitude"))
        assertTrue(coordinate.isNull("latitude"))
        assertTrue(coordinate.has("longitude"))
        assertTrue(coordinate.isNull("longitude"))
    }

    @Test
    fun buildLocationPatchPayload_omitsCoordinateWhenLocationUnavailableAndNoForceClear() {
        val payload = ProfileRepository.buildLocationPatchPayload(
            profile = ProfileData(
                country = "tr",
                city = "ankara",
                district = "cankaya",
                neighborhood = "AnitTepeCode",
                extraAddress = "Building A",
                shareLocation = true
            ),
            currentDeviceLocation = null,
            forceClearSharedCoordinates = false
        )

        assertTrue(payload.has("administrative"))
        assertNotNull(payload.opt("displayAddress"))
        assertFalse(payload.has("latitude"))
        assertFalse(payload.has("longitude"))
        assertFalse(payload.has("coordinate"))
    }
}
