package com.neph.features.news.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.Modifier
import com.neph.features.news.data.Announcement
import com.neph.features.news.data.AnnouncementsRepository
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.StatusBadge
import com.neph.ui.components.display.StatusBadgeTone
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.CancellationException

private sealed interface NewsUiState {
    data object Loading : NewsUiState
    data class Loaded(val items: List<Announcement>) : NewsUiState
    data class Error(val message: String) : NewsUiState
}

private const val SummaryMaxLength = 180

private fun summarizeAnnouncementContent(content: String): String {
    val normalized = content.replace(Regex("\\s+"), " ").trim()
    if (normalized.length <= SummaryMaxLength) {
        return normalized
    }
    val truncated = normalized.substring(0, SummaryMaxLength - 1).trim()
    return "$truncated…"
}

@Composable
fun NewsScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: (() -> Unit)?,
    onProfileClick: () -> Unit,
    onOpenAnnouncement: (String) -> Unit,
    profileBadgeText: String,
    isAuthenticated: Boolean
) {
    val spacing = LocalNephSpacing.current
    var state by remember { mutableStateOf<NewsUiState>(NewsUiState.Loading) }
    var reloadKey by remember { mutableStateOf(0) }

    LaunchedEffect(reloadKey) {
        state = NewsUiState.Loading
        try {
            val announcements = AnnouncementsRepository.fetchAnnouncements()
            state = NewsUiState.Loaded(announcements)
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (error: Throwable) {
            state = NewsUiState.Error(
                error.message?.takeIf { it.isNotBlank() }
                    ?: "Could not load announcements. Please try again."
            )
        }
    }

    AppDrawerScaffold(
        title = "News & Announcements",
        currentRoute = Routes.News.route,
        onNavigateToRoute = onNavigateToRoute,
        drawerItems = if (isAuthenticated) {
            Routes.authenticatedDrawerItems
        } else {
            Routes.guestDrawerItems
        },
        bottomNavItems = if (isAuthenticated) {
            Routes.authenticatedBottomNavItems
        } else {
            Routes.guestBottomNavItems
        },
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = if (isAuthenticated) "Profile" else "Login / Create Account",
        contentFillMaxSize = true
    ) {
        Column(
            modifier = Modifier.fillMaxHeight(),
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Updates",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold
                )

                when (val current = state) {
                    is NewsUiState.Loading -> LoadingState()
                    is NewsUiState.Error -> ErrorState(
                        message = current.message,
                        onRetry = { reloadKey += 1 }
                    )
                    is NewsUiState.Loaded -> {
                        if (current.items.isEmpty()) {
                            EmptyState(onRetry = { reloadKey += 1 })
                        } else {
                            AnnouncementList(
                                items = current.items,
                                onOpenAnnouncement = onOpenAnnouncement
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LoadingState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    val spacing = LocalNephSpacing.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = spacing.lg),
        verticalArrangement = Arrangement.spacedBy(spacing.md),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Couldn't load announcements",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        PrimaryButton(
            text = "Retry",
            onClick = onRetry,
            modifier = Modifier.fillMaxWidth(0.6f)
        )
    }
}

@Composable
private fun EmptyState(onRetry: () -> Unit) {
    val spacing = LocalNephSpacing.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = spacing.lg),
        verticalArrangement = Arrangement.spacedBy(spacing.md),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "No announcements yet",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = "Check back later for updates from administrators.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        PrimaryButton(
            text = "Refresh",
            onClick = onRetry,
            modifier = Modifier.fillMaxWidth(0.6f)
        )
    }
}

@Composable
private fun AnnouncementList(
    items: List<Announcement>,
    onOpenAnnouncement: (String) -> Unit
) {
    val spacing = LocalNephSpacing.current

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = spacing.md),
        verticalArrangement = Arrangement.spacedBy(spacing.md)
    ) {
        itemsIndexed(items, key = { _, item -> item.id }) { index, item ->
            val summary = remember(item.id, item.content) {
                summarizeAnnouncementContent(item.content)
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenAnnouncement(item.id) },
                verticalArrangement = Arrangement.spacedBy(spacing.xs)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    StatusBadge(
                        text = "Announcement",
                        tone = StatusBadgeTone.BRAND
                    )

                    Text(
                        text = formatPublishedAt(item.createdAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Text(
                    text = item.title,
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold
                )

                Text(
                    text = summary,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Text(
                    text = "Open announcement",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold
                )
            }

            if (index < items.lastIndex) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun NewsScreenPreview() {
    NephTheme {
        NewsScreen(
            onNavigateToRoute = {},
            onOpenSettings = {},
            onProfileClick = {},
            onOpenAnnouncement = {},
            profileBadgeText = "PP",
            isAuthenticated = true
        )
    }
}
