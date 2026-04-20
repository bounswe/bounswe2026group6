package com.neph.features.profile.data

import com.neph.features.auth.util.countryCodeOptions
import org.json.JSONArray
import java.text.Normalizer
import java.util.Locale

data class PhoneParts(
    val countryCode: String,
    val phone: String
)

/** Display/editing helpers for profile numeric fields stored as [Float]. */
fun Float?.toEditableString(): String =
    when (this) {
        null -> ""
        else ->
            if (this % 1f == 0f) {
                this.toInt().toString()
            } else {
                toString()
            }
    }

/** Allows typing decimals with at most one `.` and a bounded length. */
fun sanitizeDecimalInput(raw: String, maxLen: Int = 8): String {
    val sb = StringBuilder()
    var dotSeen = false
    for (c in raw) {
        when {
            c.isDigit() -> if (sb.length < maxLen) sb.append(c)
            c == '.' && !dotSeen -> {
                dotSeen = true
                if (sb.length < maxLen) sb.append('.')
            }
        }
    }
    return sb.toString()
}

fun splitFullName(fullName: String): Pair<String, String> {
    val normalized = fullName.trim().replace(Regex("\\s+"), " ")
    if (normalized.isBlank()) {
        return "" to ""
    }

    val parts = normalized.split(" ")
    val firstName = parts.firstOrNull().orEmpty()
    val lastName = parts.drop(1).joinToString(" ")
    return firstName to lastName
}

fun parseListField(value: String?): List<String> {
    return value
        .orEmpty()
        .split(',', '\n')
        .map { it.trim() }
        .filter { it.isNotEmpty() }
}

private val availableCountryCodes = countryCodeOptions
    .map { it.value }
    .filter { it.startsWith("+") }
    .sortedByDescending { it.length }

fun normalizePhoneParts(phoneNumber: String?): PhoneParts {
    if (phoneNumber.isNullOrBlank()) {
        return PhoneParts(countryCode = "+90", phone = "")
    }

    val normalized = phoneNumber.trim().replace(Regex("[\\s()-]"), "")
    if (!normalized.startsWith("+")) {
        return PhoneParts(
            countryCode = "+90",
            phone = normalized.filter(Char::isDigit).trimStart('0')
        )
    }

    val matchedCountryCode = availableCountryCodes.firstOrNull { normalized.startsWith(it) }
    if (matchedCountryCode == null) {
        return PhoneParts(
            countryCode = "+90",
            phone = normalized.removePrefix("+").filter(Char::isDigit).trimStart('0')
        )
    }

    return PhoneParts(
        countryCode = matchedCountryCode,
        phone = normalized.removePrefix(matchedCountryCode).filter(Char::isDigit).trimStart('0')
    )
}

fun combinePhoneNumber(countryCode: String, phone: String): String {
    val normalizedPhone = phone.filter(Char::isDigit).trimStart('0')
    return if (normalizedPhone.isBlank()) {
        ""
    } else {
        "${countryCode.trim()}$normalizedPhone"
    }
}

fun buildAddress(
    district: String?,
    neighborhood: String?,
    extraAddress: String?
): String? {
    val address = listOf(neighborhood, district, extraAddress)
        .mapNotNull { it?.trim()?.takeIf(String::isNotEmpty) }
        .joinToString(", ")

    return address.takeIf { it.isNotBlank() }
}

fun findCountryKeyByLabel(label: String?, locations: LocationData = locationData): String {
    if (label.isNullOrBlank()) {
        return ""
    }

    return locations.entries.firstOrNull { it.value.label == label }?.key.orEmpty()
}

fun findCityKeyByLabel(
    countryKey: String,
    label: String?,
    locations: LocationData = locationData
): String {
    if (countryKey.isBlank() || label.isNullOrBlank()) {
        return ""
    }

    val country = locations[countryKey] ?: return ""
    return country.cities.entries.firstOrNull { it.value.label == label }?.key.orEmpty()
}

