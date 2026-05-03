package com.neph.ui.map

import com.neph.features.profile.data.LocationData
import com.neph.features.profile.data.findCityKeyByLabel
import com.neph.features.profile.data.findCountryKeyByLabel
import com.neph.features.profile.data.findDistrictKeyByLabel
import com.neph.features.profile.data.findNeighborhoodValueByLabel
import com.neph.features.requesthelp.data.RequestHelpReverseLocation

data class MapPickerLocationUpdate(
    val country: String,
    val city: String,
    val district: String,
    val neighborhood: String,
    val extraAddress: String
)

fun resolveMapPickerLocationUpdate(
    currentCountry: String,
    currentCity: String,
    currentDistrict: String,
    currentNeighborhood: String,
    currentExtraAddress: String,
    reverseLocation: RequestHelpReverseLocation?,
    locations: LocationData
): MapPickerLocationUpdate {
    val normalizedExtraAddress = reverseLocation?.extraAddress
        ?.trim()
        ?.takeIf { it.isNotBlank() }
        ?: currentExtraAddress

    if (reverseLocation == null) {
        return MapPickerLocationUpdate(
            country = currentCountry,
            city = currentCity,
            district = currentDistrict,
            neighborhood = currentNeighborhood,
            extraAddress = normalizedExtraAddress
        )
    }

    val countryFromCode = reverseLocation.countryCode
        ?.trim()
        ?.lowercase()
        ?.takeIf { it.isNotBlank() && locations.containsKey(it) }
        .orEmpty()
    val countryFromLabel = findCountryKeyByLabel(reverseLocation.country, locations)
    val mappedCountry = countryFromCode.ifBlank { countryFromLabel }

    val mappedCity = if (mappedCountry.isNotBlank()) {
        findCityKeyByLabel(mappedCountry, reverseLocation.city, locations)
    } else {
        ""
    }
    val mappedDistrict = if (mappedCountry.isNotBlank() && mappedCity.isNotBlank()) {
        findDistrictKeyByLabel(mappedCountry, mappedCity, reverseLocation.district, locations)
    } else {
        ""
    }
    val mappedNeighborhood = if (mappedCountry.isNotBlank() && mappedCity.isNotBlank() && mappedDistrict.isNotBlank()) {
        findNeighborhoodValueByLabel(mappedCountry, mappedCity, mappedDistrict, reverseLocation.neighborhood, locations)
    } else {
        ""
    }

    var nextCountry = currentCountry
    var nextCity = currentCity
    var nextDistrict = currentDistrict
    var nextNeighborhood = currentNeighborhood

    if (mappedCountry.isNotBlank()) {
        val countryChanged = mappedCountry != currentCountry
        nextCountry = mappedCountry
        if (countryChanged && mappedCity.isBlank()) {
            nextCity = ""
            nextDistrict = ""
            nextNeighborhood = ""
        }
    }

    if (mappedCity.isNotBlank()) {
        val cityChanged = mappedCity != nextCity
        nextCity = mappedCity
        if (cityChanged && mappedDistrict.isBlank()) {
            nextDistrict = ""
            nextNeighborhood = ""
        }
    }

    if (mappedDistrict.isNotBlank()) {
        val districtChanged = mappedDistrict != nextDistrict
        nextDistrict = mappedDistrict
        if (districtChanged && mappedNeighborhood.isBlank()) {
            nextNeighborhood = ""
        }
    }

    if (mappedNeighborhood.isNotBlank()) {
        nextNeighborhood = mappedNeighborhood
    }

    return MapPickerLocationUpdate(
        country = nextCountry,
        city = nextCity,
        district = nextDistrict,
        neighborhood = nextNeighborhood,
        extraAddress = normalizedExtraAddress
    )
}
