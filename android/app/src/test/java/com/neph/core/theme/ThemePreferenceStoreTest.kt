package com.neph.core.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ThemePreferenceStoreTest {
    @Test
    fun fromStorageValueFallsBackToSystemForMissingOrUnknownValues() {
        assertEquals(ThemeMode.System, ThemeMode.fromStorageValue(null))
        assertEquals(ThemeMode.System, ThemeMode.fromStorageValue("unexpected"))
    }

    @Test
    fun fromStorageValueRestoresExplicitModes() {
        assertEquals(ThemeMode.Light, ThemeMode.fromStorageValue("light"))
        assertEquals(ThemeMode.Dark, ThemeMode.fromStorageValue("dark"))
        assertEquals(ThemeMode.System, ThemeMode.fromStorageValue("system"))
    }

    @Test
    fun resolveDarkThemeUsesSystemOnlyWhenModeIsSystem() {
        assertTrue(ThemePreferenceStore.resolveDarkTheme(ThemeMode.System, systemDarkTheme = true))
        assertFalse(ThemePreferenceStore.resolveDarkTheme(ThemeMode.System, systemDarkTheme = false))
        assertFalse(ThemePreferenceStore.resolveDarkTheme(ThemeMode.Light, systemDarkTheme = true))
        assertTrue(ThemePreferenceStore.resolveDarkTheme(ThemeMode.Dark, systemDarkTheme = false))
    }
}
