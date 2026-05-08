package com.neph.ui.map

import com.neph.features.profile.data.LocationData
import com.neph.features.profile.data.normalizeAddressToken
import com.neph.features.requesthelp.data.RequestHelpReverseLocation
import java.util.Locale

data class MapPickerLocationUpdate(
    val country: String,
    val city: String,
    val district: String,
    val neighborhood: String,
    val extraAddress: String,
    val hasStructuredMatch: Boolean,
    val isMeaningfulMapping: Boolean,
    val resolvedCountry: Boolean = false,
    val resolvedCity: Boolean = false,
    val resolvedDistrict: Boolean = false,
    val resolvedNeighborhood: Boolean = false
)

private val LocationSuffixes = listOf(
    "mahallesi",
    "mahalle",
    "mah",
    "mh",
    "ilcesi",
    "ilce",
    "belediyesi",
    "belediye"
)

private fun normalizedLocationToken(value: String?): String {
    val raw = value?.trim().orEmpty()
    if (raw.isBlank()) {
        return ""
    }

    val ascii = normalizeAddressToken(raw)
        .lowercase(Locale.ROOT)
        .replace('ı', 'i')
        .replace('ğ', 'g')
        .replace('ü', 'u')
        .replace('ş', 's')
        .replace('ö', 'o')
        .replace('ç', 'c')
        .replace(Regex("[^a-z0-9]+"), " ")
        .trim()
        .replace(Regex("\\s+"), " ")

    if (ascii.isBlank()) {
        return ""
    }

    val tokens = ascii.split(" ").toMutableList()
    while (tokens.isNotEmpty() && tokens.last() in LocationSuffixes) {
        tokens.removeAt(tokens.lastIndex)
    }

    return tokens.joinToString(" ")
}

private fun matchesLocationToken(candidate: String?, target: String?): Boolean {
    val normalizedCandidate = normalizedLocationToken(candidate)
    val normalizedTarget = normalizedLocationToken(target)
    return normalizedCandidate.isNotBlank() && normalizedCandidate == normalizedTarget
}

private fun resolveCountryKey(countryCode: String?, countryLabel: String?, locations: LocationData): String {
    val rawCode = countryCode?.trim().orEmpty()
    val codeCandidates = listOf(
        rawCode,
        rawCode.lowercase(Locale.ROOT),
        rawCode.uppercase(Locale.ROOT)
    ).filter { it.isNotBlank() }.distinct()

    codeCandidates.firstOrNull { locations.containsKey(it) }?.let { return it }

    val normalizedLabel = normalizedLocationToken(countryLabel)
    return locations.entries.firstOrNull { (key, country) ->
        matchesLocationToken(key, countryLabel) || matchesLocationToken(country.label, normalizedLabel)
    }?.key.orEmpty()
}

private fun resolveCityKey(countryKey: String, cityLabel: String?, locations: LocationData): String {
    val cityEntries = locations[countryKey]?.cities?.entries ?: return ""
    val rawCity = cityLabel?.trim().orEmpty()
    if (rawCity.isBlank()) {
        return ""
    }

    cityEntries.firstOrNull { it.key == rawCity || it.key == rawCity.lowercase(Locale.ROOT) }?.let {
        return it.key
    }

    return cityEntries.firstOrNull { (key, city) ->
        matchesLocationToken(key, rawCity) || matchesLocationToken(city.label, rawCity)
    }?.key.orEmpty()
}

private fun resolveDistrictKey(
    countryKey: String,
    cityKey: String,
    districtLabel: String?,
    locations: LocationData
): String {
    val districtEntries = locations[countryKey]?.cities?.get(cityKey)?.districts?.entries ?: return ""
    val rawDistrict = districtLabel?.trim().orEmpty()
    if (rawDistrict.isBlank()) {
        return ""
    }

    districtEntries.firstOrNull { it.key == rawDistrict || it.key == rawDistrict.lowercase(Locale.ROOT) }?.let {
        return it.key
    }

    return districtEntries.firstOrNull { (key, district) ->
        matchesLocationToken(key, rawDistrict) || matchesLocationToken(district.label, rawDistrict)
    }?.key.orEmpty()
}

private fun resolveNeighborhoodValue(
    countryKey: String,
    cityKey: String,
    districtKey: String,
    neighborhoodLabel: String?,
    locations: LocationData
): String {
    val neighborhoods = locations[countryKey]
        ?.cities
        ?.get(cityKey)
        ?.districts
        ?.get(districtKey)
        ?.neighborhoods
        ?: return ""
    val rawNeighborhood = neighborhoodLabel?.trim().orEmpty()
    if (rawNeighborhood.isBlank()) {
        return ""
    }

    return neighborhoods.firstOrNull { neighborhood ->
        matchesLocationToken(neighborhood.value, rawNeighborhood) ||
            matchesLocationToken(neighborhood.label, rawNeighborhood)
    }?.value.orEmpty()
}