fun findDistrictKeyByLabel(
    countryKey: String,
    cityKey: String,
    label: String?,
    locations: LocationData = locationData
): String {
    if (countryKey.isBlank() || cityKey.isBlank() || label.isNullOrBlank()) {
        return ""
    }

    val city = locations[countryKey]?.cities?.get(cityKey) ?: return ""
    return city.districts.entries.firstOrNull { it.value.label == label }?.key.orEmpty()
}

fun findNeighborhoodValueByLabel(
    countryKey: String,
    cityKey: String,
    districtKey: String,
    label: String?,
    locations: LocationData = locationData
): String {
    if (countryKey.isBlank() || cityKey.isBlank() || districtKey.isBlank() || label.isNullOrBlank()) {
        return ""
    }

    val district = locations[countryKey]
        ?.cities
        ?.get(cityKey)
        ?.districts
        ?.get(districtKey)
        ?: return ""

    return district.neighborhoods.firstOrNull { it.label == label }?.value.orEmpty()
}

fun splitAddressParts(address: String?): Triple<String?, String?, String?> {
    if (address.isNullOrBlank()) {
        return Triple(null, null, null)
    }

    val parts = address
        .split(',')
        .map { it.trim() }
        .filter { it.isNotBlank() }

    if (parts.size == 1) {
        return Triple(null, null, parts.first())
    }

    val neighborhoodLabel = parts.firstOrNull()
    val districtLabel = parts.getOrNull(1)
    val extraAddress = parts.drop(2).joinToString(", ").ifBlank { null }

    return Triple(districtLabel, neighborhoodLabel, extraAddress)
}

private fun resolveCountryKey(
    countryKeyOrLabel: String?,
    locations: LocationData = locationData
): String {
    val raw = countryKeyOrLabel?.trim().orEmpty()
    if (raw.isBlank()) {
        return ""
    }

    if (locations.containsKey(raw)) {
        return raw
    }

    return findCountryKeyByLabel(raw, locations)
}

private fun resolveCityKey(
    countryKeyOrLabel: String?,
    cityKeyOrLabel: String?,
    locations: LocationData = locationData
): String {
    val countryKey = resolveCountryKey(countryKeyOrLabel, locations)
    val rawCity = cityKeyOrLabel?.trim().orEmpty()
    if (countryKey.isBlank() || rawCity.isBlank()) {
        return ""
    }

    val cityByKey = locations[countryKey]?.cities?.get(rawCity)
    if (cityByKey != null) {
        return rawCity
    }

    return findCityKeyByLabel(countryKey, rawCity, locations)
}

private fun resolveDistrictKey(
    countryKeyOrLabel: String?,
    cityKeyOrLabel: String?,
    districtKeyOrLabel: String?,
    locations: LocationData = locationData
): String {
    val countryKey = resolveCountryKey(countryKeyOrLabel, locations)
    val cityKey = resolveCityKey(countryKey, cityKeyOrLabel, locations)
    val rawDistrict = districtKeyOrLabel?.trim().orEmpty()

    if (countryKey.isBlank() || cityKey.isBlank() || rawDistrict.isBlank()) {
        return ""
    }

    val districtByKey = locations[countryKey]?.cities?.get(cityKey)?.districts?.get(rawDistrict)
    if (districtByKey != null) {
        return rawDistrict
    }

    return findDistrictKeyByLabel(countryKey, cityKey, rawDistrict, locations)
}

fun resolveCountryLabel(
    countryKeyOrLabel: String?,
    locations: LocationData = locationData
): String? {
    val raw = countryKeyOrLabel?.trim().orEmpty()
    if (raw.isBlank()) {
        return null
    }

    return locations[raw]?.label ?: raw
}

fun resolveCityLabel(
    countryKeyOrLabel: String?,
    cityKeyOrLabel: String?,
    locations: LocationData = locationData
): String? {
    val rawCity = cityKeyOrLabel?.trim().orEmpty()
    if (rawCity.isBlank()) {
        return null
    }

    val countryKey = resolveCountryKey(countryKeyOrLabel, locations)
    if (countryKey.isBlank()) {
        return rawCity
    }

    return locations[countryKey]?.cities?.get(rawCity)?.label
        ?: locations[countryKey]?.cities?.get(findCityKeyByLabel(countryKey, rawCity, locations))?.label
        ?: rawCity
}

