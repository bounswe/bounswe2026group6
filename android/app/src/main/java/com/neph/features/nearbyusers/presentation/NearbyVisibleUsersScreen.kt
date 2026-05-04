package com.neph.features.nearbyusers.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.neph.core.network.ApiException
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.nearbyusers.data.NearbyVisibleUserUiModel
import com.neph.features.nearbyusers.data.NearbyVisibleUsersRepository
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun NearbyVisibleUsersScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: () -> Unit,
    onProfileClick: () -> Unit,
    onNavigateToLogin: () -> Unit,
    profileBadgeText: String,
    modifier: Modifier = Modifier
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()
    val token = AuthSessionStore.getAccessToken()
    var users by remember { mutableStateOf<List<NearbyVisibleUserUiModel>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf("") }
    var showingCachedData by remember { mutableStateOf(false) }

    fun loadNearbyUsers() {
        val safeToken = token
        val cacheOwnerUserId = AuthSessionStore.getCurrentUserId()
        if (safeToken.isNullOrBlank() || cacheOwnerUserId.isNullOrBlank()) {
            onNavigateToLogin()
            return
        }

        loading = true
        message = ""
        errorMessage = ""
        scope.launch {
            try {
                val result = NearbyVisibleUsersRepository.refreshNearbyVisibleUsers(
                    token = safeToken,
                    cacheOwnerUserId = cacheOwnerUserId
                )
                users = result.users
                showingCachedData = result.fromCache || result.isStale
                message = when {
                    result.message != null -> result.message
                    result.users.isEmpty() -> "No nearby visible users are available right now."
                    result.fromCache -> "Showing cached nearby users. This information may be stale."
                    else -> "Nearby visible users refreshed."
                }
            } catch (error: ApiException) {
                if (error.status == 401) {
                    AuthRepository.logout()
                    errorMessage = "Session expired. Please log in again."
                    onNavigateToLogin()
                } else {
                    errorMessage = error.message.ifBlank { "Could not load nearby visible users. Please retry." }
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                errorMessage = "Could not load nearby visible users. Please retry."
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadNearbyUsers()
    }

    AppDrawerScaffold(
        title = "Nearby Users",
        currentRoute = Routes.NearbyUsers.route,
        onNavigateToRoute = onNavigateToRoute,
        drawerItems = Routes.authenticatedDrawerItems,
        modifier = modifier,
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = "Profile",
        contentMaxWidth = 560.dp,
        contentAlignment = Alignment.TopCenter
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                    SectionHeader(
                        title = "Nearby Visible Users",
                        subtitle = "Based on your residential/profile area, not your current GPS. Only users visible through privacy or trusted circle rules are cached."
                    )
                    SecondaryButton(
                        text = "Refresh",
                        onClick = { loadNearbyUsers() },
                        enabled = !loading
                    )
                }
            }

            if (loading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
            }

            if (showingCachedData) {
                SectionCard {
                    HelperText(text = "Cached data may be stale. Refresh when connectivity is available.")
                }
            }

            if (message.isNotBlank()) {
                SectionCard {
                    HelperText(text = message)
                }
            }

            if (errorMessage.isNotBlank()) {
                SectionCard {
                    Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                        HelperText(text = errorMessage)
                        SecondaryButton(text = "Retry", onClick = { loadNearbyUsers() })
                    }
                }
            }

            users.forEach { user ->
                NearbyVisibleUserRow(user = user)
            }
        }
    }
}

@Composable
private fun NearbyVisibleUserRow(user: NearbyVisibleUserUiModel) {
    val spacing = LocalNephSpacing.current
    SectionCard {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = user.displayName ?: user.userId,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Last update: ${user.statusUpdatedAt ?: "No response yet"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                AssistChip(
                    onClick = {},
                    label = { Text(formatSafetyStatus(user.safetyStatus)) }
                )
            }

            Text(
                text = buildLocationLabel(user),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (user.isStale) {
                Text(
                    text = "Stale cache from ${formatEpoch(user.fetchedAtEpochMillis)}",
                    modifier = Modifier.padding(top = 2.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

private fun buildLocationLabel(user: NearbyVisibleUserUiModel): String {
    if (!user.hasLocation) {
        return "Location not cached or not shared."
    }

    return "Approximate location: ${"%.3f".format(Locale.US, user.latitude)}, ${"%.3f".format(Locale.US, user.longitude)}"
}

private fun formatSafetyStatus(status: String): String {
    return when (status.trim().lowercase()) {
        "safe" -> "Safe"
        "not_safe" -> "Needs help"
        else -> "Unknown"
    }
}

private fun formatEpoch(epochMillis: Long): String {
    return SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(Date(epochMillis))
}
