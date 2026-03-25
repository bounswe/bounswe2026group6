package com.neph.features.profile.presentation

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
fun ProfileScreen(
    onNavigateToPrivacy: () -> Unit,
    onNavigateToSecurity: () -> Unit,
    onLogout: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    AppScaffold(title = "Profile") {
        Column(
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard {
                SectionHeader(
                    title = "Profile Screen",
                    subtitle = "Temporary placeholder screen."
                )

                Text(
                    text = "The Android profile screen will be implemented after the auth flow foundation is ready.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}