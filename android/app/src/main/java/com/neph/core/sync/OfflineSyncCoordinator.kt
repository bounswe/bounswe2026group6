package com.neph.core.sync

import android.content.Context
import android.util.Log
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.database.SyncOperationEntity
import com.neph.core.network.ApiException
import com.neph.features.assignedrequest.data.AssignedRequestRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.availability.data.AvailabilityRepository
import com.neph.features.requesthelp.data.RequestHelpRepository

object OfflineSyncCoordinator {
    private const val Tag = "NephOfflineSync"

    suspend fun sync(context: Context): Boolean {
        val appContext = context.applicationContext
        NephDatabaseProvider.initialize(appContext)
        AuthSessionStore.initialize(appContext)
        AvailabilityRepository.initialize(appContext)
        RequestHelpRepository.initialize(appContext)

        val database = NephDatabaseProvider.requireInstance()
        val token = AuthSessionStore.getAccessToken()
        val pendingOperations = database.syncOperationDao().getPendingOperations()
        Log.i(Tag, "Starting sync. Pending operations=${pendingOperations.size}")

        var retryNeeded = false
        val availabilityOperations = pendingOperations.filter {
            it.operationType == SyncOperationType.SET_AVAILABILITY
        }
        val otherOperations = pendingOperations.filterNot {
            it.operationType == SyncOperationType.SET_AVAILABILITY
        }

        for (operation in otherOperations.sortedBy { it.createdAtEpochMillis }) {
            retryNeeded = processOperation(operation, token) || retryNeeded
        }

        if (availabilityOperations.isNotEmpty()) {
            retryNeeded = processAvailabilityOperations(availabilityOperations, token) || retryNeeded
        }

        if (!retryNeeded) {
            retryNeeded = pullLatestRemoteState(token) || retryNeeded
        }

        database.syncOperationDao().deleteSynced()
        Log.i(Tag, "Sync finished. retryNeeded=$retryNeeded")
        return retryNeeded
    }

    private suspend fun processOperation(operation: SyncOperationEntity, token: String?): Boolean {
        val database = NephDatabaseProvider.requireInstance()
        if (operationRequiresAuthentication(operation) && token.isNullOrBlank()) {
            database.syncOperationDao().updateStatus(
                operationId = operation.operationId,
                status = SyncOperationStatus.PENDING,
                attemptCount = operation.attemptCount,
                lastAttemptAtEpochMillis = operation.lastAttemptAtEpochMillis,
                error = "Login required before this offline change can sync."
            )
            return false
        }

        val attempt = operation.attemptCount + 1
        database.syncOperationDao().updateStatus(
            operationId = operation.operationId,
            status = SyncOperationStatus.IN_PROGRESS,
            attemptCount = attempt,
            lastAttemptAtEpochMillis = System.currentTimeMillis(),
            error = null
        )

        return try {
            when (operation.operationType) {
                SyncOperationType.CREATE_HELP_REQUEST -> RequestHelpRepository.pushCreateOperation(operation, token)
                SyncOperationType.UPDATE_HELP_REQUEST_STATUS -> RequestHelpRepository.pushStatusOperation(operation, token)
                SyncOperationType.CANCEL_ASSIGNMENT -> AssignedRequestRepository.pushCancelOperation(operation, token)
            }
            false
        } catch (error: ApiException) {
            if (error.status == 401 && operationRequiresAuthentication(operation)) {
                handleUnauthorizedOperation(operation, error.message)
            } else {
                handleOperationFailure(operation, attempt, error.message, error.status)
            }
        } catch (error: Exception) {
            handleOperationFailure(operation, attempt, error.message, status = 0)
        }
    }

    private suspend fun processAvailabilityOperations(
        operations: List<SyncOperationEntity>,
        token: String?
    ): Boolean {
        val database = NephDatabaseProvider.requireInstance()
        if (token.isNullOrBlank()) {
            operations.forEach { operation ->
                database.syncOperationDao().updateStatus(
                    operationId = operation.operationId,
                    status = SyncOperationStatus.PENDING,
                    attemptCount = operation.attemptCount,
                    lastAttemptAtEpochMillis = operation.lastAttemptAtEpochMillis,
                    error = "Login required before availability can sync."
                )
            }
            return false
        }

        val now = System.currentTimeMillis()
        val attempts = operations.associateWith { it.attemptCount + 1 }
        operations.forEach { operation ->
            database.syncOperationDao().updateStatus(
                operationId = operation.operationId,
                status = SyncOperationStatus.IN_PROGRESS,
                attemptCount = attempts.getValue(operation),
                lastAttemptAtEpochMillis = now,
                error = null
            )
        }

        return try {
            AvailabilityRepository.pushAvailabilityOperations(operations, token)
            false
        } catch (error: ApiException) {
            if (error.status == 401) {
                AuthSessionStore.clearAccessToken()
                operations.forEach { operation ->
                    database.syncOperationDao().updateStatus(
                        operationId = operation.operationId,
                        status = SyncOperationStatus.PENDING,
                        attemptCount = attempts.getValue(operation),
                        lastAttemptAtEpochMillis = now,
                        error = "Session expired. Log in again to sync availability."
                    )
                }
                AvailabilityRepository.markSyncDeferred("Session expired. Log in again to sync availability.")
                return false
            }

            val maxAttempt = attempts.values.maxOrNull() ?: 1
            val retry = SyncConflictPolicy.shouldRetryHttpStatus(error.status, maxAttempt)
            operations.forEach { operation ->
                database.syncOperationDao().updateStatus(
                    operationId = operation.operationId,
                    status = if (retry) SyncOperationStatus.PENDING else SyncOperationStatus.FAILED,
                    attemptCount = attempts.getValue(operation),
                    lastAttemptAtEpochMillis = now,
                    error = error.message
                )
            }
            if (!retry) AvailabilityRepository.markSyncFailed(error.message)
            retry
        } catch (error: Exception) {
            val maxAttempt = attempts.values.maxOrNull() ?: 1
            val retry = SyncConflictPolicy.shouldRetryHttpStatus(0, maxAttempt)
            operations.forEach { operation ->
                database.syncOperationDao().updateStatus(
                    operationId = operation.operationId,
                    status = if (retry) SyncOperationStatus.PENDING else SyncOperationStatus.FAILED,
                    attemptCount = attempts.getValue(operation),
                    lastAttemptAtEpochMillis = now,
                    error = error.message
                )
            }
            if (!retry) AvailabilityRepository.markSyncFailed(error.message)
            retry
        }
    }


