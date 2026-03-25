package com.neph.features.privacy.presentation

import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppScaffold
import com.neph.ui.theme.LocalNephSpacing

@Composable
fun PrivacyScreen(
    onNavigateBack: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    AppScaffold(title = "Privacy Policy") {
        Column(
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard {
                SectionHeader(
                    title = "Privacy Policy",
                    subtitle = "Temporary placeholder screen."
                )

                Text(
                    text = "The Android privacy policy screen will be implemented after the auth flow screens are in place.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}