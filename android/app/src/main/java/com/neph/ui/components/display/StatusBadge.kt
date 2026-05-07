package com.neph.ui.components.display

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephColors
import com.neph.ui.theme.NephShapeTokens

enum class StatusBadgeTone {
    NEUTRAL,
    SUCCESS,
    WARNING,
    DANGER,
    INFO,
    BRAND
}

/**
 * Compact pill badge used to convey status next to titles or list items.
 * Conveys meaning by both color AND text label (WCAG 1.4.1).
 */
@Composable
fun StatusBadge(
    text: String,
    modifier: Modifier = Modifier,
    tone: StatusBadgeTone = StatusBadgeTone.NEUTRAL,
    leadingIcon: ImageVector? = null
) {
    val spacing = LocalNephSpacing.current
    val (containerColor, contentColor) = toneColors(tone)

    Row(
        modifier = modifier
            .background(containerColor, shape = NephShapeTokens.Pill)
            .padding(horizontal = spacing.sm, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(spacing.xs)
    ) {
        if (leadingIcon != null) {
            Icon(
                imageVector = leadingIcon,
                contentDescription = null,
                tint = contentColor,
                modifier = Modifier.size(14.dp)
            )
        }

        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = contentColor
        )
    }
}

/**
 * Round, single-line icon tile (e.g. leading element in a list row).
 */
@Composable
fun TonedIconTile(
    icon: ImageVector,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    tone: StatusBadgeTone = StatusBadgeTone.BRAND
) {
    val (containerColor, contentColor) = toneColors(tone)

    Box(
        modifier = modifier
            .size(40.dp)
            .background(containerColor, shape = NephShapeTokens.Small),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = contentColor,
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
private fun toneColors(tone: StatusBadgeTone): Pair<Color, Color> {
    return when (tone) {
        StatusBadgeTone.NEUTRAL -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
        StatusBadgeTone.SUCCESS -> Color(0xFFDCFCE7) to Color(0xFF15803D)
        StatusBadgeTone.WARNING -> Color(0xFFFEF3C7) to Color(0xFF92400E)
        StatusBadgeTone.DANGER -> NephColors.PrimaryLight to NephColors.PrimaryDark
        StatusBadgeTone.INFO -> Color(0xFFDBEAFE) to Color(0xFF1D4ED8)
        StatusBadgeTone.BRAND -> NephColors.PrimaryLight to NephColors.PrimaryDark
    }
}
