package com.neph.features.requesthelp.presentation

import com.neph.features.profile.data.locationData
import com.neph.features.requesthelp.data.RequestHelpReverseLocation
import org.junit.Assert.assertEquals
import org.junit.Test

class RequestHelpGuestLocationAutofillTest {
    @Test
    fun resolveGuestLocationAutofillSelection_mapsReverseAdministrativeLabelsToSelectorKeys() {
        val result = resolveGuestLocationAutofillSelection(
            currentCountry = "",
            currentCity = "",
            currentDistrict = "",
            currentNeighborhood = "",
            currentShortAddress = "",
            reverseLocation = RequestHelpReverseLocation(
                countryCode = "TR",
                country = "Turkey",
                city = "Istanbul",
                district = "Beşiktaş",
                neighborhood = "Balmumcu",
                extraAddress = "Buyukdere Cd."
            ),
            locations = locationData
        )

        assertEquals("tr", result.country)
        assertEquals("istanbul", result.city)
        assertEquals("besiktas", result.district)
        assertEquals("balmumcu", result.neighborhood)
        assertEquals("Buyukdere Cd.", result.shortAddress)
    }

    @Test
    fun resolveGuestLocationAutofillSelection_keepsExistingValuesWhenReverseDataCannotBeMapped() {
        val result = resolveGuestLocationAutofillSelection(
            currentCountry = "tr",
            currentCity = "ankara",
            currentDistrict = "cankaya",
            currentNeighborhood = "anittepe",
            currentShortAddress = "Existing Address",
            reverseLocation = RequestHelpReverseLocation(
                countryCode = null,
                country = "Unknown Country",
                city = "Unknown City",
                district = "Unknown District",
                neighborhood = "Unknown Neighborhood",
                extraAddress = null
            ),
            locations = locationData
        )

        assertEquals("tr", result.country)
        assertEquals("ankara", result.city)
        assertEquals("cankaya", result.district)
        assertEquals("anittepe", result.neighborhood)
        assertEquals("Existing Address", result.shortAddress)
    }

    @Test
    fun resolveGuestLocationAutofillSelection_doesNotOverwriteManualLocationValues() {
        val result = resolveGuestLocationAutofillSelection(
            currentCountry = "tr",
            currentCity = "ankara",
            currentDistrict = "cankaya",
            currentNeighborhood = "anittepe",
            currentShortAddress = "Manual Address",
            reverseLocation = RequestHelpReverseLocation(
                countryCode = "TR",
                country = "Turkey",
                city = "Istanbul",
                district = "Beşiktaş",
                neighborhood = "Balmumcu",
                extraAddress = "Autofill Address"
            ),
            locations = locationData
        )

        assertEquals("tr", result.country)
        assertEquals("ankara", result.city)
        assertEquals("cankaya", result.district)
        assertEquals("anittepe", result.neighborhood)
        assertEquals("Manual Address", result.shortAddress)
    }
}
