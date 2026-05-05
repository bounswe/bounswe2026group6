package com.neph.features.requesthelp.data

import com.neph.core.sync.LocalOwnerType
import com.neph.core.sync.SyncStatus
import com.neph.features.profile.data.CurrentDeviceLocation
import com.neph.features.profile.data.ProfileData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONArray
import org.json.JSONObject

class RequestHelpOfflineMappingTest {
    @Test
    fun submissionCreatesPendingLocalEntityForOfflineWrite() {
        val submission = sampleSubmission()
        val entity = submission.toEntity(
            localId = "local-test",
            ownerType = LocalOwnerType.GUEST,
            now = 1234L,
            syncStatus = SyncStatus.PENDING_CREATE
        )

        assertEquals("local-test", entity.localId)
        assertEquals(LocalOwnerType.GUEST, entity.ownerType)
        assertEquals(SyncStatus.PENDING_CREATE, entity.syncStatus)
        assertEquals("PENDING_SYNC", entity.status)
        assertEquals("Need water and medication", entity.description)
        assertEquals(listOf("food_water", "first_aid"), entity.helpTypesJson.jsonArrayToStringList())
        assertFalse(entity.isDeleted)
    }

    @Test
    fun submissionJsonMatchesBackendContractForCreate() {
        val json = sampleSubmission().toJson()

        assertEquals(2, json.getJSONArray("helpTypes").length())
        assertEquals("food_water", json.getJSONArray("helpTypes").getString(0))
        assertEquals(3, json.getInt("affectedPeopleCount"))
        assertEquals("Kadikoy", json.getJSONObject("location").getString("district"))
        assertEquals(5551234567L, json.getJSONObject("contact").getLong("phone"))
        assertTrue(json.getBoolean("consentGiven"))
    }

    @Test
    fun submissionJsonIncludesCoordinatesWhenAvailable() {
        val submission = sampleSubmission().copy(
            location = RequestHelpLocationSubmission(
                country = "Turkey",
                city = "Istanbul",
                district = "Kadikoy",
                neighborhood = "Moda",
                extraAddress = "Near park",
                latitude = 40.987,
                longitude = 29.025,
                coordinateSource = "gps",
                coordinateCapturedAt = "2026-05-02T10:00:00.000Z",
                coordinateAccuracyMeters = 18.5
            )
        )
        val json = submission.toJson()
        val entity = submission.toEntity(
            localId = "local-with-location",
            ownerType = LocalOwnerType.AUTHENTICATED,
            now = 1234L,
            syncStatus = SyncStatus.PENDING_CREATE
        )

        val location = json.getJSONObject("location")
        assertEquals(40.987, location.getDouble("latitude"), 0.0)
        assertEquals(29.025, location.getDouble("longitude"), 0.0)
        assertEquals(18.5, location.getJSONObject("coordinate").getDouble("accuracyMeters"), 0.0)
        assertEquals("gps", location.getJSONObject("coordinate").getString("source"))
        assertEquals("2026-05-02T10:00:00.000Z", location.getJSONObject("coordinate").getString("capturedAt"))
        assertEquals(40.987, entity.latitude ?: 0.0, 0.0)
        assertEquals(29.025, entity.longitude ?: 0.0, 0.0)
        assertEquals("gps", entity.coordinateSource)
        assertEquals("2026-05-02T10:00:00.000Z", entity.coordinateCapturedAt)
        assertEquals(18.5, entity.coordinateAccuracyMeters ?: 0.0, 0.0)
    }

    @Test
    fun remoteMappingPreservesLifecycleAndOperationalMetadata() {
        val entity = JSONObject().apply {
            put("id", "req_remote_1")
            put("helpTypes", JSONArray(listOf("food_water")))
            put("otherHelpText", "")
            put("affectedPeopleCount", 4)
            put("riskFlags", JSONArray(listOf("fire")))
            put("vulnerableGroups", JSONArray(listOf("elderly")))
            put("description", "Need support")
            put("bloodType", "A+")
            put("status", "RESOLVED")
            put("urgencyLevel", "MEDIUM")
            put("priorityLevel", "MEDIUM")
            put("createdAt", "2026-04-26T10:00:00.000Z")
            put("resolvedAt", "2026-04-26T11:30:00.000Z")
            put(
                "location",
                JSONObject().put("country", "Turkey").put("city", "Istanbul").put("district", "Kadikoy")
            )
            put(
                "contact",
                JSONObject().put("fullName", "Ayse Yilmaz").put("phone", "5551234567")
            )
        }.toHelpRequestEntity(
            ownerType = LocalOwnerType.AUTHENTICATED,
            existing = null,
            guestAccessToken = null,
            now = 1234L
        )

        assertEquals("MEDIUM", entity.urgencyLevel)
        assertEquals("MEDIUM", entity.priorityLevel)
        assertEquals("2026-04-26T11:30:00.000Z", entity.resolvedAt)
        assertNull(entity.cancelledAt)
        assertEquals("2026-04-26T10:00:00.000Z", entity.serverCreatedAt)
    }