fun resolveMapPickerLocationUpdate(
    currentCountry: String,
    currentCity: String,
    currentDistrict: String,
    currentNeighborhood: String,
    currentExtraAddress: String,
    reverseLocation: RequestHelpReverseLocation?,
    locations: LocationData
): MapPickerLocationUpdate {
    if (reverseLocation == null) {
        return MapPickerLocationUpdate(
            country = currentCountry,
            city = currentCity,
            district = currentDistrict,
            neighborhood = currentNeighborhood,
            extraAddress = currentExtraAddress,
            hasStructuredMatch = false,
            isMeaningfulMapping = false
        )
    }

    val mappedCountry = resolveCountryKey(reverseLocation.countryCode, reverseLocation.country, locations)

    val mappedCity = if (mappedCountry.isNotBlank()) {
        resolveCityKey(mappedCountry, reverseLocation.city, locations)
    } else {
        ""
    }
    val mappedDistrict = if (mappedCountry.isNotBlank() && mappedCity.isNotBlank()) {
        resolveDistrictKey(mappedCountry, mappedCity, reverseLocation.district, locations)
    } else {
        ""
    }
    val mappedNeighborhood = if (mappedCountry.isNotBlank() && mappedCity.isNotBlank() && mappedDistrict.isNotBlank()) {
        resolveNeighborhoodValue(mappedCountry, mappedCity, mappedDistrict, reverseLocation.neighborhood, locations)
    } else {
        ""
    }

    val hasStructuredMatch = mappedCountry.isNotBlank() ||
        mappedCity.isNotBlank() ||
        mappedDistrict.isNotBlank() ||
        mappedNeighborhood.isNotBlank()
    val isMeaningfulMapping = mappedCountry.isNotBlank() &&
        mappedCity.isNotBlank() &&
        mappedDistrict.isNotBlank() &&
        mappedNeighborhood.isNotBlank()

    val normalizedExtraAddress = if (hasStructuredMatch) {
        reverseLocation.extraAddress
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: currentExtraAddress
    } else {
        currentExtraAddress
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
        nextCity = mappedCity
        if (mappedDistrict.isBlank()) {
            nextDistrict = ""
            nextNeighborhood = ""
        }
    }

    if (mappedDistrict.isNotBlank()) {
        nextDistrict = mappedDistrict
        if (mappedNeighborhood.isBlank()) {
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
        extraAddress = normalizedExtraAddress,
        hasStructuredMatch = hasStructuredMatch,
        isMeaningfulMapping = isMeaningfulMapping,
        resolvedCountry = mappedCountry.isNotBlank(),
        resolvedCity = mappedCity.isNotBlank(),
        resolvedDistrict = mappedDistrict.isNotBlank(),
        resolvedNeighborhood = mappedNeighborhood.isNotBlank()
    )
}

fun residentialMapPickerFeedbackMessage(
    reverseLocation: RequestHelpReverseLocation?,
    update: MapPickerLocationUpdate
): String {
    if (reverseLocation == null) {
        return "Could not resolve the selected point. You can still enter the address manually."
    }

    return when {
        update.isMeaningfulMapping ->
            "Selected location applied. Please verify the address before saving."

        update.resolvedCity && update.resolvedDistrict ->
            "We found the city and district. Please choose the neighborhood manually."

        update.resolvedCity ->
            "We found the city. Please choose the district and neighborhood manually."

        update.hasStructuredMatch ->
            "We found part of the address. Please complete the remaining location fields manually."

        else ->
            "Could not resolve the selected point. You can still enter the address manually."
    }
}

fun requestHelpMapPickerFeedbackMessage(
    reverseLocation: RequestHelpReverseLocation?,
    update: MapPickerLocationUpdate?
): String {
    if (reverseLocation == null || update == null) {
        return "Could not resolve the selected point. You can still enter the emergency address manually."
    }

    return when {
        update.isMeaningfulMapping ->
            "Emergency location applied. Please verify the address before sending."

        update.resolvedCity && update.resolvedDistrict ->
            "We found the city and district. Please choose the neighborhood if needed."

        update.resolvedCity ->
            "We found the city. Please choose the district and neighborhood manually."

        update.hasStructuredMatch ->
            "We found part of the emergency address. Please complete the remaining fields manually."

        else ->
            "Could not resolve the selected point. You can still enter the emergency address manually."
    }
}
