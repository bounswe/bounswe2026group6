package com.neph.core.format

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

fun parseTimestampToInstant(raw: String?): Instant? {
    val value = raw?.trim()?.takeIf { it.isNotBlank() } ?: return null

    return runCatching { Instant.parse(value) }
        .recoverCatching { OffsetDateTime.parse(value).toInstant() }
        .recoverCatching { LocalDateTime.parse(value.replace(' ', 'T')).toInstant(ZoneOffset.UTC) }
        .getOrNull()
}

fun relativeDayLabel(
    instant: Instant,
    zoneId: ZoneId = ZoneId.systemDefault(),
    nowInstant: Instant = Instant.now()
): String? {
    val targetDate = instant.atZone(zoneId).toLocalDate()
    val today = LocalDate.ofInstant(nowInstant, zoneId)

    return when (targetDate) {
        today -> "Today"
        today.minusDays(1) -> "Yesterday"
        else -> null
    }
}

fun formatTimestampWithRelativeDay(
    raw: String?,
    fallbackFormatter: DateTimeFormatter,
    timeFormatter: DateTimeFormatter,
    zoneId: ZoneId = ZoneId.systemDefault(),
    nowInstant: Instant = Instant.now(),
    relativeSeparator: String = ", "
): String? {
    val instant = parseTimestampToInstant(raw) ?: return null
    return formatInstantWithRelativeDay(
        instant = instant,
        fallbackFormatter = fallbackFormatter,
        timeFormatter = timeFormatter,
        zoneId = zoneId,
        nowInstant = nowInstant,
        relativeSeparator = relativeSeparator
    )
}

fun formatInstantWithRelativeDay(
    instant: Instant,
    fallbackFormatter: DateTimeFormatter,
    timeFormatter: DateTimeFormatter,
    zoneId: ZoneId = ZoneId.systemDefault(),
    nowInstant: Instant = Instant.now(),
    relativeSeparator: String = ", "
): String {
    val zonedDateTime = instant.atZone(zoneId)
    val relativeLabel = relativeDayLabel(instant, zoneId, nowInstant)

    return if (relativeLabel != null) {
        "$relativeLabel$relativeSeparator${timeFormatter.format(zonedDateTime)}"
    } else {
        fallbackFormatter.withZone(zoneId).format(instant)
    }
}
