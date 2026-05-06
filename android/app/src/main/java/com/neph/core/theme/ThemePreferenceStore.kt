package com.neph.core.theme

import android.content.Context
import android.content.SharedPreferences
import com.neph.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class ThemeMode(val storageValue: String) {
    System("system"),
    Light("light"),
    Dark("dark");

    companion object {
        fun fromStorageValue(value: String?): ThemeMode {
            return entries.firstOrNull { it.storageValue == value } ?: System
        }
    }
}

object ThemePreferenceStore {
    private const val PrefsName = "neph_theme"
    private const val ThemeModeKey = "theme_mode"

    private lateinit var prefs: SharedPreferences
    private val themeModeState = MutableStateFlow(ThemeMode.System)

    fun initialize(context: Context) {
        if (!::prefs.isInitialized) {
            prefs = context.applicationContext.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            themeModeState.value = ThemeMode.fromStorageValue(prefs.getString(ThemeModeKey, null))
        }
    }

    val themeModeFlow: StateFlow<ThemeMode> = themeModeState

    fun getThemeMode(): ThemeMode {
        ensureInitialized()
        return ThemeMode.fromStorageValue(prefs.getString(ThemeModeKey, null))
    }

    fun setThemeMode(themeMode: ThemeMode) {
        ensureInitialized()
        themeModeState.value = themeMode
        prefs.edit().putString(ThemeModeKey, themeMode.storageValue).apply()
    }

    fun setDarkThemeEnabled(enabled: Boolean) {
        setThemeMode(if (enabled) ThemeMode.Dark else ThemeMode.Light)
    }

    fun isDarkThemeEnabled(systemDarkTheme: Boolean): Boolean {
        return resolveDarkTheme(getThemeMode(), systemDarkTheme)
    }

    fun resolveDarkTheme(themeMode: ThemeMode, systemDarkTheme: Boolean): Boolean {
        return when (themeMode) {
            ThemeMode.System -> systemDarkTheme
            ThemeMode.Light -> false
            ThemeMode.Dark -> true
        }
    }

    fun resetForTesting() {
        requireDebugBuildForTestingReset()

        if (::prefs.isInitialized) {
            prefs.edit().clear().commit()
        }

        themeModeState.value = ThemeMode.System
    }

    private fun requireDebugBuildForTestingReset() {
        check(BuildConfig.DEBUG) {
            "ThemePreferenceStore.resetForTesting() is only available in debug/e2e test builds."
        }
    }

    private fun ensureInitialized() {
        check(::prefs.isInitialized) {
            "ThemePreferenceStore must be initialized before use."
        }
    }
}
