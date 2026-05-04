package com.neph.core.database

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.neph.core.sync.SyncOperationStatus
import com.neph.core.sync.SyncStatus
import java.util.UUID

@Entity(
    tableName = "help_requests",
    indices = [
        Index(value = ["ownerType"]),
        Index(value = ["remoteId"]),
        Index(value = ["syncStatus"])
    ]
)
data class HelpRequestEntity(
    @PrimaryKey val localId: String,
    val remoteId: String?,
    val ownerType: String,
    val guestAccessToken: String?,
    val helpTypesJson: String,
    val otherHelpText: String,
    val affectedPeopleCount: Int,
    val riskFlagsJson: String,
    val vulnerableGroupsJson: String,
    val description: String,
    val bloodType: String,
    val country: String,
    val city: String,
    val district: String,
    val neighborhood: String,
    val extraAddress: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val coordinateSource: String? = null,
    val coordinateCapturedAt: String? = null,
    val contactFullName: String,
    val contactPhone: String,
    val contactAlternativePhone: String?,
    val status: String,
    val urgencyLevel: String? = null,
    val priorityLevel: String? = null,
    val resolvedAt: String? = null,
    val cancelledAt: String? = null,
    val helperFirstName: String?,
    val helperLastName: String?,
    val helperPhone: String?,
    val helperProfession: String?,
    val helperExpertise: String?,
    val helpersJson: String,
    val syncStatus: String = SyncStatus.SYNCED,
    val pendingError: String? = null,
    val createdAtEpochMillis: Long,
    val updatedAtEpochMillis: Long,
    val lastSyncedAtEpochMillis: Long? = null,
    val serverCreatedAt: String? = null,
    val isDeleted: Boolean = false
)

@Entity(tableName = "availability_state")
data class AvailabilityEntity(
    @PrimaryKey val key: String = CURRENT_KEY,
    val isAvailable: Boolean,
    val assignmentId: String?,
    val syncStatus: String = SyncStatus.SYNCED,
    val pendingError: String? = null,
    val updatedAtEpochMillis: Long,
    val lastSyncedAtEpochMillis: Long? = null
) {
    companion object {
        const val CURRENT_KEY = "current"
    }
}

@Entity(
    tableName = "assigned_requests",
    indices = [Index(value = ["requestId"]), Index(value = ["syncStatus"])]
)
data class AssignedRequestEntity(
    @PrimaryKey val assignmentId: String,
    val requestId: String,
    val helpType: String,
    val helpTypesJson: String,
    val otherHelpText: String?,
    val description: String,
    val affectedPeopleCount: Int?,
    val riskFlagsJson: String,
    val vulnerableGroupsJson: String,
    val bloodType: String?,
    val locationLabel: String,
    val status: String,
    val urgencyLevel: String? = null,
    val priorityLevel: String? = null,
    val requesterName: String?,
    val requesterEmail: String?,
    val contactFullName: String?,
    val contactPhone: String?,
    val contactAlternativePhone: String?,
    val assignedAt: String?,
    val openedAt: String? = null,
    val syncStatus: String = SyncStatus.SYNCED,
    val pendingError: String? = null,
    val fetchedAtEpochMillis: Long,
    val lastSyncedAtEpochMillis: Long? = null,
    val locallyCancelled: Boolean = false
)

@Entity(
    tableName = "sync_operations",
    indices = [
        Index(value = ["status", "createdAtEpochMillis"]),
        Index(value = ["entityType", "entityId"])
    ]
)
data class SyncOperationEntity(
    @PrimaryKey val operationId: String = UUID.randomUUID().toString(),
    val entityType: String,
    val entityId: String,
    val operationType: String,
    val payloadJson: String,
    val createdAtEpochMillis: Long,
    val attemptCount: Int = 0,
    val lastAttemptAtEpochMillis: Long? = null,
    val status: String = SyncOperationStatus.PENDING,
    val error: String? = null
)

@Entity(tableName = "sync_metadata")
data class SyncMetadataEntity(
    @PrimaryKey val key: String,
    val value: String,
    val updatedAtEpochMillis: Long
)
