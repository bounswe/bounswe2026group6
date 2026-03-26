package com.neph.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider

private val LightColorScheme: ColorScheme = lightColorScheme(
    primary = NephColors.Primary,
    onPrimary = NephColors.TextOnPrimary,
    primaryContainer = NephColors.PrimaryLight,
    onPrimaryContainer = NephColors.TextPrimary,

    secondary = NephColors.PrimaryDark,
    onSecondary = NephColors.TextOnPrimary,
    secondaryContainer = NephColors.PrimaryLight,
    onSecondaryContainer = NephColors.TextPrimary,

    tertiary = NephColors.Info,
    onTertiary = NephColors.TextOnPrimary,

    background = NephColors.BackgroundPage,
    onBackground = NephColors.TextPrimary,

    surface = NephColors.SurfaceCard,
    onSurface = NephColors.TextPrimary,
    surfaceVariant = NephColors.PrimaryLight,
    onSurfaceVariant = NephColors.TextSecondary,

    error = NephColors.Error,
    onError = NephColors.TextOnPrimary,
    errorContainer = NephColors.PrimaryLight,
    onErrorContainer = NephColors.TextPrimary,

    outline = NephColors.BorderSubtle,
    outlineVariant = NephColors.Divider
)

private val DarkColorScheme: ColorScheme = darkColorScheme(
    primary = NephColors.Primary,
    onPrimary = NephColors.TextOnPrimary,
    primaryContainer = NephColors.PrimaryDark,
    onPrimaryContainer = NephColors.TextOnPrimary,

    secondary = NephColors.PrimaryDark,
    onSecondary = NephColors.TextOnPrimary,
    secondaryContainer = NephColors.PrimaryDarker,
    onSecondaryContainer = NephColors.TextOnPrimary,

    tertiary = NephColors.Info,
    onTertiary = NephColors.TextOnPrimary,

    background = NephColors.DarkBackground,
    onBackground = NephColors.SurfaceCard,

    surface = NephColors.DarkSurface,
    onSurface = NephColors.SurfaceCard,
    surfaceVariant = NephColors.DarkSurfaceVariant,
    onSurfaceVariant = NephColors.TextMuted,

    error = NephColors.Error,
    onError = NephColors.TextOnPrimary,
    errorContainer = NephColors.PrimaryDarker,
    onErrorContainer = NephColors.TextOnPrimary,

    outline = NephColors.DarkOutline,
    outlineVariant = NephColors.DarkOutlineVariant
)

@Composable
fun NephTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    CompositionLocalProvider(
        LocalNephSpacing provides NephSpacing()
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = NephTypography,
            shapes = NephShapes,
            content = content
        )
    }
}