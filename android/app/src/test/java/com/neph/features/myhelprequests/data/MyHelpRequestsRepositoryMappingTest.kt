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

        val matchedModel = HelpRequestEntity(
            localId = "local_matched",
            remoteId = "req_matched",
            ownerType = LocalOwnerType.AUTHENTICATED,
            guestAccessToken = null,
            helpTypesJson = "[\"medical\"]",
            otherHelpText = "",
            affectedPeopleCount = 1,
            riskFlagsJson = "[]",
            vulnerableGroupsJson = "[]",
            description = "Need first aid support",
            bloodType = "",
            country = "Turkey",
            city = "Istanbul",
            district = "Sisli",
            neighborhood = "Bomonti",
            extraAddress = "Building D",
            contactFullName = "Ayse Yilmaz",
            contactPhone = "5551234567",
            contactAlternativePhone = null,
            status = "MATCHED",
            urgencyLevel = null,
            priorityLevel = null,
            resolvedAt = null,
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
            serverCreatedAt = "2026-04-26T11:00:00.000Z",
            isDeleted = false
        ).toUiModel()

        assertFalse(cancelledModel.isActive)
        assertEquals("Cancelled", cancelledModel.statusLabel)
        assertEquals("Cancelled", cancelledModel.closedStateLabel)
        assertEquals("2026-04-26 13:30:00", cancelledModel.closedAtLabel)
        assertEquals("Need temporary shelter", cancelledModel.shortDescription)

        assertEquals("MATCHED", matchedModel.status)
        assertTrue(matchedModel.isActive)
        assertEquals("Responder assigned", matchedModel.statusLabel)
    }

    @Test
    fun buildOverviewSummarizesCurrentAndHistoryContext() {
        val currentActive = HelpRequestEntity(
            localId = "local_active_1",
            remoteId = "req_active_1",
            ownerType = LocalOwnerType.AUTHENTICATED,
            guestAccessToken = null,
            helpTypesJson = "[\"food\"]",
            otherHelpText = "",
            affectedPeopleCount = 1,
            riskFlagsJson = "[]",
            vulnerableGroupsJson = "[]",
            description = "Need food support",
            bloodType = "",
            country = "Turkey",
            city = "Istanbul",
            district = "Kadikoy",
            neighborhood = "Moda",
            extraAddress = "Street 1",
            contactFullName = "Ayse",
            contactPhone = "5550000001",
            contactAlternativePhone = null,
            status = "MATCHED",
            urgencyLevel = "HIGH",
            priorityLevel = "HIGH",
            resolvedAt = null,
            cancelledAt = null,
            helperFirstName = null,
            helperLastName = null,
            helperPhone = null,
            helperProfession = null,
            helperExpertise = null,
            helpersJson = "[{\"firstName\":\"Ece\"}]",
            syncStatus = SyncStatus.SYNCED,
            pendingError = null,
            createdAtEpochMillis = 1L,
            updatedAtEpochMillis = 1L,
            lastSyncedAtEpochMillis = null,
            serverCreatedAt = "2026-04-26T10:00:00.000Z",
            isDeleted = false
        ).toUiModel()

        val cancelled = currentActive.copy(
            id = "req_cancelled_2",
            status = "CANCELLED",
            statusLabel = "Cancelled",
            isActive = false,
            responders = emptyList(),
            closedAtLabel = "2026-04-26 12:30:00",
            closedStateLabel = "Cancelled"
        )

        val resolved = currentActive.copy(
            id = "req_resolved_1",
            status = "RESOLVED",
            statusLabel = "Resolved",
            isActive = false,
            responders = emptyList(),
            closedAtLabel = "2026-04-26 13:30:00",
            closedStateLabel = "Resolved"
        )

        val overview = buildMyHelpRequestsOverview(listOf(currentActive, cancelled, resolved))

        assertEquals(3, overview.totalRequests)
        assertEquals(1, overview.activeCount)
        assertEquals(listOf(currentActive.id), overview.activeRequests.map { it.id })
        assertEquals(listOf(cancelled.id, resolved.id), overview.historyRequests.map { it.id })
        assertEquals(1, overview.cancelledCount)
        assertEquals(1, overview.resolvedCount)
        assertEquals(1, overview.assignedResponderCount)
        assertTrue(overview.hasMultipleRequestContext)
    }
}