    private suspend fun operationRequiresAuthentication(operation: SyncOperationEntity): Boolean {
        if (operation.entityType == SyncEntityType.AVAILABILITY || operation.entityType == SyncEntityType.ASSIGNED_REQUEST) {
            return true
        }

        if (operation.entityType != SyncEntityType.HELP_REQUEST) {
            return false
        }

        val entity = NephDatabaseProvider.requireInstance().helpRequestDao().getByLocalId(operation.entityId)
            ?: return false
        return entity.ownerType == LocalOwnerType.AUTHENTICATED
    }

    private suspend fun pullLatestRemoteState(token: String?): Boolean {
        return try {
            if (!token.isNullOrBlank()) {
                RequestHelpRepository.refreshAuthenticatedHelpRequests(token)
                AvailabilityRepository.refreshAssignmentState(token)
                AssignedRequestRepository.fetchCurrentAssignment(token)
            }
            RequestHelpRepository.refreshGuestHelpRequests()
            false
        } catch (error: ApiException) {
            if (error.status == 401) {
                AuthSessionStore.clearAccessToken()
                false
            } else {
                SyncConflictPolicy.shouldRetryHttpStatus(error.status, attemptCount = 1)
            }
        } catch (_: Exception) {
            true
        }
    }


    private suspend fun handleUnauthorizedOperation(
        operation: SyncOperationEntity,
        message: String?
    ): Boolean {
        val database = NephDatabaseProvider.requireInstance()
        AuthSessionStore.clearAccessToken()
        val displayMessage = message?.takeIf { it.isNotBlank() }
            ?: "Session expired. Log in again to sync this offline change."
        database.syncOperationDao().updateStatus(
            operationId = operation.operationId,
            status = SyncOperationStatus.PENDING,
            attemptCount = operation.attemptCount,
            lastAttemptAtEpochMillis = System.currentTimeMillis(),
            error = displayMessage
        )

        when (operation.entityType) {
            SyncEntityType.HELP_REQUEST -> {
                database.helpRequestDao().getByLocalId(operation.entityId)?.let { entity ->
                    database.helpRequestDao().upsert(
                        entity.copy(
                            pendingError = displayMessage,
                            updatedAtEpochMillis = System.currentTimeMillis()
                        )
                    )
                }
            }
            SyncEntityType.AVAILABILITY -> AvailabilityRepository.markSyncDeferred(displayMessage)
        }
        return false
    }

    private suspend fun handleOperationFailure(
        operation: SyncOperationEntity,
        attempt: Int,
        message: String?,
        status: Int
    ): Boolean {
        val database = NephDatabaseProvider.requireInstance()
        val retry = SyncConflictPolicy.shouldRetryHttpStatus(status, attempt)
        database.syncOperationDao().updateStatus(
            operationId = operation.operationId,
            status = if (retry) SyncOperationStatus.PENDING else SyncOperationStatus.FAILED,
            attemptCount = attempt,
            lastAttemptAtEpochMillis = System.currentTimeMillis(),
            error = message
        )

        if (!retry) {
            when (operation.entityType) {
                SyncEntityType.HELP_REQUEST -> {
                    database.helpRequestDao().getByLocalId(operation.entityId)?.let { entity ->
                        database.helpRequestDao().upsert(
                            entity.copy(
                                syncStatus = if (status == 409) SyncStatus.CONFLICTED else SyncStatus.FAILED,
                                pendingError = message,
                                updatedAtEpochMillis = System.currentTimeMillis()
                            )
                        )
                    }
                }
                SyncEntityType.ASSIGNED_REQUEST -> AssignedRequestRepository.markCancelFailed(operation.entityId, message)
            }
        }
        return retry
    }
}
