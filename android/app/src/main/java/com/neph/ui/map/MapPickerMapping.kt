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

private fun displayNameCandidates(displayName: String?): List<String> {
    return displayName
        .orEmpty()
        .split(',')
        .map { it.trim() }
        .filter { it.isNotBlank() }
}

private fun resolveCountryKey(countryCode: String?, countryLabels: List<String>, locations: LocationData): String {
    val rawCode = countryCode?.trim().orEmpty()
    val codeCandidates = listOf(
        rawCode,
        rawCode.lowercase(Locale.ROOT),
        rawCode.uppercase(Locale.ROOT)
    ).filter { it.isNotBlank() }.distinct()

    codeCandidates.firstOrNull { locations.containsKey(it) }?.let { return it }

    countryLabels.forEach { label ->
        locations.entries.firstOrNull { (key, country) ->
            matchesLocationToken(key, label) || matchesLocationToken(country.label, label)
        }?.let { return it.key }
    }

    return ""
}

private fun resolveCityKey(countryKey: String, cityLabels: List<String>, locations: LocationData): String {
    val cityEntries = locations[countryKey]?.cities?.entries ?: return ""

    cityLabels.forEach { label ->
        val rawCity = label.trim()
        if (rawCity.isBlank()) {
            return@forEach
        }

        cityEntries.firstOrNull { it.key == rawCity || it.key == rawCity.lowercase(Locale.ROOT) }?.let {
            return it.key
        }

        cityEntries.firstOrNull { (key, city) ->
            matchesLocationToken(key, rawCity) || matchesLocationToken(city.label, rawCity)
        }?.let { return it.key }
    }

    return ""
}

private fun resolveDistrictKey(
    countryKey: String,
    cityKey: String,
    districtLabels: List<String>,
    locations: LocationData
): String {
    val districtEntries = locations[countryKey]?.cities?.get(cityKey)?.districts?.entries ?: return ""

    districtLabels.forEach { label ->
        val rawDistrict = label.trim()
        if (rawDistrict.isBlank()) {
            return@forEach
        }

        districtEntries.firstOrNull { it.key == rawDistrict || it.key == rawDistrict.lowercase(Locale.ROOT) }?.let {
            return it.key
        }

        districtEntries.firstOrNull { (key, district) ->
            matchesLocationToken(key, rawDistrict) || matchesLocationToken(district.label, rawDistrict)
        }?.let { return it.key }
    }

    return ""
}

private fun resolveNeighborhoodValue(
    countryKey: String,
    cityKey: String,
    districtKey: String,
    neighborhoodLabels: List<String>,
    locations: LocationData
): String {
    val neighborhoods = locations[countryKey]
        ?.cities
        ?.get(cityKey)
        ?.districts
        ?.get(districtKey)
        ?.neighborhoods
        ?: return ""

    neighborhoodLabels.forEach { label ->
        val rawNeighborhood = label.trim()
        if (rawNeighborhood.isBlank()) {
            return@forEach
        }

        neighborhoods.firstOrNull { neighborhood ->
            matchesLocationToken(neighborhood.value, rawNeighborhood) ||
                matchesLocationToken(neighborhood.label, rawNeighborhood)
        }?.let { return it.value }
    }

    return ""
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

    val displayNameParts = displayNameCandidates(reverseLocation.displayName)
    val mappedCountry = resolveCountryKey(
        countryCode = reverseLocation.countryCode,
        countryLabels = listOfNotNull(reverseLocation.country) + displayNameParts,
        locations = locations
    )

    val mappedCity = if (mappedCountry.isNotBlank()) {
        resolveCityKey(
            countryKey = mappedCountry,
            cityLabels = listOfNotNull(reverseLocation.city) + displayNameParts.asReversed(),
            locations = locations
        )
    } else {
        ""
    }
    val mappedDistrict = if (mappedCountry.isNotBlank() && mappedCity.isNotBlank()) {
        resolveDistrictKey(
            countryKey = mappedCountry,
            cityKey = mappedCity,
            districtLabels = listOfNotNull(reverseLocation.district) + displayNameParts,
            locations = locations
        )
    } else {
        ""
    }
    val mappedNeighborhood = if (mappedCountry.isNotBlank() && mappedCity.isNotBlank() && mappedDistrict.isNotBlank()) {
        resolveNeighborhoodValue(
            countryKey = mappedCountry,
            cityKey = mappedCity,
            districtKey = mappedDistrict,
            neighborhoodLabels = listOfNotNull(reverseLocation.neighborhood) + displayNameParts,
            locations = locations
        )
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

        reverseLocation.extraAddress?.isNotBlank() == true ->
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

        reverseLocation.extraAddress?.isNotBlank() == true ->
            "We found part of the emergency address. Please complete the remaining fields manually."

        else ->
            "Could not resolve the selected point. You can still enter the emergency address manually."
    }
}
