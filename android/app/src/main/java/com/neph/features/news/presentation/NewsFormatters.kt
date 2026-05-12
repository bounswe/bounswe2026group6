package com.neph.features.news.presentation

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val DisplayDateFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US).withZone(ZoneId.systemDefault())

internal fun formatPublishedAt(value: String?): String {
    if (value.isNullOrBlank()) return ""
    return try {
        DisplayDateFormatter.format(Instant.parse(value))
    } catch (_: Exception) {
        value
    }
}
