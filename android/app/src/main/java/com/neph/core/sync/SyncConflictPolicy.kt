package com.neph.core.sync

data class ConflictDecision(
    val shouldApplyRemote: Boolean,
    val nextSyncStatus: String,
    val reason: String? = null
)

object SyncConflictPolicy {
    private val pendingStatuses = setOf(
        SyncStatus.PENDING_CREATE,
        SyncStatus.PENDING_UPDATE,
        SyncStatus.PENDING_DELETE,
        SyncStatus.FAILED
    )

    fun decideHelpRequestRemoteMerge(
        localSyncStatus: String,
        localStatus: String,
        remoteStatus: String
    ): ConflictDecision {
        if (localSyncStatus == SyncStatus.SYNCED) {
            return ConflictDecision(shouldApplyRemote = true, nextSyncStatus = SyncStatus.SYNCED)
        }

        if (localSyncStatus == SyncStatus.PENDING_CREATE) {
            return ConflictDecision(shouldApplyRemote = false, nextSyncStatus = localSyncStatus)
        }

        if (localSyncStatus in pendingStatuses && statusesEquivalent(localStatus, remoteStatus)) {
            return ConflictDecision(shouldApplyRemote = true, nextSyncStatus = SyncStatus.SYNCED)
        }

        if (localSyncStatus in pendingStatuses && isTerminal(remoteStatus) && !statusesEquivalent(localStatus, remoteStatus)) {
            return ConflictDecision(
                shouldApplyRemote = false,
                nextSyncStatus = SyncStatus.CONFLICTED,
                reason = "Remote request is already ${remoteStatus.lowercase()} while local change is ${localStatus.lowercase()}."
            )
        }

        return ConflictDecision(shouldApplyRemote = false, nextSyncStatus = localSyncStatus)
    }

    fun shouldRetryHttpStatus(status: Int, attemptCount: Int): Boolean {
        if (attemptCount >= 5) return false
        return status == 0 || status == 408 || status == 429 || status >= 500
    }

    fun isTerminal(status: String): Boolean {
        return status.uppercase() in setOf("RESOLVED", "CANCELLED")
    }

    fun statusesEquivalent(first: String, second: String): Boolean {
        return first.trim().uppercase() == second.trim().uppercase()
    }
}
