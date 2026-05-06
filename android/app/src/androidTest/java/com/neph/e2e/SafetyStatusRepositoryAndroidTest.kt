package com.neph.e2e

import android.content.Context
import com.neph.core.NephAppContext
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.database.SafetyStatusEntity
import com.neph.core.database.SyncOperationEntity
import com.neph.core.sync.SyncEntityType
import com.neph.core.sync.SyncOperationStatus
import com.neph.core.sync.SyncOperationType
import com.neph.core.sync.SyncStatus
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.LoginDestination
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.profile.data.CurrentDeviceLocation
import com.neph.features.profile.data.ProfileData
import com.neph.features.profile.data.ProfileRepository
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

    @Test
    fun clearLocalCacheRemovesSafetyStatusAndPendingSyncOperation() = runBlocking {
        SafetyStatusRepository.markSafe(
            token = "expired-token",
            location = sampleLocation(),
            shareLocationConsent = true
        )

        assertEquals(SyncStatus.PENDING_UPDATE, SafetyStatusRepository.getSafetyStatusState().syncStatus)
        assertEquals(1, pendingSafetyStatusOperationCount())
        NephDatabaseProvider.requireInstance().syncOperationDao().upsert(
            SyncOperationEntity(
                entityType = SyncEntityType.SAFETY_STATUS,
                entityId = SafetyStatusEntity.CURRENT_KEY,
                operationType = SyncOperationType.SET_SAFETY_STATUS,
                payloadJson = """{"status":"safe"}""",
                createdAtEpochMillis = 1234L,
                status = SyncOperationStatus.IN_PROGRESS
            )
        )

        SafetyStatusRepository.clearLocalCache()

        assertEquals("unknown", SafetyStatusRepository.getSafetyStatusState().status)
        assertEquals(0, pendingSafetyStatusOperationCount())
        assertNull(latestSafetyStatusOperation())
    }

    @Test
    fun accountSwitchClearsQueuedSafetyStatusBeforeItCanSyncForNextUser() = runBlocking {
        ProfileRepository.saveProfile(ProfileData(email = "user-a@example.com"))
        SafetyStatusRepository.markSafe(
            token = "expired-token",
            location = sampleLocation(),
            shareLocationConsent = true
        )
        assertEquals(1, pendingSafetyStatusOperationCount())

        val destination = AuthRepository.login(
            email = "safe.android@example.com",
            password = "Passw0rd!",
            rememberMe = true
        )
        SafetyStatusRepository.syncPendingSafetyStatusNow("access-token-1")

        assertEquals(0, pendingSafetyStatusOperationCount())
        assertEquals("unknown", SafetyStatusRepository.getSafetyStatusState().status)
        assertEquals("unknown", fakeBackend.currentSafetyStatus().status)
        assertNull(fakeBackend.currentSafetyStatus().location)
        assertEquals(0, fakeBackend.profileLocationPatchCount())
        assertEquals(LoginDestination.PROFILE, destination)
    }

    private fun initializeSafetyStatusTestDependencies(context: Context) {
        NephAppContext.initialize(context)
        NephDatabaseProvider.initialize(context)
        AuthSessionStore.initialize(context)
        ProfileRepository.initialize(context)
        SafetyStatusRepository.initialize(context)
    }

    private suspend fun pendingSafetyStatusOperationCount(): Int {
        return NephDatabaseProvider.requireInstance()
            .syncOperationDao()
            .getPendingOperations()
            .count {
                it.entityType == SyncEntityType.SAFETY_STATUS &&
                    it.entityId == SafetyStatusEntity.CURRENT_KEY &&
                    it.operationType == SyncOperationType.SET_SAFETY_STATUS
            }
    }

    private suspend fun latestSafetyStatusOperation(): SyncOperationEntity? {
        return NephDatabaseProvider.requireInstance()
            .syncOperationDao()
            .getLatestPendingOperation(
                entityType = SyncEntityType.SAFETY_STATUS,
                entityId = SafetyStatusEntity.CURRENT_KEY,
                operationType = SyncOperationType.SET_SAFETY_STATUS
            )
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
