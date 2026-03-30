package com.neph.features.profile.data

import com.neph.features.auth.util.countryCodeOptions
import org.json.JSONArray
import java.text.ParsePosition
import java.text.SimpleDateFormat
import java.util.Calendar
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

fun parseBirthDateToMillis(iso: String?): Long? {
    if (iso.isNullOrBlank()) return null
    return try {
        val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        formatter.isLenient = false
        val position = ParsePosition(0)
        val parsed = formatter.parse(iso, position)
        if (parsed != null && position.index == iso.length) parsed.time else null
    } catch (_: Exception) {
        null
    }
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

fun calculateAge(birthDate: String?): Int? {
    val millis = parseBirthDateToMillis(birthDate) ?: return null
    val birthCalendar = Calendar.getInstance().apply { timeInMillis = millis }
    val today = Calendar.getInstance()

    var age = today.get(Calendar.YEAR) - birthCalendar.get(Calendar.YEAR)

    val todayMonth = today.get(Calendar.MONTH)
    val birthMonth = birthCalendar.get(Calendar.MONTH)
    val todayDay = today.get(Calendar.DAY_OF_MONTH)
    val birthDay = birthCalendar.get(Calendar.DAY_OF_MONTH)

    val birthdayNotReached =
        todayMonth < birthMonth || (todayMonth == birthMonth && todayDay < birthDay)

    if (birthdayNotReached) {
        age -= 1
    }

    return age.takeIf { it >= 0 }
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