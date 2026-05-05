package com.neph.features.operationallocation.data

import com.neph.core.sync.SyncStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OperationalLocationRepositoryTest {
    @Test
    fun shouldRefreshLocationReturnsTrueWhenNoCachedLocationExists() {
        assertTrue(
            OperationalLocationRepository.shouldRefreshLocation(
                latest = null,
                nowEpochMillis = Now
            )
        )
    }

    @Test
    fun shouldRefreshLocationReturnsFalseWhenCachedLocationIsFresh() {
        val latest = operationalLocation(
            updatedAtEpochMillis = Now - OperationalLocationRepository.OPERATIONAL_LOCATION_REFRESH_THROTTLE + 1
        )

        assertFalse(
            OperationalLocationRepository.shouldRefreshLocation(
                latest = latest,
                nowEpochMillis = Now
            )
        )
    }

    @Test
    fun shouldRefreshLocationReturnsTrueWhenCachedLocationIsStale() {
        val latest = operationalLocation(
            updatedAtEpochMillis = Now - OperationalLocationRepository.OPERATIONAL_LOCATION_REFRESH_THROTTLE
        )

        assertTrue(
            OperationalLocationRepository.shouldRefreshLocation(
                latest = latest,
                nowEpochMillis = Now
            )
        )
    }

    @Test
    fun failedSyncStatusDoesNotRefreshLocationTimestamp() {
        val staleLocation = operationalLocation(
            updatedAtEpochMillis = Now - OperationalLocationRepository.OPERATIONAL_LOCATION_REFRESH_THROTTLE - 1,
            syncStatus = SyncStatus.PENDING_UPDATE
        )

        val failed = OperationalLocationRepository.withSyncStatus(staleLocation, SyncStatus.PENDING_UPDATE)

        assertEquals(staleLocation.updatedAtEpochMillis, failed.updatedAtEpochMillis)
        assertTrue(
            OperationalLocationRepository.shouldRefreshLocation(
                latest = failed,
                nowEpochMillis = Now
            )
        )
    }

    @Test
    fun successfulSyncStatusDoesNotRefreshLocationTimestamp() {
        val staleLocation = operationalLocation(
            updatedAtEpochMillis = Now - OperationalLocationRepository.OPERATIONAL_LOCATION_REFRESH_THROTTLE - 1,
            syncStatus = SyncStatus.PENDING_UPDATE
        )

        val synced = OperationalLocationRepository.withSyncStatus(staleLocation, SyncStatus.SYNCED)

        assertEquals(staleLocation.updatedAtEpochMillis, synced.updatedAtEpochMillis)
        assertTrue(
            OperationalLocationRepository.shouldRefreshLocation(
                latest = synced,
                nowEpochMillis = Now
            )
        )
    }

    @Test
    fun guestModeDoesNotUseAuthenticatedSyncPath() {
        assertFalse(OperationalLocationRepository.shouldSyncForSession(token = "token", isGuest = true))
        assertFalse(OperationalLocationRepository.shouldSyncForSession(token = null, isGuest = false))
        assertTrue(OperationalLocationRepository.shouldSyncForSession(token = "token", isGuest = false))
    }

    private fun operationalLocation(
        updatedAtEpochMillis: Long,
        syncStatus: String? = null
    ): OperationalLocation {
        return OperationalLocation(
            latitude = 41.0,
            longitude = 29.0,
            accuracyMeters = 10f,
            source = "gps",
            capturedAt = updatedAtEpochMillis,
            updatedAtEpochMillis = updatedAtEpochMillis,
            syncStatus = syncStatus
        )
    }

    companion object {
        private const val Now = 1_777_777_777_000L
    }
}
