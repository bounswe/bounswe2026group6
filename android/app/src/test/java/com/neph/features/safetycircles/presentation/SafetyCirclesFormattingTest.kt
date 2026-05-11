package com.neph.features.safetycircles.presentation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class SafetyCirclesFormattingTest {
    @Test
    fun formatLastCheckedInLabelUsesRelativeLocalTimeForToday() {
        assertEquals(
            "Last checked in: Today, 16:52",
            formatLastCheckedInLabel(
                rawTimestamp = "2026-05-11T13:52:27.755Z",
                zoneId = ZoneId.of("Europe/Istanbul"),
                nowInstant = Instant.parse("2026-05-11T18:00:00.000Z")
            )
        )
    }

    @Test
    fun formatLastCheckedInLabelIgnoresInvalidTimestamps() {
        assertNull(formatLastCheckedInLabel("not-a-timestamp"))
    }
}
