package com.neph.features.settings.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme

@Composable
fun SettingsScreen(
    onNavigateToRoute: (String) -> Unit,
    onNavigateToPrivacySecurity: () -> Unit,
    onLogout: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    AppDrawerScaffold(
        title = "Settings",
        currentRoute = Routes.Settings.route,
        onNavigateToRoute = onNavigateToRoute
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard {
                SectionHeader(
                    title = "Settings",
                    subtitle = "This page will collect app and account preferences."
                )

                Text(
                    text = "Settings controls will be expanded in a later step.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            SecondaryButton(
                text = "Privacy & Security",
                onClick = onNavigateToPrivacySecurity,
                modifier = Modifier.fillMaxWidth()
            )

            SecondaryButton(
                text = "Log Out",
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun SettingsScreenPreview() {
    NephTheme {
        SettingsScreen(
            onNavigateToRoute = {},
            onNavigateToPrivacySecurity = {},
            onLogout = {}
        )
    }
}