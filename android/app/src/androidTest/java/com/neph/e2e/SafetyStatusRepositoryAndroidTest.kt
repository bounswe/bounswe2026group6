package com.neph.e2e

import android.content.Context
import com.neph.core.NephAppContext
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.sync.SyncEntityType
import com.neph.core.sync.SyncOperationType
import com.neph.core.sync.SyncStatus
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.profile.data.CurrentDeviceLocation
import com.neph.features.safetystatus.data.SafetyStatusRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class SafetyStatusRepositoryAndroidTest {
    private val fakeBackend = FakeNephBackend()

    @get:Rule
    val environmentRule = NephE2ETestEnvironmentRule(fakeBackend) { context, backend ->
        backend.seedVerifiedUser(
            email = "safe.android@example.com",
            password = "Passw0rd!",
            profile = FakeProfileState(firstName = "Safe", lastName = "Tester")
        )
        initializeSafetyStatusTestDependencies(context)
        AuthSessionStore.saveAccessToken("access-token-1", rememberMe = true)
    }

    @Test
    fun markSafeWithoutLocationSyncsAndDoesNotTouchProfileLocation() = runBlocking {
        val state = SafetyStatusRepository.markSafe(
            token = "access-token-1",
            location = sampleLocation(),
            shareLocationConsent = false
        )

        assertEquals(SyncStatus.SYNCED, state.syncStatus)
        assertFalse(state.shareLocationConsent)
        assertFalse(state.hasLocation)
        assertEquals("safe", fakeBackend.currentSafetyStatus().status)
        assertNull(fakeBackend.currentSafetyStatus().location)
        assertEquals(0, fakeBackend.profileLocationPatchCount())
    }

    @Test
    fun markSafeWithConsentSyncsOperationalLocationSnapshot() = runBlocking {
        val state = SafetyStatusRepository.markSafe(
            token = "access-token-1",
            location = sampleLocation(),
            shareLocationConsent = true
        )

        val syncedLocation = fakeBackend.currentSafetyStatus().location
        assertEquals(SyncStatus.SYNCED, state.syncStatus)
        assertTrue(state.shareLocationConsent)
        assertEquals(41.043, state.latitude ?: 0.0, 0.0)
        assertEquals(29.009, state.longitude ?: 0.0, 0.0)
        assertEquals(41.043, syncedLocation?.getDouble("latitude") ?: 0.0, 0.0)
        assertEquals(29.009, syncedLocation?.getDouble("longitude") ?: 0.0, 0.0)
        assertEquals(0, fakeBackend.profileLocationPatchCount())
    }

    @Test
    fun expiredTokenKeepsSafetyStatusQueuedForLaterSync() = runBlocking {
        val state = SafetyStatusRepository.markSafe(
            token = "expired-token",
            location = null,
            shareLocationConsent = false
        )
        val operation = NephDatabaseProvider.requireInstance()
            .syncOperationDao()
            .getPendingOperations()
            .single {
                it.entityType == SyncEntityType.SAFETY_STATUS &&
                    it.operationType == SyncOperationType.SET_SAFETY_STATUS
            }

        assertEquals(SyncStatus.PENDING_UPDATE, state.syncStatus)
        assertTrue(state.pendingError.orEmpty().contains("Session expired"))
        assertEquals("current", operation.entityId)
        assertTrue(operation.payloadJson.contains("\"status\":\"safe\""))
        assertEquals(0, fakeBackend.profileLocationPatchCount())
    }

    private fun initializeSafetyStatusTestDependencies(context: Context) {
        NephAppContext.initialize(context)
        NephDatabaseProvider.initialize(context)
        AuthSessionStore.initialize(context)
        SafetyStatusRepository.initialize(context)
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
