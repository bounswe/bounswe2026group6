package com.neph.features.notifications.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.notifications.data.NotificationUiModel
import com.neph.features.notifications.data.NotificationsRepository
import com.neph.navigation.Routes
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.launch

@Composable
fun NotificationsScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: (() -> Unit)?,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    isAuthenticated: Boolean
) {
    val spacing = LocalNephSpacing.current
    val coroutineScope = rememberCoroutineScope()
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var unreadCount by remember { mutableStateOf(0) }
    var notifications by remember { mutableStateOf<List<NotificationUiModel>>(emptyList()) }
    var nextCursor by remember { mutableStateOf<String?>(null) }
    val token = remember { AuthSessionStore.getAccessToken() }

    suspend fun refresh() {
        if (token.isNullOrBlank()) return

        isLoading = true
        errorMessage = null
        try {
            val page = NotificationsRepository.fetchNotifications(token = token, limit = 50)
            notifications = page.items
            unreadCount = page.unreadCount
            nextCursor = page.nextCursor
        } catch (error: Exception) {
            errorMessage = error.message ?: "Failed to load notifications."
        } finally {
            isLoading = false
        }
    }

    LaunchedEffect(isAuthenticated, token) {
        if (isAuthenticated && !token.isNullOrBlank()) {
            refresh()
        }
    }

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
                    subtitle = if (isAuthenticated) {
                        "Unread: $unreadCount"
                    } else {
                        "Sign in to view your notifications."
                    }
                )

                if (!isAuthenticated) {
                    Text(
                        text = "You need to log in to see notification history.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    return@SectionCard
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    TextButton(
                        onClick = {
                            coroutineScope.launch {
                                refresh()
                            }
                        }
                    ) {
                        Text("Refresh")
                    }

                    TextButton(
                        onClick = {
                            if (token.isNullOrBlank()) return@TextButton
                            coroutineScope.launch {
                                try {
                                    NotificationsRepository.markAllAsRead(token)
                                    refresh()
                                } catch (error: Exception) {
                                    errorMessage = error.message ?: "Failed to mark all as read."
                                }
                            }
                        }
                    ) {
                        Text("Mark All Read")
                    }
                }

                if (isLoading) {
                    CircularProgressIndicator()
                    return@SectionCard
                }

                if (!errorMessage.isNullOrBlank()) {
                    Text(
                        text = errorMessage.orEmpty(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                }

                if (notifications.isEmpty()) {
                    Text(
                        text = "No notifications yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                        items(notifications, key = { it.id }) { notification ->
                            Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = notification.title,
                                        style = MaterialTheme.typography.titleSmall,
                                        color = MaterialTheme.colorScheme.onSurface,
                                        fontWeight = if (notification.isRead) FontWeight.Normal else FontWeight.SemiBold
                                    )

                                    if (!notification.isRead) {
                                        TextButton(
                                            onClick = {
                                                if (token.isNullOrBlank()) return@TextButton
                                                coroutineScope.launch {
                                                    try {
                                                        NotificationsRepository.markAsRead(token, notification.id)
                                                        refresh()
                                                    } catch (error: Exception) {
                                                        errorMessage = error.message ?: "Failed to mark notification as read."
                                                    }
                                                }
                                            }
                                        ) {
                                            Text("Mark Read")
                                        }
                                    }
                                }

                                Text(
                                    text = notification.body,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )

                                notification.createdAt?.let { createdAt ->
                                    Text(
                                        text = createdAt,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        }
                    }

                    if (!nextCursor.isNullOrBlank()) {
                        TextButton(
                            onClick = {
                                if (token.isNullOrBlank() || isLoading) return@TextButton
                                coroutineScope.launch {
                                    try {
                                        isLoading = true
                                        val page = NotificationsRepository.fetchNotifications(
                                            token = token,
                                            limit = 50,
                                            cursor = nextCursor
                                        )
                                        notifications = notifications + page.items
                                        unreadCount = page.unreadCount
                                        nextCursor = page.nextCursor
                                    } catch (error: Exception) {
                                        errorMessage = error.message ?: "Failed to load more notifications."
                                    } finally {
                                        isLoading = false
                                    }
                                }
                            }
                        ) {
                            Text("Load More")
                        }
                    }
                }
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
