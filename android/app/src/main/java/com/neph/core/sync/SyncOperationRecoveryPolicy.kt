package com.neph.core.sync

import java.util.concurrent.TimeUnit

object SyncOperationRecoveryPolicy {
    val InProgressRecoveryTimeoutMillis: Long = TimeUnit.MINUTES.toMillis(15)

    fun staleInProgressCutoff(nowEpochMillis: Long): Long {
        return nowEpochMillis - InProgressRecoveryTimeoutMillis
    }

    fun isStaleInProgress(
        status: String,
        lastAttemptAtEpochMillis: Long?,
        nowEpochMillis: Long
    ): Boolean {
        if (status != SyncOperationStatus.IN_PROGRESS) {
            return false
        }

        return lastAttemptAtEpochMillis == null ||
            lastAttemptAtEpochMillis <= staleInProgressCutoff(nowEpochMillis)
    }
}
