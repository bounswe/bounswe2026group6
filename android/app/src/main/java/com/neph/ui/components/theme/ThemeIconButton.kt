package com.neph.ui.components.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import com.neph.core.theme.ThemePreferenceStore

@Composable
fun ThemeIconButton(modifier: Modifier = Modifier) {
    val themeMode by ThemePreferenceStore.themeModeFlow.collectAsState()
    val darkThemeEnabled = ThemePreferenceStore.resolveDarkTheme(
        themeMode = themeMode,
        systemDarkTheme = isSystemInDarkTheme()
    )

    IconButton(
        modifier = modifier,
        onClick = {
            ThemePreferenceStore.setDarkThemeEnabled(!darkThemeEnabled)
        }
    ) {
        Icon(
            imageVector = if (darkThemeEnabled) {
                Icons.Filled.DarkMode
            } else {
                Icons.Filled.WbSunny
            },
            contentDescription = if (darkThemeEnabled) {
                "Switch to light theme"
            } else {
                "Switch to dark theme"
            }
        )
    }
}
