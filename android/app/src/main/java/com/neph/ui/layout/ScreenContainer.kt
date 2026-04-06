package com.neph.ui.layout

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.neph.ui.theme.LocalNephSpacing

@Composable
fun ScreenContainer(
    modifier: Modifier = Modifier,
    contentAlignment: Alignment = Alignment.TopStart,
    content: @Composable BoxScope.() -> Unit
) {
    val spacing = LocalNephSpacing.current

    Box(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = spacing.xl, vertical = spacing.xl),
        contentAlignment = contentAlignment,
        content = content
    )
}