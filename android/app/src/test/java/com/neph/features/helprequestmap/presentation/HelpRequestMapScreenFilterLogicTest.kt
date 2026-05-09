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

    @Test
    fun helpRequestLeafletMarkers_usesRequestCoordinatesAndStableTypeColors() {
        val markers = helpRequestLeafletMarkers(listOf(firstAid, shelter))

        assertEquals(listOf("req-first-aid", "req-shelter"), markers.map { it.id })
        assertEquals(41.0, markers.first().latitude, 0.0)
        assertEquals(29.0, markers.first().longitude, 0.0)
        assertEquals("First Aid", markers.first().title)
        assertEquals("#B42318", markers.first().strokeColorHex)
        assertEquals("#D94141", markers.first().fillColorHex)
        assertEquals("#1D4ED8", markers.last().strokeColorHex)
        assertEquals("#3B66D8", markers.last().fillColorHex)
    }

    @Test
    fun helpRequestLeafletMarkers_whenNoRequests_returnsEmptyList() {
        val markers = helpRequestLeafletMarkers(emptyList())

        assertEquals(emptyList<String>(), markers.map { it.id })
    }

    @Test
    fun helpRequestLeafletMarkers_ignoresMalformedCoordinatesDefensively() {
        val markers = helpRequestLeafletMarkers(
            listOf(
                firstAid,
                shelter.copy(requestId = "req-invalid", latitude = Double.NaN, longitude = 29.0),
                foodWater.copy(requestId = "req-out-of-range", latitude = 91.0, longitude = 29.0)
            )
        )

        assertEquals(listOf("req-first-aid"), markers.map { it.id })
    }

    @Test
    fun helpRequestMapInstanceKey_staysStableForSameVisibleMarkers() {
        val visible = listOf(firstAid, shelter)

        val firstKey = helpRequestMapInstanceKey(visible)
        val afterSelectionOnlyKey = helpRequestMapInstanceKey(visible)

        assertEquals(firstKey, afterSelectionOnlyKey)
    }

    @Test
    fun helpRequestMapCenter_usesAverageRequestCoordinates() {
        val visible = listOf(
            firstAid.copy(latitude = 40.0, longitude = 28.0),
            shelter.copy(latitude = 42.0, longitude = 30.0)
        )

        val center = helpRequestMapCenter(visible)

        assertEquals(41.0, center.latitude, 0.0)
        assertEquals(29.0, center.longitude, 0.0)
    }

    @Test
    fun helpRequestMapCenter_whenNoRequests_usesTurkeyOverviewCenter() {
        val center = helpRequestMapCenter(emptyList())

        assertEquals(39.0, center.latitude, 0.0)
        assertEquals(35.0, center.longitude, 0.0)
    }

    @Test
    fun helpRequestMapCenter_ignoresMalformedCoordinatesDefensively() {
        val visible = listOf(
            firstAid.copy(latitude = 40.0, longitude = 28.0),
            shelter.copy(latitude = Double.POSITIVE_INFINITY, longitude = 30.0),
            foodWater.copy(latitude = 41.0, longitude = 181.0)
        )

        val center = helpRequestMapCenter(visible)

        assertEquals(40.0, center.latitude, 0.0)
        assertEquals(28.0, center.longitude, 0.0)
    }

    @Test
    fun helpRequestMapCenter_whenOnlyMalformedCoordinates_usesTurkeyOverviewCenter() {
        val visible = listOf(
            firstAid.copy(latitude = Double.NaN, longitude = 28.0),
            shelter.copy(latitude = 41.0, longitude = Double.NEGATIVE_INFINITY)
        )

        val center = helpRequestMapCenter(visible)

        assertEquals(39.0, center.latitude, 0.0)
        assertEquals(35.0, center.longitude, 0.0)
    }

    @Test
    fun requestMarkerStyle_keepsRequestTypeVisualMappingStable() {
        assertEquals("+", requestMarkerStyle(CrisisRequestType.FIRST_AID).glyph)
        assertEquals("SH", requestMarkerStyle(CrisisRequestType.SHELTER).glyph)
        assertEquals("FW", requestMarkerStyle(CrisisRequestType.FOOD_WATER).glyph)
        assertEquals("SR", requestMarkerStyle(CrisisRequestType.SEARCH_AND_RESCUE).glyph)
        assertEquals("?", requestMarkerStyle(CrisisRequestType.OTHER).glyph)
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
