package com.neph.features.gatheringareas.presentation

import com.neph.core.network.ApiException
import com.neph.features.gatheringareas.data.GatheringAreaItem
import com.neph.features.gatheringareas.data.NearbyGatheringAreasResult
import com.neph.ui.map.LeafletMapViewport
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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
    fun gatheringAreasCurrentLocationZoom_usesDiscoverableLocalZoom() {
        assertEquals(15, GatheringAreasCurrentLocationZoom)
    }

    @Test
    fun gatheringAreasMapEmptyMessage_zoomedOutDoesNotUseTrueEmptyOrFilterEmptyCopy() {
        val message = gatheringAreasMapEmptyMessage(
            blockingLoading = false,
            errorMessage = "",
            currentViewport = viewport(widthKm = 60.0, heightKm = 20.0),
            isFilterEmpty = true,
            currentResult = emptyNearbyResult(source = "overpass")
        )

        assertEquals("Zoom in to see resources in this area.", message)
        assertFalse(message.contains("No Gathering Areas Found"))
        assertFalse(message.contains("selected categories"))
    }

    @Test
    fun gatheringAreasProviderFallbackEmpty_isNotTrueEmptyResult() {
        val fallback = emptyNearbyResult(
            source = "fallback",
            providerErrorCode = "OVERPASS_UNAVAILABLE"
        )

        assertTrue(isGatheringAreasProviderUnavailable(fallback))
        assertFalse(shouldMarkGatheringAreasViewportFetched(fallback))
        assertEquals(
            "Provider did not return markers for this area.",
            gatheringAreasMapEmptyMessage(
                blockingLoading = false,
                errorMessage = "",
                currentViewport = viewport(widthKm = 20.0, heightKm = 20.0),
                isFilterEmpty = false,
                currentResult = fallback
            )
        )
    }

    @Test
    fun gatheringAreasResultHelperMessage_distinguishesStaleCache() {
        val stale = sampleNearbyResult().copy(source = "stale_cache", stale = true)

        assertEquals(
            "Showing cached gathering areas; provider data may be temporarily unavailable.",
            gatheringAreasResultHelperMessage(stale)
        )
        assertTrue(shouldMarkGatheringAreasViewportFetched(stale))
    }

    @Test
    fun shouldShowPreviousGatheringAreasDuringViewportFetch_keepsMarkersForNormalPanOnly() {
        assertTrue(
            shouldShowPreviousGatheringAreasDuringViewportFetch(
                currentResult = sampleNearbyResult(),
                manualRefresh = false
            )
        )
        assertFalse(
            shouldShowPreviousGatheringAreasDuringViewportFetch(
                currentResult = sampleNearbyResult(),
                manualRefresh = true
            )
        )
        assertFalse(
            shouldShowPreviousGatheringAreasDuringViewportFetch(
                currentResult = null,
                manualRefresh = false
            )
        )
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
            providerErrorCode = null,
            stale = false,
            fallbackReason = null,
            categories = emptyList(),
            areas = areas
        )
    }

    private fun emptyNearbyResult(
        source: String,
        providerErrorCode: String? = null
    ): NearbyGatheringAreasResult {
        return NearbyGatheringAreasResult(
            centerLatitude = 41.0,
            centerLongitude = 29.0,
            radiusMeters = 10_000,
            source = source,
            requestedLimit = 50,
            returnedCount = 0,
            skippedCount = 0,
            providerErrorCode = providerErrorCode,
            stale = false,
            fallbackReason = null,
            categories = emptyList(),
            areas = emptyList()
        )
    }

    private fun viewport(widthKm: Double, heightKm: Double): LeafletMapViewport {
        return LeafletMapViewport(
            centerLatitude = 41.0,
            centerLongitude = 29.0,
            north = 41.1,
            south = 40.9,
            east = 29.1,
            west = 29.0,
            zoom = 12,
            widthKm = widthKm,
            heightKm = heightKm,
            widestVisibleDimensionKm = maxOf(widthKm, heightKm)
        )
    }
}
