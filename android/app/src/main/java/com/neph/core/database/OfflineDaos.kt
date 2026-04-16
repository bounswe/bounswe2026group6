package com.neph.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface HelpRequestDao {
    @Query(
        """
        SELECT * FROM help_requests
        WHERE ownerType = :ownerType AND isDeleted = 0
        ORDER BY
            CASE WHEN status NOT IN ('RESOLVED', 'CANCELLED') THEN 0 ELSE 1 END,
            createdAtEpochMillis DESC
        """
    )
    fun observeByOwner(ownerType: String): Flow<List<HelpRequestEntity>>

    @Query(
        """
        SELECT * FROM help_requests
        WHERE ownerType = :ownerType AND isDeleted = 0
        ORDER BY
            CASE WHEN status NOT IN ('RESOLVED', 'CANCELLED') THEN 0 ELSE 1 END,
            createdAtEpochMillis DESC
        """
    )
    suspend fun getByOwner(ownerType: String): List<HelpRequestEntity>

    @Query("SELECT * FROM help_requests WHERE localId = :localId LIMIT 1")
    suspend fun getByLocalId(localId: String): HelpRequestEntity?

    @Query("SELECT * FROM help_requests WHERE remoteId = :remoteId OR localId = :remoteId LIMIT 1")
    suspend fun getByRemoteId(remoteId: String): HelpRequestEntity?

    @Query(
        """
        SELECT COUNT(*) FROM help_requests
        WHERE ownerType = :ownerType
          AND isDeleted = 0
          AND status NOT IN ('RESOLVED', 'CANCELLED')
          AND syncStatus != 'CONFLICTED'
        """
    )
    suspend fun countActiveByOwner(ownerType: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: HelpRequestEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<HelpRequestEntity>)

    @Query("DELETE FROM help_requests WHERE localId = :localId")
    suspend fun deleteByLocalId(localId: String)
}

@Dao
interface AvailabilityDao {
    @Query("SELECT * FROM availability_state WHERE `key` = 'current' LIMIT 1")
    fun observe(): Flow<AvailabilityEntity?>

    @Query("SELECT * FROM availability_state WHERE `key` = 'current' LIMIT 1")
    suspend fun get(): AvailabilityEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: AvailabilityEntity)
}

@Dao
interface AssignedRequestDao {
    @Query("SELECT * FROM assigned_requests WHERE locallyCancelled = 0 ORDER BY fetchedAtEpochMillis DESC LIMIT 1")
    fun observeCurrent(): Flow<AssignedRequestEntity?>

    @Query("SELECT * FROM assigned_requests ORDER BY fetchedAtEpochMillis DESC LIMIT 1")
    suspend fun getCurrentIncludingPending(): AssignedRequestEntity?

    @Query("SELECT * FROM assigned_requests WHERE assignmentId = :assignmentId LIMIT 1")
    suspend fun getByAssignmentId(assignmentId: String): AssignedRequestEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: AssignedRequestEntity)

    @Query("DELETE FROM assigned_requests WHERE syncStatus = 'SYNCED'")
    suspend fun clearSyncedAssignments()

    @Query("DELETE FROM assigned_requests")
    suspend fun clearAll()
}

@Dao
interface SyncOperationDao {
    @Query(
        """
        SELECT * FROM sync_operations
        WHERE status IN ('PENDING', 'FAILED', 'IN_PROGRESS')
        ORDER BY createdAtEpochMillis ASC
        """
    )
    suspend fun getPendingOperations(): List<SyncOperationEntity>

    @Query(
        """
        SELECT * FROM sync_operations
        WHERE entityType = :entityType
          AND entityId = :entityId
          AND operationType = :operationType
          AND status IN ('PENDING', 'FAILED', 'IN_PROGRESS')
        ORDER BY createdAtEpochMillis DESC
        LIMIT 1
        """
    )
    suspend fun getLatestPendingOperation(
        entityType: String,
        entityId: String,
        operationType: String
    ): SyncOperationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(operation: SyncOperationEntity)

    @Query(
        """
        UPDATE sync_operations
        SET status = :status,
            attemptCount = :attemptCount,
            lastAttemptAtEpochMillis = :lastAttemptAtEpochMillis,
            error = :error
        WHERE operationId = :operationId
        """
    )
    suspend fun updateStatus(
        operationId: String,
        status: String,
        attemptCount: Int,
        lastAttemptAtEpochMillis: Long?,
        error: String?
    )

    @Query("DELETE FROM sync_operations WHERE operationId = :operationId")
    suspend fun delete(operationId: String)

    @Query("DELETE FROM sync_operations WHERE status = 'SYNCED'")
    suspend fun deleteSynced()
}

@Dao
interface SyncMetadataDao {
    @Query("SELECT * FROM sync_metadata WHERE `key` = :key LIMIT 1")
    suspend fun get(key: String): SyncMetadataEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: SyncMetadataEntity)
}
