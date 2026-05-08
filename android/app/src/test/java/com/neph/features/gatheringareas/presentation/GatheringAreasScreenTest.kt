package com.neph.features.gatheringareas.presentation

import com.neph.core.network.ApiException
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
}