fun resolveDistrictLabel(
    countryKeyOrLabel: String?,
    cityKeyOrLabel: String?,
    districtKeyOrLabel: String?,
    locations: LocationData = locationData
): String? {
    val rawDistrict = districtKeyOrLabel?.trim().orEmpty()
    if (rawDistrict.isBlank()) {
        return null
    }

    val countryKey = resolveCountryKey(countryKeyOrLabel, locations)
    val cityKey = resolveCityKey(countryKey, cityKeyOrLabel, locations)
    if (countryKey.isBlank() || cityKey.isBlank()) {
        return rawDistrict
    }

    return locations[countryKey]
        ?.cities
        ?.get(cityKey)
        ?.districts
        ?.get(rawDistrict)
        ?.label
        ?: locations[countryKey]
            ?.cities
            ?.get(cityKey)
            ?.districts
            ?.get(findDistrictKeyByLabel(countryKey, cityKey, rawDistrict, locations))
            ?.label
        ?: rawDistrict
}

fun resolveNeighborhoodLabel(
    countryKeyOrLabel: String?,
    cityKeyOrLabel: String?,
    districtKeyOrLabel: String?,
    neighborhoodValueOrLabel: String?,
    locations: LocationData = locationData
): String? {
    val rawNeighborhood = neighborhoodValueOrLabel?.trim().orEmpty()
    if (rawNeighborhood.isBlank()) {
        return null
    }

    val countryKey = resolveCountryKey(countryKeyOrLabel, locations)
    val cityKey = resolveCityKey(countryKey, cityKeyOrLabel, locations)
    val districtKey = resolveDistrictKey(countryKey, cityKey, districtKeyOrLabel, locations)

    if (countryKey.isBlank() || cityKey.isBlank() || districtKey.isBlank()) {
        return rawNeighborhood
    }

    val neighborhoods = locations[countryKey]
        ?.cities
        ?.get(cityKey)
        ?.districts
        ?.get(districtKey)
        ?.neighborhoods
        ?: return rawNeighborhood

    return neighborhoods.firstOrNull { it.value == rawNeighborhood }?.label
        ?: neighborhoods.firstOrNull { it.label == rawNeighborhood }?.label
        ?: rawNeighborhood
}

fun normalizeBloodType(rawBloodType: String?): String? {
    val normalized = rawBloodType?.trim().orEmpty()
    if (normalized.isBlank()) {
        return null
    }

    val compact = normalized
        .uppercase()
        .replace(" ", "")
        .replace("_", "")
        .replace("-", "")
    val aliases = mapOf(
        "APOSITIVE" to "A+",
        "A+" to "A+",
        "APOS" to "A+",
        "ANEGATIVE" to "A-",
        "A-" to "A-",
        "ANEG" to "A-",
        "BPOSITIVE" to "B+",
        "B+" to "B+",
        "BPOS" to "B+",
        "BNEGATIVE" to "B-",
        "B-" to "B-",
        "BNEG" to "B-",
        "ABPOSITIVE" to "AB+",
        "AB+" to "AB+",
        "ABPOS" to "AB+",
        "ABNEGATIVE" to "AB-",
        "AB-" to "AB-",
        "ABNEG" to "AB-",
        "OPOSITIVE" to "O+",
        "O+" to "O+",
        "OPOS" to "O+",
        "ONEGATIVE" to "O-",
        "O-" to "O-",
        "ONEG" to "O-"
    )

    aliases[compact]?.let { return it }

    return bloodTypeOptions.firstOrNull {
        it.value.equals(normalized, ignoreCase = true) ||
            it.label.equals(normalized, ignoreCase = true)
    }?.value ?: normalized
}

fun normalizeAddressToken(value: String): String {
    return Normalizer.normalize(value.trim().lowercase(Locale.getDefault()), Normalizer.Form.NFD)
        .replace("\\p{Mn}+".toRegex(), "")
}

fun JSONArray?.toStringList(): List<String> {
    if (this == null) {
        return emptyList()
    }

    return buildList {
        for (index in 0 until length()) {
            val value = optString(index)
            if (value.isNotBlank()) {
                add(value)
            }
        }
    }
}
