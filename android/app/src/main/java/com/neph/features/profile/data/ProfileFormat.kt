package com.neph.features.profile.data

import com.neph.features.auth.util.countryCodeOptions
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.text.Normalizer
import java.util.Locale
import java.util.TimeZone

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

fun composeFullName(firstName: String?, lastName: String?): String? {
    val fullName = listOfNotNull(
        firstName?.trim()?.takeIf { it.isNotBlank() },
        lastName?.trim()?.takeIf { it.isNotBlank() }
    ).joinToString(" ")

    return fullName.takeIf { it.isNotBlank() }
}

private val dateOfBirthPattern = Regex("^\\d{4}-\\d{2}-\\d{2}$")

fun normalizeDateOfBirth(value: String?): String? {
    val raw = value?.trim().orEmpty()
    if (raw.isBlank() || !dateOfBirthPattern.matches(raw)) {
        return null
    }

    val parser = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        isLenient = false
    }

    val parsed = runCatching { parser.parse(raw) }.getOrNull() ?: return null
    return parser.format(parsed)
}

fun calculateAgeFromDateOfBirth(value: String?): Int? {
    val normalized = normalizeDateOfBirth(value) ?: return null
    val parser = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        isLenient = false
    }
    val birthDate: Date = runCatching { parser.parse(normalized) }.getOrNull() ?: return null

    val birthCalendar = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
        time = birthDate
    }
    val todayCalendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"))

    var age = todayCalendar.get(Calendar.YEAR) - birthCalendar.get(Calendar.YEAR)
    val monthDelta = todayCalendar.get(Calendar.MONTH) - birthCalendar.get(Calendar.MONTH)
    val dayDelta = todayCalendar.get(Calendar.DAY_OF_MONTH) - birthCalendar.get(Calendar.DAY_OF_MONTH)

    if (monthDelta < 0 || (monthDelta == 0 && dayDelta < 0)) {
        age -= 1
    }

    return age.coerceAtLeast(0)
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

    val normalizedLabel = label.trim()
    return locations.entries.firstOrNull {
        it.value.label.equals(normalizedLabel, ignoreCase = true)
    }?.key.orEmpty()
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
    val normalizedLabel = label.trim()
    return country.cities.entries.firstOrNull {
        it.value.label.equals(normalizedLabel, ignoreCase = true)
    }?.key.orEmpty()
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
    val normalizedLabel = label.trim()
    return city.districts.entries.firstOrNull {
        it.value.label.equals(normalizedLabel, ignoreCase = true)
    }?.key.orEmpty()
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

    val normalizedLabel = label.trim()
    return district.neighborhoods.firstOrNull {
        it.label.equals(normalizedLabel, ignoreCase = true)
    }?.value.orEmpty()
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

    val normalizedKey = raw.lowercase(Locale.ROOT)
    if (locations.containsKey(normalizedKey)) {
        return normalizedKey
    }

    return findCountryKeyByLabel(raw, locations)
}

fun resolveCountrySelectionKey(
    countryKeyOrLabel: String?,
    locations: LocationData = locationData
): String? {
    return resolveCountryKey(countryKeyOrLabel, locations).ifBlank { null }
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

    val normalizedCityKey = rawCity.lowercase(Locale.ROOT)
    val cityByKey = locations[countryKey]?.cities?.get(rawCity)
        ?: locations[countryKey]?.cities?.get(normalizedCityKey)
    if (cityByKey != null) {
        return if (locations[countryKey]?.cities?.containsKey(rawCity) == true) rawCity else normalizedCityKey
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

    val normalizedDistrictKey = rawDistrict.lowercase(Locale.ROOT)
    val districtByKey = locations[countryKey]?.cities?.get(cityKey)?.districts?.get(rawDistrict)
        ?: locations[countryKey]?.cities?.get(cityKey)?.districts?.get(normalizedDistrictKey)
    if (districtByKey != null) {
        return if (locations[countryKey]?.cities?.get(cityKey)?.districts?.containsKey(rawDistrict) == true) {
            rawDistrict
        } else {
            normalizedDistrictKey
        }
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

    val countryKey = resolveCountryKey(raw, locations)
    if (countryKey.isBlank()) {
        return raw
    }

    return locations[countryKey]?.label ?: raw
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

    return neighborhoods.firstOrNull { it.value.equals(rawNeighborhood, ignoreCase = true) }?.label
        ?: neighborhoods.firstOrNull { it.label.equals(rawNeighborhood, ignoreCase = true) }?.label
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
