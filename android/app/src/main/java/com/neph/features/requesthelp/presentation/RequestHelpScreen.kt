package com.neph.features.requesthelp.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme

@Composable
fun RequestHelpScreen(
    onNavigateBack: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    AppScaffold(
        title = "Request Help",
        onNavigateBack = onNavigateBack
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard {
                SectionHeader(
                    title = "Emergency Help Request",
                    subtitle = "Start a request and describe what kind of help you need."
                )

                Text(
                    text = "Submission fields and request handling will be connected in a later step. This screen currently provides the UI entry point only.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun RequestHelpScreenPreview() {
    NephTheme {
        RequestHelpScreen(onNavigateBack = {})
    }
}
