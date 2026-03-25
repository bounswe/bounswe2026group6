package com.neph.features.auth.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppScaffold
import com.neph.ui.theme.LocalNephSpacing

@Composable
fun TermsOfServiceScreen(
    onNavigateBack: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    AppScaffold(title = "Terms of Service") {
        Column(
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard {
                SectionHeader(
                    title = "Terms of Service",
                    subtitle = "Temporary placeholder screen."
                )

                Text(
                    text = "The Android terms of service screen will be implemented in detail after the auth flow screens are in place.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}