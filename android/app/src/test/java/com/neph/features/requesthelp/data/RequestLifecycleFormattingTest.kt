package com.neph.features.requesthelp.data

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.TimeZone

class RequestLifecycleFormattingTest {
    @Test
    fun formatLifecycleTimestampUsesDeviceTimezoneForUtcInput() {
        withDefaultTimeZone("Europe/Istanbul") {
            assertEquals(
                "2026-04-26 13:00:00",
                formatLifecycleTimestamp("2026-04-26T10:00:00.000Z")
            )
        }
    }

    @Test
    fun formatLifecycleTimestampUsesDeviceTimezoneForOffsetInput() {
        withDefaultTimeZone("Europe/Istanbul") {
            assertEquals(
                "2026-04-26 13:00:00",
                formatLifecycleTimestamp("2026-04-26T12:00:00+02:00")
            )
        }
    }

    private fun withDefaultTimeZone(id: String, block: () -> Unit) {
        val previous = TimeZone.getDefault()
        try {
            TimeZone.setDefault(TimeZone.getTimeZone(id))
            block()
        } finally {
            TimeZone.setDefault(previous)
        }
    }
}
