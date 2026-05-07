package com.neph.features.requesthelp.data

import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneOffset

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

internal fun formatLifecycleTimestamp(raw: String?): String? {
    return raw
        ?.trim()
        ?.takeIf { it.isNotBlank() }
        ?.replace('T', ' ')
        ?.substringBefore('.')
        ?.substringBefore('Z')
}

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

    return runCatching { Instant.parse(value).toEpochMilli() }
        .recoverCatching { OffsetDateTime.parse(value).toInstant().toEpochMilli() }
        .recoverCatching { LocalDateTime.parse(value.replace(' ', 'T')).toInstant(ZoneOffset.UTC).toEpochMilli() }
        .getOrNull()
}
