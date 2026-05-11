package com.neph.e2e

import android.content.Context
import com.neph.core.NephAppContext
import com.neph.core.database.HelpRequestEntity
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.database.SafetyStatusEntity
import com.neph.core.database.SyncOperationEntity
import com.neph.core.sync.LocalOwnerType
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
import com.neph.features.requesthelp.data.RequestHelpRepository
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
    fun clearSafeStatusForRequestHelpReplacesSafeStatusWithUnknownAndSyncs() = runBlocking {
        SafetyStatusRepository.markSafe(
            token = "access-token-1",
            location = sampleLocation(),
            shareLocationConsent = true
        )

        val state = SafetyStatusRepository.clearSafeStatusForRequestHelp("access-token-1")

        assertEquals(SyncStatus.SYNCED, state.syncStatus)
        assertEquals("unknown", state.status)
        assertFalse(state.shareLocationConsent)
        assertFalse(state.hasLocation)
        assertEquals("unknown", fakeBackend.currentSafetyStatus().status)
        assertNull(fakeBackend.currentSafetyStatus().location)
        assertNull(latestSafetyStatusOperation())
        assertEquals(0, fakeBackend.profileLocationPatchCount())
    }

    @Test
    fun clearSafeStatusForRequestHelpQueuesUnknownPayloadWhenSyncDeferred() = runBlocking {
        SafetyStatusRepository.markSafe(
            token = "access-token-1",
            location = sampleLocation(),
            shareLocationConsent = true
        )

        val state = SafetyStatusRepository.clearSafeStatusForRequestHelp("expired-token")
        val operation = latestSafetyStatusOperation()

        assertEquals(SyncStatus.PENDING_UPDATE, state.syncStatus)
        assertEquals("unknown", state.status)
        assertFalse(state.shareLocationConsent)
        assertFalse(state.hasLocation)
        assertTrue(state.pendingError.orEmpty().contains("Session expired"))
        assertEquals("current", operation?.entityId)
        assertTrue(operation?.payloadJson.orEmpty().contains("\"status\":\"unknown\""))
        assertTrue(operation?.payloadJson.orEmpty().contains("\"shareLocationConsent\":false"))
        assertTrue(operation?.payloadJson.orEmpty().contains("\"location\":null"))
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

    @Test
    fun cancelActiveAuthenticatedHelpRequestsForMarkSafeQueuesCancelledStatus() = runBlocking {
        val database = NephDatabaseProvider.requireInstance()
        database.helpRequestDao().upsert(activeHelpRequestEntity())

        val cancelledCount = RequestHelpRepository.cancelActiveAuthenticatedHelpRequestsForMarkSafe("access-token-1")
        val request = database.helpRequestDao().getByLocalId("local_help_1")
        val operation = database.syncOperationDao().getLatestPendingOperation(
            entityType = SyncEntityType.HELP_REQUEST,
            entityId = "local_help_1",
            operationType = SyncOperationType.UPDATE_HELP_REQUEST_STATUS
        )

        assertEquals(1, cancelledCount)
        assertEquals("CANCELLED", request?.status)
        assertEquals(SyncStatus.PENDING_UPDATE, request?.syncStatus)
        assertTrue(request?.cancelledAt.orEmpty().isNotBlank())
        assertTrue(operation?.payloadJson.orEmpty().contains("\"status\":\"CANCELLED\""))
    }

    private fun initializeSafetyStatusTestDependencies(context: Context) {
        NephAppContext.initialize(context)
        NephDatabaseProvider.initialize(context)
        AuthSessionStore.initialize(context)
        ProfileRepository.initialize(context)
        RequestHelpRepository.initialize(context)
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

    private fun activeHelpRequestEntity(): HelpRequestEntity {
        return HelpRequestEntity(
            localId = "local_help_1",
            remoteId = "remote_help_1",
            ownerType = LocalOwnerType.AUTHENTICATED,
            guestAccessToken = null,
            helpTypesJson = """["other"]""",
            otherHelpText = "Need help",
            affectedPeopleCount = 1,
            riskFlagsJson = "[]",
            vulnerableGroupsJson = "[]",
            description = "Need help",
            bloodType = "",
            country = "Turkey",
            city = "Istanbul",
            district = "Kadikoy",
            neighborhood = "Moda",
            extraAddress = "",
            contactFullName = "Safe Tester",
            contactPhone = "5551234567",
            contactAlternativePhone = null,
            status = "SYNCED",
            helperFirstName = null,
            helperLastName = null,
            helperPhone = null,
            helperProfession = null,
            helperExpertise = null,
            helpersJson = "[]",
            createdAtEpochMillis = 1000L,
            updatedAtEpochMillis = 1000L
        )
    }
}
