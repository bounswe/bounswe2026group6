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

    @Query("SELECT * FROM help_requests WHERE localId = :localId LIMIT 1")
    fun observeByLocalId(localId: String): Flow<HelpRequestEntity?>

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

    @Query("DELETE FROM help_requests WHERE ownerType = :ownerType")
    suspend fun deleteByOwner(ownerType: String)
}

@Dao
interface AvailabilityDao {
    @Query("SELECT * FROM availability_state WHERE `key` = 'current' LIMIT 1")
    fun observe(): Flow<AvailabilityEntity?>

    @Query("SELECT * FROM availability_state WHERE `key` = 'current' LIMIT 1")
    suspend fun get(): AvailabilityEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: AvailabilityEntity)

    @Query("DELETE FROM availability_state")
    suspend fun clear()
}

@Dao
interface OperationalLocationDao {
    @Query("SELECT * FROM operational_location WHERE `key` = 'current' LIMIT 1")
    suspend fun getLatest(): OperationalLocationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: OperationalLocationEntity)

    @Query("DELETE FROM operational_location")
    suspend fun clear()
}

@Dao
interface SafetyStatusDao {
    @Query("SELECT * FROM safety_status WHERE `key` = 'current' LIMIT 1")
    fun observe(): Flow<SafetyStatusEntity?>

    @Query("SELECT * FROM safety_status WHERE `key` = 'current' LIMIT 1")
    suspend fun get(): SafetyStatusEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: SafetyStatusEntity)

    @Query("DELETE FROM safety_status")
    suspend fun clear()
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
interface NearbyVisibleUserDao {
    @Query(
        """
        SELECT * FROM nearby_visible_users
        WHERE cacheOwnerUserId = :cacheOwnerUserId
          AND cacheSource = :cacheSource
        ORDER BY fetchedAtEpochMillis DESC, displayName ASC, userId ASC
        """
    )
    fun observeByCacheOwnerAndSource(
        cacheOwnerUserId: String,
        cacheSource: String
    ): Flow<List<NearbyVisibleUserEntity>>

    @Query(
        """
        SELECT * FROM nearby_visible_users
        WHERE cacheOwnerUserId = :cacheOwnerUserId
          AND cacheSource = :cacheSource
        ORDER BY fetchedAtEpochMillis DESC, displayName ASC, userId ASC
        """
    )
    suspend fun getByCacheOwnerAndSource(
        cacheOwnerUserId: String,
        cacheSource: String
    ): List<NearbyVisibleUserEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(users: List<NearbyVisibleUserEntity>)

    @Query(
        """
        DELETE FROM nearby_visible_users
        WHERE cacheOwnerUserId = :cacheOwnerUserId
          AND cacheSource = :cacheSource
          AND userId NOT IN (:visibleUserIds)
        """
    )
    suspend fun deleteUsersNotIn(
        cacheOwnerUserId: String,
        cacheSource: String,
        visibleUserIds: List<String>
    )

    @Query("DELETE FROM nearby_visible_users WHERE cacheOwnerUserId = :cacheOwnerUserId AND cacheSource = :cacheSource")
    suspend fun clearByCacheOwnerAndSource(cacheOwnerUserId: String, cacheSource: String)

    @Query("DELETE FROM nearby_visible_users WHERE cacheOwnerUserId = :cacheOwnerUserId")
    suspend fun clearByCacheOwner(cacheOwnerUserId: String)

    @Query("DELETE FROM nearby_visible_users WHERE expiresAtEpochMillis <= :nowEpochMillis")
    suspend fun deleteExpired(nowEpochMillis: Long)

    @Query("DELETE FROM nearby_visible_users")
    suspend fun clearAll()
}

@Dao
interface SyncOperationDao {
    @Query(
        """
        SELECT * FROM sync_operations
        WHERE status IN ('PENDING', 'FAILED')
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

    @Query(
        """
        UPDATE sync_operations
        SET status = 'PENDING',
            error = :error
        WHERE status = 'IN_PROGRESS'
          AND (lastAttemptAtEpochMillis IS NULL OR lastAttemptAtEpochMillis <= :staleBeforeEpochMillis)
        """
    )
    suspend fun resetStaleInProgressOperations(
        staleBeforeEpochMillis: Long,
        error: String
    ): Int

    @Query("DELETE FROM sync_operations WHERE operationId = :operationId")
    suspend fun delete(operationId: String)

    @Query(
        """
        DELETE FROM sync_operations
        WHERE entityType = :entityType
          AND entityId = :entityId
          AND operationType = :operationType
        """
    )
    suspend fun deleteOperations(
        entityType: String,
        entityId: String,
        operationType: String
    )

    @Query("DELETE FROM sync_operations WHERE status = 'SYNCED'")
    suspend fun deleteSynced()

    @Query("DELETE FROM sync_operations WHERE entityType = :entityType")
    suspend fun deleteByEntityType(entityType: String)

    @Query(
        """
        DELETE FROM sync_operations
        WHERE entityType = :entityType
          AND entityId IN (
              SELECT localId
              FROM help_requests
              WHERE ownerType = :ownerType
          )
        """
    )
    suspend fun deleteHelpRequestOperationsForOwner(entityType: String, ownerType: String)
}

@Dao
interface SyncMetadataDao {
    @Query("SELECT * FROM sync_metadata WHERE `key` = :key LIMIT 1")
    suspend fun get(key: String): SyncMetadataEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: SyncMetadataEntity)
}
