package com.neph.ui.map

import com.neph.features.profile.data.locationData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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

    @Test
    fun isValidCoordinate_acceptsFiniteDestinationCoordinatesInRange() {
        assertTrue(
            NephMapIntegration.isValidCoordinate(
                latitude = 41.0082,
                longitude = 28.9784
            )
        )
        assertTrue(NephMapIntegration.isValidCoordinate(latitude = -90.0, longitude = -180.0))
        assertTrue(NephMapIntegration.isValidCoordinate(latitude = 90.0, longitude = 180.0))
    }

    @Test
    fun isValidCoordinate_rejectsLatitudeBelowRange() {
        assertFalse(NephMapIntegration.isValidCoordinate(latitude = -90.0001, longitude = 28.9784))
    }

    @Test
    fun isValidCoordinate_rejectsLatitudeAboveRange() {
        assertFalse(NephMapIntegration.isValidCoordinate(latitude = 90.0001, longitude = 28.9784))
    }

    @Test
    fun isValidCoordinate_rejectsLongitudeBelowRange() {
        assertFalse(NephMapIntegration.isValidCoordinate(latitude = 41.0082, longitude = -180.0001))
    }

    @Test
    fun isValidCoordinate_rejectsLongitudeAboveRange() {
        assertFalse(NephMapIntegration.isValidCoordinate(latitude = 41.0082, longitude = 180.0001))
    }

    @Test
    fun isValidCoordinate_rejectsNaNValues() {
        assertFalse(NephMapIntegration.isValidCoordinate(latitude = Double.NaN, longitude = 28.9784))
        assertFalse(NephMapIntegration.isValidCoordinate(latitude = 41.0082, longitude = Double.NaN))
    }

    @Test
    fun isValidCoordinate_rejectsInfiniteValues() {
        assertFalse(
            NephMapIntegration.isValidCoordinate(
                latitude = Double.POSITIVE_INFINITY,
                longitude = 28.9784
            )
        )
        assertFalse(
            NephMapIntegration.isValidCoordinate(
                latitude = 41.0082,
                longitude = Double.NEGATIVE_INFINITY
            )
        )
    }

    @Test
    fun buildDirectionsNavigationUri_returnsGoogleNavigationUriForValidDestination() {
        assertEquals(
            "google.navigation:q=41.0082,28.9784",
            NephMapIntegration.buildDirectionsNavigationUri(
                latitude = 41.0082,
                longitude = 28.9784,
                label = "Istanbul"
            )
        )
    }

    @Test
    fun buildDirectionsBrowserUrl_returnsGoogleMapsDirectionsUrlForValidDestination() {
        assertEquals(
            "https://www.google.com/maps/dir/?api=1&destination=41.0082,28.9784",
            NephMapIntegration.buildDirectionsBrowserUrl(
                latitude = 41.0082,
                longitude = 28.9784,
                label = "Istanbul"
            )
        )
    }

    @Test
    fun buildDirectionsOutputs_returnNullForInvalidDestination() {
        assertNull(
            NephMapIntegration.buildDirectionsNavigationUri(
                latitude = 91.0,
                longitude = 28.9784
            )
        )
        assertNull(
            NephMapIntegration.buildDirectionsBrowserUrl(
                latitude = 41.0082,
                longitude = 181.0
            )
        )
    }

    @Test
    fun buildDirectionsNavigationUri_remainsSeparateFromCoordinateOpeningUri() {
        val directionsUri = NephMapIntegration.buildDirectionsNavigationUri(
            latitude = 41.0082,
            longitude = 28.9784,
            label = "Istanbul"
        )

        assertTrue(directionsUri?.startsWith("google.navigation:") == true)
        assertFalse(directionsUri?.startsWith("geo:") == true)
    }
}
