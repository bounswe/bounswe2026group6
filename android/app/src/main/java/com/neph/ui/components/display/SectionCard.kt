package com.neph.ui.components.display

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Section wrapper used across screens.
 *
 * Historically this was a rounded "card" with a surface background and padding,
 * which made every screen feel like a stack of disconnected boxes. To give
 * screens a more integrated, modern feel, the wrapper is now visually
 * transparent: it provides no background, no clip, no padding. Vertical
 * spacing between sections is controlled by the screen-level Arrangement
 * (already configured by `AppDrawerScaffold`).
 *
 * Sections that genuinely need a contained look should compose an explicit
 * surface locally instead of relying on this wrapper.
 */
@Composable
fun SectionCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        content = content
    )
}

