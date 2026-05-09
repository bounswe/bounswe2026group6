package com.neph.features.gatheringareas.presentation

import com.neph.core.network.ApiException
import com.neph.features.gatheringareas.data.GatheringAreaItem
import com.neph.features.gatheringareas.data.NearbyGatheringAreasResult
import org.junit.Assert.assertEquals
import org.junit.Test

class GatheringAreasScreenTest {
    @Test
    fun mapGatheringAreasErrorMessage_mapsTimeoutCode() {
        val error = ApiException("Provider timeout", 504, "OVERPASS_TIMEOUT")

        val message = mapGatheringAreasErrorMessage(error)

        assertEquals("Gathering area lookup timed out. Please try again.", message)
    }

    @Test
    fun mapGatheringAreasErrorMessage_mapsTimeoutStatus() {
        val error = ApiException("Gateway timeout", 504, null)

        val message = mapGatheringAreasErrorMessage(error)

        assertEquals("Gathering area lookup timed out. Please try again.", message)
    }

    @Test
    fun mapGatheringAreasErrorMessage_mapsUnavailableCode() {
        val error = ApiException("Service unavailable", 503, "OVERPASS_UNAVAILABLE")

        val message = mapGatheringAreasErrorMessage(error)

        assertEquals(
            "Nearby gathering areas could not be loaded right now. Please try again later.",
            message
        )
    }

    @Test
    fun mapGatheringAreasErrorMessage_mapsUnavailableStatus() {
        val error = ApiException("Service unavailable", 503, null)

        val message = mapGatheringAreasErrorMessage(error)

        assertEquals(
            "Nearby gathering areas could not be loaded right now. Please try again later.",
            message
        )
    }

    @Test
    fun mapGatheringAreasErrorMessage_fallsBackToApiMessage() {
        val error = ApiException("Something went wrong", 500, "SERVER_ERROR")

        val message = mapGatheringAreasErrorMessage(error)

        assertEquals("Something went wrong", message)
    }

    @Test
    fun gatheringAreasFilterCopy_clarifiesSelectedCategoriesAreVisible() {
        assertEquals("Visible Categories", GatheringAreasVisibleCategoriesTitle)
        assertEquals(
            "Selected categories are shown on the map and in the list.",
            GatheringAreasVisibleCategoriesSubtitle
        )
        assertEquals("Show All Categories", GatheringAreasShowAllCategoriesText)
    }

    @Test
    fun gatheringAreasMapInstanceKey_staysStableForSameCenterAndVisibleMarkers() {
        val result = sampleNearbyResult()
        val visibleAreas = result.areas

        val firstKey = gatheringAreasMapInstanceKey(result, visibleAreas)
        val afterMarkerChangeKey = gatheringAreasMapInstanceKey(result, emptyList())

        assertEquals(firstKey, afterMarkerChangeKey)
    }

    @Test
    fun reconcileGatheringAreaCategoryFilters_whenPreviouslyShowingAll_selectsAllNewCategories() {
        val reconciled = reconcileGatheringAreaCategoryFilters(
            previousOptionKeys = setOf("assembly_point", "shelter"),
            previousSelectedKeys = setOf("assembly_point", "shelter"),
            nextOptionKeys = setOf("hospital", "pharmacy")
        )

        assertEquals(setOf("hospital", "pharmacy"), reconciled)
    }

    @Test
    fun reconcileGatheringAreaCategoryFilters_preservesHiddenCategoriesButShowsNewOnes() {
        val reconciled = reconcileGatheringAreaCategoryFilters(
            previousOptionKeys = setOf("assembly_point", "shelter"),
            previousSelectedKeys = setOf("assembly_point"),
            nextOptionKeys = setOf("assembly_point", "shelter", "hospital")
        )

        assertEquals(setOf("assembly_point", "hospital"), reconciled)
    }

    private fun sampleNearbyResult(): NearbyGatheringAreasResult {
        val areas = listOf(
            GatheringAreaItem(
                id = "area-1",
                osmType = "node",
                name = "Assembly Area",
                category = "assembly_point",
                categoryLabel = "Assembly Point",
                latitude = 41.01,
                longitude = 29.02,
                distanceMeters = 120,
                addressLine = null
            ),
            GatheringAreaItem(
                id = "area-2",
                osmType = "node",
                name = "Shelter",
                category = "shelter",
                categoryLabel = "Shelter",
                latitude = 41.03,
                longitude = 29.04,
                distanceMeters = 340,
                addressLine = "Nearby street"
            )
        )

        return NearbyGatheringAreasResult(
            centerLatitude = 41.0,
            centerLongitude = 29.0,
            radiusMeters = 10_000,
            source = "overpass",
            requestedLimit = 50,
            returnedCount = areas.size,
            skippedCount = 0,
            categories = emptyList(),
            areas = areas
        )
    }
}
