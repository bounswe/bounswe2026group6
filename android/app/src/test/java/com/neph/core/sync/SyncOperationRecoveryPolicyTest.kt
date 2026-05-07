package com.neph.core.sync

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SyncOperationRecoveryPolicyTest {
    @Test
    fun inProgressOperationAtOrBeyondRecoveryTimeoutIsStale() {
        val now = 1_000_000L
        val cutoff = SyncOperationRecoveryPolicy.staleInProgressCutoff(now)

        assertTrue(
            SyncOperationRecoveryPolicy.isStaleInProgress(
                status = SyncOperationStatus.IN_PROGRESS,
                lastAttemptAtEpochMillis = cutoff,
                nowEpochMillis = now
            )
        )
    }

    @Test
    fun recentInProgressOperationIsNotStale() {
        val now = 1_000_000L
        val recentAttempt = SyncOperationRecoveryPolicy.staleInProgressCutoff(now) + 1

        assertFalse(
            SyncOperationRecoveryPolicy.isStaleInProgress(
                status = SyncOperationStatus.IN_PROGRESS,
                lastAttemptAtEpochMillis = recentAttempt,
                nowEpochMillis = now
            )
        )
    }

    @Test
    fun inProgressOperationWithoutAttemptTimestampIsStale() {
        assertTrue(
            SyncOperationRecoveryPolicy.isStaleInProgress(
                status = SyncOperationStatus.IN_PROGRESS,
                lastAttemptAtEpochMillis = null,
                nowEpochMillis = 1_000_000L
            )
        )
    }

    @Test
    fun pendingOperationIsNotRecoveredByInProgressPolicy() {
        assertFalse(
            SyncOperationRecoveryPolicy.isStaleInProgress(
                status = SyncOperationStatus.PENDING,
                lastAttemptAtEpochMillis = null,
                nowEpochMillis = 1_000_000L
            )
        )
    }
}
