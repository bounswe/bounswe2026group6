package com.neph.features.helprequestmap.presentation

import com.neph.features.helprequestmap.data.ActiveHelpRequestMapItem
import com.neph.features.helprequestmap.data.CrisisRequestType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HelpRequestMapScreenFilterLogicTest {
    private val firstAid = request(
        requestId = "req-first-aid",
        type = CrisisRequestType.FIRST_AID,
        typeLabel = "First Aid"
    )
    private val shelter = request(
        requestId = "req-shelter",
        type = CrisisRequestType.SHELTER,
        typeLabel = "Shelter"
    )
    private val foodWater = request(
        requestId = "req-food",
        type = CrisisRequestType.FOOD_WATER,
        typeLabel = "Food / Water Supplies"
    )

    @Test
    fun filterVisibleRequests_whenNoTypeSelected_returnsAllRequests() {
        val requests = listOf(firstAid, shelter, foodWater)

        val visible = filterVisibleRequests(requests, emptySet())

        assertEquals(requests.map { it.requestId }, visible.map { it.requestId })
    }

    @Test
    fun filterVisibleRequests_whenMultipleTypesSelected_returnsMatchingUnion() {
        val requests = listOf(firstAid, shelter, foodWater)

        val visible = filterVisibleRequests(
            requests = requests,
            selectedTypes = setOf(CrisisRequestType.SHELTER, CrisisRequestType.FOOD_WATER)
        )

        assertEquals(listOf("req-shelter", "req-food"), visible.map { it.requestId })
    }

    @Test
    fun reconcileSelectedRequestId_whenSelectedItemFilteredOut_returnsNull() {
        val visible = listOf(shelter, foodWater)

        val selected = reconcileSelectedRequestId("req-first-aid", visible)

        assertNull(selected)
    }

    @Test
    fun reconcileSelectedRequestId_whenSelectedItemStillVisible_keepsSelection() {
        val visible = listOf(shelter, foodWater)

        val selected = reconcileSelectedRequestId("req-shelter", visible)

        assertEquals("req-shelter", selected)
    }

    private fun request(
        requestId: String,
        type: CrisisRequestType,
        typeLabel: String
    ): ActiveHelpRequestMapItem {
        return ActiveHelpRequestMapItem(
            requestId = requestId,
            rawType = type.name.lowercase(),
            type = type,
            typeLabel = typeLabel,
            priorityLevel = "MEDIUM",
            createdAt = "2026-05-01T10:00:00.000Z",
            latitude = 41.0,
            longitude = 29.0,
            city = "istanbul",
            district = "sisli"
        )
    }
}
