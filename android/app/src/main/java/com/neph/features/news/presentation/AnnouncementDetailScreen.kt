package com.neph.features.news.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.neph.features.news.data.Announcement
import com.neph.features.news.data.AnnouncementsRepository
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.StatusBadge
import com.neph.ui.components.display.StatusBadgeTone
import com.neph.ui.layout.AppScaffold
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException

private sealed interface DetailUiState {
    data object Loading : DetailUiState
    data class Loaded(val announcement: Announcement) : DetailUiState
    data class Error(val message: String) : DetailUiState
}

@Composable
fun AnnouncementDetailScreen(
    announcementId: String,
    onNavigateBack: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    var state by remember { mutableStateOf<DetailUiState>(DetailUiState.Loading) }
    var reloadKey by remember { mutableStateOf(0) }

    LaunchedEffect(announcementId, reloadKey) {
        state = DetailUiState.Loading
        try {
            val announcement = AnnouncementsRepository.fetchAnnouncement(announcementId)
            state = DetailUiState.Loaded(announcement)
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (error: Throwable) {
            state = DetailUiState.Error(
                error.message?.takeIf { it.isNotBlank() }
                    ?: "Could not load this announcement. Please try again."
            )
        }
    }

    AppScaffold(
        title = "Announcement",
        onNavigateBack = onNavigateBack
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard {
                when (val current = state) {
                    is DetailUiState.Loading -> {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(spacing.lg),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator()
                        }
                    }
                    is DetailUiState.Error -> {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(spacing.md),
                            verticalArrangement = Arrangement.spacedBy(spacing.md),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "Couldn't load announcement",
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.onSurface,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = current.message,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            PrimaryButton(
                                text = "Retry",
                                onClick = { reloadKey += 1 },
                                modifier = Modifier.fillMaxWidth(0.6f)
                            )
                        }
                    }
                    is DetailUiState.Loaded -> {
                        AnnouncementDetailContent(announcement = current.announcement)
                    }
                }
            }
        }
    }
}

@Composable
private fun AnnouncementDetailContent(announcement: Announcement) {
    val spacing = LocalNephSpacing.current
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(spacing.sm)
    ) {
        StatusBadge(
            text = "Announcement",
            tone = StatusBadgeTone.BRAND
        )

        Text(
            text = announcement.title,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold
        )

        val publishedAt = formatPublishedAt(announcement.createdAt)
        if (publishedAt.isNotBlank()) {
            Text(
                text = publishedAt,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Text(
            text = announcement.content,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
