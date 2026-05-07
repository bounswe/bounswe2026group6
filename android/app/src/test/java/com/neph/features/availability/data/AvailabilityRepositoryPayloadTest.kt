package com.neph.features.availability.data

import com.neph.features.profile.data.CurrentDeviceLocation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AvailabilityRepositoryPayloadTest {
    @Test
    fun buildAvailabilityOperationPayloadIncludesLocationWhenAvailable() {
        val payload = AvailabilityRepository.buildAvailabilityOperationPayload(
            isAvailable = true,
            timestamp = 1_777_777_777_000L,
            currentDeviceLocation = CurrentDeviceLocation(
                latitude = 41.015,
                longitude = 29.01,
                accuracyMeters = 12.5,
                capturedAt = "2026-05-04T10:00:00.000Z"
            )
        )

        assertTrue(payload.getBoolean("isAvailable"))
        assertEquals(41.015, payload.getDouble("latitude"), 0.0)
        assertEquals(29.01, payload.getDouble("longitude"), 0.0)
        assertEquals(12.5, payload.getDouble("accuracyMeters"), 0.0)
        assertEquals("DEVICE_GPS", payload.getString("source"))
        assertEquals("2026-05-04T10:00:00.000Z", payload.getString("capturedAt"))
    }

    @Test
    fun buildAvailabilityOperationPayloadOmitsLocationWhenUnavailable() {
        val payload = AvailabilityRepository.buildAvailabilityOperationPayload(
            isAvailable = false,
            timestamp = 1_777_777_777_000L,
            currentDeviceLocation = CurrentDeviceLocation(
                latitude = 41.015,
                longitude = 29.01,
                accuracyMeters = 12.5,
                capturedAt = "2026-05-04T10:00:00.000Z"
            )
        )

        assertFalse(payload.getBoolean("isAvailable"))
        assertFalse(payload.has("latitude"))
        assertFalse(payload.has("longitude"))
        assertFalse(payload.has("accuracyMeters"))
        assertFalse(payload.has("source"))
        assertFalse(payload.has("capturedAt"))
    }

    @Test
    fun buildAvailabilitySyncRecordCarriesQueuedCoordinates() {
        val payload = AvailabilityRepository.buildAvailabilityOperationPayload(
            isAvailable = true,
            timestamp = 1_777_777_777_000L,
            currentDeviceLocation = CurrentDeviceLocation(
                latitude = 41.015,
                longitude = 29.01,
                accuracyMeters = null,
                capturedAt = "2026-05-04T10:00:00.000Z"
            )
        )

        val record = AvailabilityRepository.buildAvailabilitySyncRecord(payload)

        assertTrue(record.getBoolean("isAvailable"))
        assertEquals(41.015, record.getDouble("latitude"), 0.0)
        assertEquals(29.01, record.getDouble("longitude"), 0.0)
        assertEquals("DEVICE_GPS", record.getString("source"))
        assertEquals("2026-05-04T10:00:00.000Z", record.getString("capturedAt"))
    }
}
