package com.neph.features.myhelprequests.data

import com.neph.core.database.HelpRequestEntity
import com.neph.core.sync.LocalOwnerType
import com.neph.core.sync.SyncStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MyHelpRequestsRepositoryMappingTest {
    @Test
    fun toUiModelIncludesLifecycleOperationalLabelsForClosedRequests() {
        val model = HelpRequestEntity(
            localId = "local_1",
            remoteId = "req_1",
            ownerType = LocalOwnerType.AUTHENTICATED,
            guestAccessToken = null,
            helpTypesJson = "[\"food_water\"]",
            otherHelpText = "",
            affectedPeopleCount = 2,
            riskFlagsJson = "[\"fire\"]",
            vulnerableGroupsJson = "[]",
            description = "Need bottled water",
            bloodType = "A+",
            country = "Turkey",
            city = "Istanbul",
            district = "Besiktas",
            neighborhood = "Levent",
            extraAddress = "Building A",
            contactFullName = "Ayse Yilmaz",
            contactPhone = "5551234567",
            contactAlternativePhone = null,
            status = "RESOLVED",
            urgencyLevel = "MEDIUM",
            priorityLevel = "MEDIUM",
            resolvedAt = "2026-04-26T12:30:00.000Z",
            cancelledAt = null,
            helperFirstName = null,
            helperLastName = null,
            helperPhone = null,
            helperProfession = null,
            helperExpertise = null,
            helpersJson = "[]",
            syncStatus = SyncStatus.SYNCED,
            pendingError = null,
            createdAtEpochMillis = 0L,
            updatedAtEpochMillis = 0L,
            lastSyncedAtEpochMillis = null,
            serverCreatedAt = "2026-04-26T10:00:00.000Z",
            isDeleted = false
        ).toUiModel()

        assertFalse(model.isActive)
        assertEquals("Medium", model.urgencyLabel)
        assertEquals("Medium", model.priorityLabel)
        assertEquals("Resolved", model.closedStateLabel)
        assertEquals("2026-04-26 12:30:00", model.closedAtLabel)
        assertNotNull(model.openDurationLabel)
    }

    @Test
    fun toUiModelKeepsCancelledRequestsInHistoryAndLeavesMatchedRequestsActive() {
        val cancelledModel = HelpRequestEntity(
            localId = "local_cancelled",
            remoteId = "req_cancelled",
            ownerType = LocalOwnerType.AUTHENTICATED,
            guestAccessToken = null,
            helpTypesJson = "[\"shelter\"]",
            otherHelpText = "",
            affectedPeopleCount = 1,
            riskFlagsJson = "[]",
            vulnerableGroupsJson = "[]",
            description = "Need temporary shelter",
            bloodType = "",
            country = "Turkey",
            city = "Istanbul",
            district = "Sisli",
            neighborhood = "Bomonti",
            extraAddress = "Building C",
            contactFullName = "Ayse Yilmaz",
            contactPhone = "5551234567",
            contactAlternativePhone = null,
            status = "CANCELLED",
            urgencyLevel = null,
            priorityLevel = null,
            resolvedAt = null,
            cancelledAt = "2026-04-26T13:30:00.000Z",
            helperFirstName = null,
            helperLastName = null,
            helperPhone = null,
            helperProfession = null,
            helperExpertise = null,
            helpersJson = "[]",
            syncStatus = SyncStatus.SYNCED,
            pendingError = null,
            createdAtEpochMillis = 0L,
            updatedAtEpochMillis = 0L,
            lastSyncedAtEpochMillis = null,
            serverCreatedAt = "2026-04-26T10:00:00.000Z",
            isDeleted = false
        ).toUiModel()

        val matchedModel = cancelledModel.copy(
            id = "req_matched",
            status = "MATCHED",
            statusLabel = "Responder assigned",
            isActive = true,
            closedAtLabel = null,
            closedStateLabel = null
        )

        assertFalse(cancelledModel.isActive)
        assertEquals("Cancelled", cancelledModel.statusLabel)
        assertEquals("Cancelled", cancelledModel.closedStateLabel)
        assertEquals("2026-04-26 13:30:00", cancelledModel.closedAtLabel)
        assertEquals("Need temporary shelter", cancelledModel.shortDescription)

        assertEquals("MATCHED", matchedModel.status)
        assertTrue(matchedModel.isActive)
        assertEquals("Responder assigned", matchedModel.statusLabel)
    }
}
