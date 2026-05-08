package com.neph.ui.map

import com.neph.features.profile.data.locationData
import com.neph.features.requesthelp.data.RequestHelpReverseLocation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MapPickerMappingTest {
    @Test
    fun initialMapPickerSelection_requiresFiniteLatitudeAndLongitude() {
        assertEquals(
            MapPickerSelection(latitude = 41.0, longitude = 29.0),
            initialMapPickerSelection(latitude = 41.0, longitude = 29.0)
        )
        assertNull(initialMapPickerSelection(latitude = 41.0, longitude = null))
        assertNull(initialMapPickerSelection(latitude = Double.NaN, longitude = 29.0))
        assertNull(initialMapPickerSelection(latitude = 41.0, longitude = Double.POSITIVE_INFINITY))
    }

    @Test
    fun resolveMapPickerLocationUpdate_mapsFullReverseLocationLabels() {
        val result = resolveMapPickerLocationUpdate(
            currentCountry = "",
            currentCity = "",
            currentDistrict = "",
            currentNeighborhood = "",
            currentExtraAddress = "",
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
        assertEquals("Buyukdere Cd.", result.extraAddress)
        assertEquals(true, result.hasStructuredMatch)
        assertEquals(true, result.isMeaningfulMapping)
    }

    @Test
    fun resolveMapPickerLocationUpdate_mapsCountryAndCityAndClearsDependentOnCityChange() {
        val result = resolveMapPickerLocationUpdate(
            currentCountry = "tr",
            currentCity = "ankara",
            currentDistrict = "cankaya",
            currentNeighborhood = "anittepe",
            currentExtraAddress = "Old Address",
            reverseLocation = RequestHelpReverseLocation(
                countryCode = "TR",
                country = "Turkey",
                city = "Istanbul",
                district = "Unknown District",
                neighborhood = "Unknown Neighborhood",
                extraAddress = "New Address"
            ),
            locations = locationData
        )

        assertEquals("tr", result.country)
        assertEquals("istanbul", result.city)
        assertEquals("", result.district)
        assertEquals("", result.neighborhood)
        assertEquals("New Address", result.extraAddress)
        assertEquals(true, result.hasStructuredMatch)
        assertEquals(false, result.isMeaningfulMapping)
    }

    @Test
    fun resolveMapPickerLocationUpdate_keepsExistingCityWhenReverseHasOnlyCountry() {
        val result = resolveMapPickerLocationUpdate(
            currentCountry = "tr",
            currentCity = "ankara",
            currentDistrict = "cankaya",
            currentNeighborhood = "anittepe",
            currentExtraAddress = "Existing Address",
            reverseLocation = RequestHelpReverseLocation(
                countryCode = "TR",
                country = "Turkey",
                city = null,
                district = null,
                neighborhood = null,
                extraAddress = null
            ),
            locations = locationData
        )

        assertEquals("tr", result.country)
        assertEquals("ankara", result.city)
        assertEquals("cankaya", result.district)
        assertEquals("anittepe", result.neighborhood)
        assertEquals("Existing Address", result.extraAddress)
        assertEquals(true, result.hasStructuredMatch)
        assertEquals(false, result.isMeaningfulMapping)
    }

    @Test
    fun resolveMapPickerLocationUpdate_updatesDistrictAndClearsNeighborhoodWhenMissing() {
        val result = resolveMapPickerLocationUpdate(
            currentCountry = "tr",
            currentCity = "istanbul",
            currentDistrict = "kadikoy",
            currentNeighborhood = "bostanci",
            currentExtraAddress = "Existing Address",
            reverseLocation = RequestHelpReverseLocation(
                countryCode = "TR",
                country = "Turkey",
                city = "Istanbul",
                district = "Beşiktaş",
                neighborhood = null,
                extraAddress = null
            ),
            locations = locationData
        )

        assertEquals("tr", result.country)
        assertEquals("istanbul", result.city)
        assertEquals("besiktas", result.district)
        assertEquals("", result.neighborhood)
        assertEquals("Existing Address", result.extraAddress)
        assertEquals(true, result.hasStructuredMatch)
        assertEquals(false, result.isMeaningfulMapping)
    }

    @Test
    fun resolveMapPickerLocationUpdate_keepsValuesWhenReverseLocationIsNull() {
        val result = resolveMapPickerLocationUpdate(
            currentCountry = "tr",
            currentCity = "ankara",
            currentDistrict = "cankaya",
            currentNeighborhood = "anittepe",
            currentExtraAddress = "Existing Address",
            reverseLocation = null,
            locations = locationData
        )

        assertEquals("tr", result.country)
        assertEquals("ankara", result.city)
        assertEquals("cankaya", result.district)
        assertEquals("anittepe", result.neighborhood)
        assertEquals("Existing Address", result.extraAddress)
        assertEquals(false, result.hasStructuredMatch)
        assertEquals(false, result.isMeaningfulMapping)
    }

    @Test
    fun resolveMapPickerLocationUpdate_keepsLocationWhenReverseLocationCannotMap() {
        val result = resolveMapPickerLocationUpdate(
            currentCountry = "tr",
            currentCity = "ankara",
            currentDistrict = "cankaya",
            currentNeighborhood = "anittepe",
            currentExtraAddress = "Existing Address",
            reverseLocation = RequestHelpReverseLocation(
                countryCode = null,
                country = "Unknown Country",
                city = "Unknown City",
                district = null,
                neighborhood = null,
                extraAddress = "Pinned Address"
            ),
            locations = locationData
        )

        assertEquals("tr", result.country)
        assertEquals("ankara", result.city)
        assertEquals("cankaya", result.district)
        assertEquals("anittepe", result.neighborhood)
        assertEquals("Existing Address", result.extraAddress)
        assertEquals(false, result.hasStructuredMatch)
        assertEquals(false, result.isMeaningfulMapping)
    }
}
