package com.neph.features.profile.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProfileRepositoryLocationPayloadTest {
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
