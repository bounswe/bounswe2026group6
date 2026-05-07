package com.neph.ui.map

import com.neph.features.profile.data.locationData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NephMapIntegrationTest {
    @Test
    fun buildLocationSelectionMapQuery_resolvesLabelsFromSelectionKeys() {
        val query = buildLocationSelectionMapQuery(
            countryKeyOrLabel = "tr",
            cityKeyOrLabel = "istanbul",
            districtKeyOrLabel = "besiktas",
            neighborhoodValueOrLabel = "balmumcu",
            extraAddress = "Buyukdere Cd.",
            locations = locationData
        )

        assertEquals("Buyukdere Cd., Balmumcu, Beşiktaş, Istanbul, Turkey", query)
    }

    @Test
    fun buildLocationSelectionMapQuery_returnsEmptyWhenAllPartsAreBlank() {
        val query = buildLocationSelectionMapQuery(
            countryKeyOrLabel = "",
            cityKeyOrLabel = "",
            districtKeyOrLabel = "",
            neighborhoodValueOrLabel = "",
            extraAddress = " ",
            locations = locationData
        )

        assertTrue(query.isBlank())
    }

    @Test
    fun formatMapCoordinate_formatsToFiveDecimals() {
        assertEquals("41.01235", formatMapCoordinate(41.0123456))
    }
}
