package com.neph.features.news.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.Modifier
import com.neph.navigation.Routes
import com.neph.ui.components.display.SectionCard
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme

private data class NewsItem(
    val id: String,
    val title: String,
    val summary: String,
    val publishedAt: String,
    val category: String
)

private val mockNews = listOf(
    NewsItem(
        id = "n-001",
        title = "Neighborhood Preparedness Workshops Start Next Week",
        summary = "Local volunteer teams will host practical first-response workshops for households in participating districts.",
        publishedAt = "2026-03-20",
        category = "Preparedness"
    ),
    NewsItem(
        id = "n-002",
        title = "Mobile App Pilot Open for Early Access",
        summary = "NEPH mobile pilot is available for selected users to test incident reporting and emergency support requests.",
        publishedAt = "2026-03-18",
        category = "Announcement"
    ),
    NewsItem(
        id = "n-003",
        title = "Community Safety Volunteers Expanded",
        summary = "New volunteers have joined the response network, improving local coverage for urgent coordination.",
        publishedAt = "2026-03-13",
        category = "Community"
    ),
    NewsItem(
        id = "n-004",
        title = "Medical Information Checklist Updated",
        summary = "The profile health checklist now includes clearer guidance for medications and chronic conditions.",
        publishedAt = "2026-03-09",
        category = "Preparedness"
    ),
    NewsItem(
        id = "n-005",
        title = "District Evacuation Route Signage Refreshed",
        summary = "Municipal teams completed replacement of damaged evacuation signs across high-risk neighborhoods.",
        publishedAt = "2026-03-06",
        category = "Announcement"
    ),
    NewsItem(
        id = "n-006",
        title = "Volunteer Radio Drill Scheduled for Saturday",
        summary = "Community coordinators will run a communication drill to validate fallback channels during outages.",
        publishedAt = "2026-03-04",
        category = "Community"
    ),
    NewsItem(
        id = "n-007",
        title = "Water Stocking Guidance Updated for Families",
        summary = "Preparedness guidelines now include age-based daily water recommendations for households.",
        publishedAt = "2026-03-01",
        category = "Preparedness"
    ),
    NewsItem(
        id = "n-008",
        title = "Search and Rescue Teams Added in Northern Zone",
        summary = "Two new rapid-response teams were integrated to reduce arrival times in remote areas.",
        publishedAt = "2026-02-26",
        category = "Community"
    ),
    NewsItem(
        id = "n-009",
        title = "Critical Medication Reminder Campaign Launched",
        summary = "A new campaign reminds patients to maintain a 7-day emergency medication reserve.",
        publishedAt = "2026-02-24",
        category = "Announcement"
    ),
    NewsItem(
        id = "n-010",
        title = "Neighborhood Assembly Point Maps Published",
        summary = "Updated assembly point maps are now available with improved accessibility details.",
        publishedAt = "2026-02-20",
        category = "Preparedness"
    ),
    NewsItem(
        id = "n-011",
        title = "Local First-Aid Mentor Program Expanded",
        summary = "The mentor network now covers 14 additional schools and public training centers.",
        publishedAt = "2026-02-16",
        category = "Community"
    ),
    NewsItem(
        id = "n-012",
        title = "Power Outage Kit Checklist Shared",
        summary = "NEPH published a concise checklist for household lighting, charging, and communication readiness.",
        publishedAt = "2026-02-12",
        category = "Preparedness"
    )
)

@Composable
fun NewsScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: (() -> Unit)?,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    isAuthenticated: Boolean
) {
    val spacing = LocalNephSpacing.current
    val categories = remember { listOf("All", "Preparedness", "Announcement", "Community") }
    var selectedCategory by remember { mutableStateOf("All") }
    var isFilterExpanded by remember { mutableStateOf(false) }

    val filteredNews = remember(selectedCategory) {
        if (selectedCategory == "All") {
            mockNews
        } else {
            mockNews.filter { it.category == selectedCategory }
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
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = if (isAuthenticated) "Profile" else "Login / Create Account"
    ) {
        Column(
            modifier = Modifier.fillMaxHeight(),
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard(
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Updates",
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.SemiBold
                    )

                    Row {
                        TextButton(onClick = { isFilterExpanded = true }) {
                            Text(text = selectedCategory)
                        }

                        DropdownMenu(
                            expanded = isFilterExpanded,
                            onDismissRequest = { isFilterExpanded = false }
                        ) {
                            categories.forEach { category ->
                                DropdownMenuItem(
                                    text = { Text(category) },
                                    onClick = {
                                        selectedCategory = category
                                        isFilterExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    verticalArrangement = Arrangement.spacedBy(spacing.md)
                ) {
                    itemsIndexed(filteredNews, key = { _, item -> item.id }) { index, item ->
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = item.category,
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.SemiBold
                                )

                                Text(
                                    text = item.publishedAt,
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
                                text = item.summary,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        if (index < filteredNews.lastIndex) {
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        }
                    }
                }
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
            profileBadgeText = "PP",
            isAuthenticated = true
        )
    }
}
