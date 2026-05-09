package com.neph.ui.theme

import androidx.compose.ui.graphics.Color

object NephColors {
    // Bolder, more modern brand red. Deep enough for confident CTAs while still
    // feeling like the NEPH red-and-white identity.
    val Primary = Color(0xFFDC2626)
    val PrimaryDark = Color(0xFFB31B1B)
    val PrimaryDarker = Color(0xFF7F1212)
    val PrimaryLight = Color(0xFFFFE4E4)
    val PrimaryTint = Color(0xFFFFF1F1)

    // Near-white app surface, subtle muted layer, soft hairline borders.
    val BackgroundPage = Color(0xFFFAFAFB)
    val SurfaceCard = Color(0xFFFFFFFF)
    val SurfaceMuted = Color(0xFFF3F4F6)
    val BorderSubtle = Color(0xFFE5E7EB)
    val Divider = Color(0xFFEFF1F4)

    // High-contrast slate text scale for readability under stress.
    val TextPrimary = Color(0xFF0F172A)
    val TextSecondary = Color(0xFF475569)
    val TextMuted = Color(0xFF94A3B8)
    val TextOnPrimary = Color(0xFFFFFFFF)

    // Accessible status palette — real blue for Info so meaning is not carried
    // by red alone (WCAG 1.4.1).
    val Success = Color(0xFF16A34A)
    val Warning = Color(0xFFD97706)
    val Error = Color(0xFFDC2626)
    val Info = Color(0xFF2563EB)

    val DarkBackground = Color(0xFF0B0B0F)
    val DarkSurface = Color(0xFF15161B)
    val DarkSurfaceVariant = Color(0xFF1F2128)
    val DarkOutline = Color(0xFF353842)
    val DarkOutlineVariant = Color(0xFF24262E)
}