package com.neph.features.notifications.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.neph.navigation.Routes
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme

@Composable
fun NotificationsScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: (() -> Unit)?,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    isAuthenticated: Boolean
) {
    val spacing = LocalNephSpacing.current

    AppDrawerScaffold(
        title = "Notifications",
        currentRoute = Routes.Notifications.route,
        onNavigateToRoute = onNavigateToRoute,
        drawerItems = if (isAuthenticated) {
            Routes.authenticatedDrawerItems
        } else {
            Routes.guestDrawerItems
        },
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = if (isAuthenticated) "Profile" else "Login / Create Account"
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.lg)) {
            SectionCard {
                SectionHeader(
                    title = "Notifications",
                    subtitle = "This page will show important alerts and updates."
                )

                Text(
                    text = "Notification preferences and alert history will be added later.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun NotificationsScreenPreview() {
    NephTheme {
        NotificationsScreen(
            onNavigateToRoute = {},
            onOpenSettings = {},
            onProfileClick = {},
            profileBadgeText = "PP",
            isAuthenticated = true
        )
    }
}
