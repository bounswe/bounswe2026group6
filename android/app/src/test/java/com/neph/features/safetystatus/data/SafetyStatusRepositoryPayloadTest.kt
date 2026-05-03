package com.neph.features.safetystatus.data

import com.neph.features.profile.data.CurrentDeviceLocation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SafetyStatusRepositoryPayloadTest {
    @Test
    fun markSafePayloadDoesNotShareLocationWithoutExplicitConsent() {
        val payload = SafetyStatusRepository.buildMarkSafePayload(
            location = sampleLocation(),
            shareLocationConsent = false
        )

        assertEquals("safe", payload.getString("status"))
        assertFalse(payload.getBoolean("shareLocationConsent"))
        assertTrue(payload.has("location"))
        assertTrue(payload.isNull("location"))
    }

    @Test
    fun markSafePayloadSharesLocationOnlyAfterExplicitConsent() {
        val payload = SafetyStatusRepository.buildMarkSafePayload(
            note = "With neighbors",
            location = sampleLocation(),
            shareLocationConsent = true
        )

        assertEquals("safe", payload.getString("status"))
        assertEquals("With neighbors", payload.getString("note"))
        assertTrue(payload.getBoolean("shareLocationConsent"))

        val location = payload.getJSONObject("location")
        assertEquals(41.043, location.getDouble("latitude"), 0.0)
        assertEquals(29.009, location.getDouble("longitude"), 0.0)
        assertEquals(12.5, location.getDouble("accuracyMeters"), 0.0)
        assertEquals("DEVICE_GPS", location.getString("source"))
        assertEquals("2026-05-03T10:20:30.000Z", location.getString("capturedAt"))
    }

    private fun sampleLocation(): CurrentDeviceLocation {
        return CurrentDeviceLocation(
            latitude = 41.043,
            longitude = 29.009,
            accuracyMeters = 12.5,
            capturedAt = "2026-05-03T10:20:30.000Z",
            source = "DEVICE_GPS"
        )
    }
}