    @Test
    fun emergencyDraftRequiresRealContactAndLocation() {
        assertThrows(EmergencyDraftRequirementsException::class.java) {
            buildEmergencyDraftSubmission(
                profile = ProfileData(),
                currentLocation = null,
                reverseLocation = null
            )
        }
    }

    @Test
    fun emergencyDraftRejectsInvalidPhoneInsteadOfUsingFakeFallback() {
        assertThrows(EmergencyDraftRequirementsException::class.java) {
            buildEmergencyDraftSubmission(
                profile = completeProfile().copy(phone = null),
                currentLocation = sampleCurrentLocation(),
                reverseLocation = null
            )
        }
    }

    @Test
    fun emergencyDraftDoesNotUseProfileSharedCoordinatesAsEventLocation() {
        assertThrows(EmergencyDraftRequirementsException::class.java) {
            buildEmergencyDraftSubmission(
                profile = completeProfile().copy(
                    shareLocation = true,
                    sharedLatitude = 41.01,
                    sharedLongitude = 29.02
                ),
                currentLocation = null,
                reverseLocation = RequestHelpReverseLocation(
                    country = "Turkey",
                    city = "Istanbul",
                    district = "Kadikoy",
                    neighborhood = "Moda"
                )
            )
        }
    }

    @Test
    fun emergencyDraftUsesVerifiedProfileAndCurrentLocationWithoutFakeValues() {
        val submission = buildEmergencyDraftSubmission(
            profile = completeProfile(),
            currentLocation = sampleCurrentLocation(),
            reverseLocation = RequestHelpReverseLocation(
                country = "Turkey",
                city = "Istanbul",
                district = "Besiktas",
                neighborhood = "Akat",
                extraAddress = "Besiktas assembly area"
            )
        )

        assertEquals("Ayse Yilmaz", submission.contact.fullName)
        assertEquals(5551234567L, submission.contact.phone)
        assertEquals("Turkey", submission.location.country)
        assertEquals("Istanbul", submission.location.city)
        assertEquals("Besiktas", submission.location.district)
        assertEquals("Akat", submission.location.neighborhood)
        assertEquals("Besiktas assembly area", submission.location.extraAddress)
        assertEquals(41.043, submission.location.latitude ?: 0.0, 0.0)
        assertEquals(29.009, submission.location.longitude ?: 0.0, 0.0)
        assertEquals("gps", submission.location.coordinateSource)
        assertEquals(12.0, submission.location.coordinateAccuracyMeters ?: 0.0, 0.0)
        assertTrue(submission.consentGiven)
    }

    private fun sampleSubmission(): RequestHelpSubmission {
        return RequestHelpSubmission(
            helpTypes = listOf("food_water", "first_aid"),
            otherHelpText = "",
            affectedPeopleCount = 3,
            description = "Need water and medication",
            riskFlags = listOf("Flooding"),
            vulnerableGroups = listOf("Elderly"),
            bloodType = "A+",
            location = RequestHelpLocationSubmission(
                country = "Turkey",
                city = "Istanbul",
                district = "Kadikoy",
                neighborhood = "Moda",
                extraAddress = "Near park"
            ),
            contact = RequestHelpContactSubmission(
                fullName = "Ayse Yilmaz",
                phone = 5551234567L,
                alternativePhone = null
            ),
            consentGiven = true
        )
    }

    private fun completeProfile(): ProfileData {
        return ProfileData(
            fullName = "Ayse Yilmaz",
            phone = "+905551234567",
            country = "Turkey",
            city = "Istanbul",
            district = "Kadikoy",
            neighborhood = "Moda",
            extraAddress = "Near park"
        )
    }

    private fun sampleCurrentLocation(): CurrentDeviceLocation {
        return CurrentDeviceLocation(
            latitude = 41.043,
            longitude = 29.009,
            accuracyMeters = 12.0,
            capturedAt = "2026-05-03T10:20:30.000Z",
            source = "DEVICE_GPS"
        )
    }
}
