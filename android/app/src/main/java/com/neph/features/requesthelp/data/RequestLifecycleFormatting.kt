package com.neph.features.requesthelp.data

import com.neph.core.format.formatTimestampWithRelativeDay
import com.neph.core.format.parseTimestampToInstant
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale

internal fun formatOperationalLevel(value: String?): String? {
    return value
        ?.trim()
        ?.takeIf { it.isNotBlank() }
        ?.split('_')
        ?.filter { it.isNotBlank() }
        ?.joinToString(" ") { part ->
            part.lowercase().replaceFirstChar { it.uppercase() }
        }
}

internal fun formatLifecycleTimestamp(
    raw: String?,
    nowInstant: Instant = Instant.now()
): String? {
    val value = raw
        ?.trim()
        ?.takeIf { it.isNotBlank() }
        ?: return null

    return formatTimestampWithRelativeDay(
        raw = value,
        fallbackFormatter = LifecycleDisplayFormatter,
        timeFormatter = LifecycleTimeFormatter,
        nowInstant = nowInstant,
        relativeSeparator = " "
    ) ?: value
            .replace('T', ' ')
            .substringBefore('.')
            .substringBefore('Z')
}

private val LifecycleDisplayFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss", Locale.US)

private val LifecycleTimeFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("HH:mm:ss", Locale.US)

internal fun buildDurationLabel(
    openedAtRaw: String?,
    closedAtRaw: String? = null,
    fallbackOpenedAtEpochMillis: Long? = null,
    nowEpochMillis: Long = System.currentTimeMillis()
): String? {
    val openedAtEpochMillis = parseTimestampToEpochMillis(openedAtRaw) ?: fallbackOpenedAtEpochMillis ?: return null
    val closedAtEpochMillis = parseTimestampToEpochMillis(closedAtRaw) ?: nowEpochMillis
    if (closedAtEpochMillis < openedAtEpochMillis) {
        return null
    }

    return formatDurationMinutes((closedAtEpochMillis - openedAtEpochMillis) / 60_000L)
}

private fun formatDurationMinutes(totalMinutes: Long): String {
    if (totalMinutes < 60) {
        return "$totalMinutes min"
    }

    val hours = totalMinutes / 60
    val minutes = totalMinutes % 60
    if (hours < 24) {
        return if (minutes == 0L) "$hours h" else "$hours h $minutes min"
    }

    val days = hours / 24
    val remainingHours = hours % 24
    return if (remainingHours == 0L) "$days d" else "$days d $remainingHours h"
}

private fun parseTimestampToEpochMillis(raw: String?): Long? {
    val value = raw?.trim()?.takeIf { it.isNotBlank() } ?: return null

    return parseTimestampToInstant(value)?.toEpochMilli()
}
