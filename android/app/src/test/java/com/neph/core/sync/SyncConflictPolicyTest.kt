package com.neph.core.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SyncConflictPolicyTest {
    @Test
    fun syncedLocalRowsAcceptRemoteState() {
        val decision = SyncConflictPolicy.decideHelpRequestRemoteMerge(
            localSyncStatus = SyncStatus.SYNCED,
            localStatus = "SYNCED",
            remoteStatus = "MATCHED"
        )

        assertTrue(decision.shouldApplyRemote)
        assertEquals(SyncStatus.SYNCED, decision.nextSyncStatus)
    }

    @Test
    fun pendingCreateDoesNotGetOverwrittenByRemoteRefresh() {
        val decision = SyncConflictPolicy.decideHelpRequestRemoteMerge(
            localSyncStatus = SyncStatus.PENDING_CREATE,
            localStatus = "PENDING_SYNC",
            remoteStatus = "SYNCED"
        )

        assertFalse(decision.shouldApplyRemote)
        assertEquals(SyncStatus.PENDING_CREATE, decision.nextSyncStatus)
    }

    @Test
    fun terminalRemoteMismatchBecomesExplicitConflict() {
        val decision = SyncConflictPolicy.decideHelpRequestRemoteMerge(
            localSyncStatus = SyncStatus.PENDING_UPDATE,
            localStatus = "RESOLVED",
            remoteStatus = "CANCELLED"
        )

        assertFalse(decision.shouldApplyRemote)
        assertEquals(SyncStatus.CONFLICTED, decision.nextSyncStatus)
        assertTrue(decision.reason.orEmpty().contains("cancelled"))
    }

    @Test
    fun retryPolicyRetriesTransientErrorsOnlyWithinAttemptBudget() {
        assertTrue(SyncConflictPolicy.shouldRetryHttpStatus(status = 0, attemptCount = 1))
        assertTrue(SyncConflictPolicy.shouldRetryHttpStatus(status = 503, attemptCount = 2))
        assertFalse(SyncConflictPolicy.shouldRetryHttpStatus(status = 409, attemptCount = 1))
        assertFalse(SyncConflictPolicy.shouldRetryHttpStatus(status = 503, attemptCount = 5))
    }
}
