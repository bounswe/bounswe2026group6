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
