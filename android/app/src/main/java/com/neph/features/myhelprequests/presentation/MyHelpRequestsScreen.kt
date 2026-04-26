package com.neph.features.myhelprequests.presentation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Help
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.text.style.TextAlign
import com.neph.core.network.ApiException
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.myhelprequests.data.MyHelpRequestUiModel
import com.neph.features.myhelprequests.data.MyHelpRequestsRepository
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope

@Composable
fun MyHelpRequestsScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: (() -> Unit)?,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    isAuthenticated: Boolean
) {
    val spacing = LocalNephSpacing.current
    val token = AuthSessionStore.getAccessToken().orEmpty()
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val requests by MyHelpRequestsRepository.observeHelpRequests(isAuthenticated)
        .collectAsState(initial = emptyList())
    var actionInProgressRequestId by remember { mutableStateOf<String?>(null) }
    var actionMessage by remember { mutableStateOf("") }
    var initialRefreshInProgress by remember(isAuthenticated, token) { mutableStateOf(true) }

    AppDrawerScaffold(
        title = "My Help Requests",
        currentRoute = Routes.MyHelpRequests.route,
        onNavigateToRoute = onNavigateToRoute,
        drawerItems = if (isAuthenticated) {
            Routes.authenticatedDrawerItems
        } else {
            Routes.guestDrawerItems
        },
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = if (isAuthenticated) "Profile" else "Login / Create Account",
        contentFillMaxSize = true
    ) {
        LaunchedEffect(isAuthenticated, token) {
            initialRefreshInProgress = true
            OfflineSyncScheduler.enqueueSync(context, reason = "my-help-requests-open", replaceExisting = true)
            try {
                if (isAuthenticated && token.isNotBlank()) {
                    MyHelpRequestsRepository.fetchMyHelpRequests(token)
                } else {
                    MyHelpRequestsRepository.fetchGuestHelpRequests()
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (error: ApiException) {
                if (error.status == 401 && isAuthenticated) {
                    AuthRepository.logout()
                    onNavigateToRoute(Routes.Login.route)
                }
            } catch (_: Exception) {
                // Keep showing the best local snapshot if the initial refresh fails.
            } finally {
                initialRefreshInProgress = false
            }
        }

        when {
            initialRefreshInProgress && requests.isEmpty() -> {
                LoadingStateView()
            }

            requests.isEmpty() -> {
                EmptyStateView(
                    onRequestHelp = { onNavigateToRoute(Routes.RequestHelp.route) }
                )
            }

            else -> {
                val activeRequest = requests.firstOrNull { it.isActive }
                val requestHistory = requests.filterNot { it.isActive }

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(spacing.lg),
                    contentPadding = PaddingValues(vertical = spacing.sm)
                ) {
                    item {
                        SectionHeader(
                            title = "Current Request",
                            subtitle = if (isAuthenticated) {
                                "Your latest active help request is shown first."
                            } else {
                                "Your latest guest help request is shown first."
                            }
                        )
                    }

                    if (activeRequest == null) {
                        item {
                            SectionCard {
                                Text(
                                    text = "No active help request right now.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    } else {
                        item {
                            MyHelpRequestCard(
                                request = activeRequest,
                                titleOverride = activeRequest.helpTypeSummary,
                                subtitleOverride = activeRequest.createdAt ?: "Created time unavailable",
                                actionMessage = actionMessage,
                                onResolve = if (isAuthenticated && token.isNotBlank()) {
                                    {
                                        actionMessage = ""
                                        actionInProgressRequestId = activeRequest.id
                                        scope.launch {
                                            try {
                                                MyHelpRequestsRepository.markRequestAsResolved(
                                                    token = token,
                                                    requestId = activeRequest.id
                                                )
                                                actionMessage = "Request marked resolved locally and queued for sync."
                                            } catch (_: Exception) {
                                                actionMessage = "Could not save the status change locally."
                                            } finally {
                                                actionInProgressRequestId = null
                                            }
                                        }
                                    }
                                } else if (!isAuthenticated && activeRequest.guestAccessToken != null) {
                                    {
                                        actionMessage = ""
                                        actionInProgressRequestId = activeRequest.id
                                        scope.launch {
                                            try {
                                                MyHelpRequestsRepository.markGuestRequestAsResolved(
                                                    requestId = activeRequest.id,
                                                    guestAccessToken = activeRequest.guestAccessToken
                                                )
                                                actionMessage = "Request marked resolved locally and queued for sync."
                                            } catch (_: Exception) {
                                                actionMessage = "Could not save the status change locally."
                                            } finally {
                                                actionInProgressRequestId = null
                                            }
                                        }
                                    }
                                } else {
                                    null
                                },
                                resolveLoading = actionInProgressRequestId == activeRequest.id
                            )
                        }
                    }

                    if (requestHistory.isNotEmpty()) {
                        item {
                            SectionHeader(
                                title = "Request History",
                                subtitle = if (isAuthenticated) {
                                    "Previous requests from your account."
                                } else {
                                    "Previous guest requests created from this device."
                                }
                            )
                        }

                        items(requestHistory, key = { it.id }) { request ->
                            MyHelpRequestCard(request = request)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LoadingStateView() {
    val spacing = LocalNephSpacing.current

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            CircularProgressIndicator()

            Text(
                text = "Loading your help requests...",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun EmptyStateView(
    onRequestHelp: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            Box(
                modifier = Modifier
                    .size(spacing.huge * 2)
                    .background(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Help,
                    contentDescription = "No help requests yet",
                    tint = MaterialTheme.colorScheme.primary
                )
            }

            Text(
                text = "No help requests yet",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center
            )

            Text(
                text = "Create your first request to get help quickly.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            PrimaryButton(
                text = "Request Help",
                onClick = onRequestHelp
            )
        }
    }
}

@Composable
private fun MyHelpRequestCard(
    request: MyHelpRequestUiModel,
    titleOverride: String? = null,
    subtitleOverride: String? = null,
    actionMessage: String = "",
    onResolve: (() -> Unit)? = null,
    resolveLoading: Boolean = false
) {
    val spacing = LocalNephSpacing.current
    val context = LocalContext.current

    fun openDialer(number: String) {
        val normalized = number.filter { it.isDigit() || it == '+' }
        if (normalized.isBlank()) return
        context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$normalized")))
    }

    SectionCard {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
            SectionHeader(
                title = titleOverride ?: request.helpTypeSummary,
                subtitle = subtitleOverride ?: (request.createdAt ?: "Created time unavailable")
            )

            Text(
                text = if (request.isActive) request.description else request.shortDescription,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Text(
                text = "Location: ${request.locationLabel}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface
            )

            Text(
                text = "Status: ${request.statusLabel}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary
            )

            if (request.isPendingSync) {
                HelperText(text = "Saved locally. NEPH will sync this change when the network is available.")
            }

            if (request.isFailedSync) {
                HelperText(text = request.pendingError ?: "Sync failed. Retry when connected.")
                SecondaryButton(
                    text = "Retry Sync",
                    onClick = {
                        OfflineSyncScheduler.enqueueSync(context, reason = "manual-help-request-retry", replaceExisting = true)
                    }
                )
            }

            request.lastSyncedAt?.let {
                Text(
                    text = "Last synced: $it",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (request.responders.isNotEmpty()) {
                SectionHeader(
                    title = if (request.responders.size == 1) "Assigned Helper Details" else "Assigned Responders",
                    subtitle = if (request.responders.size == 1) {
                        "Name, phone, profession, and expertise of your assigned helper."
                    } else {
                        "Name, phone, profession, and expertise of active responders assigned to this request."
                    }
                )

                Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                    request.responders.forEachIndexed { index, responder ->
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
                            if (request.responders.size > 1) {
                                Text(
                                    text = "Responder ${index + 1}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }

                            responder.fullName?.let {
                                Text(
                                    text = "Name: $it",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            responder.phone?.let {
                                Text(
                                    text = "Phone: $it",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.clickable { openDialer(it) }
                                )
                            }

                            responder.profession?.let {
                                Text(
                                    text = "Profession: $it",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            responder.expertise?.let {
                                Text(
                                    text = "Expertise: $it",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            if (!responder.hasVisibleDetails) {
                                Text(
                                    text = "Responder details unavailable.",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }

            if (request.helpTypes.size > 1) {
                Text(
                    text = "Help Types: ${request.helpTypes.joinToString(", ")}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (request.isActive && onResolve != null) {
                if (actionMessage.isNotBlank()) {
                    HelperText(text = actionMessage)
                }

                PrimaryButton(
                    text = "Mark Request As Resolved",
                    onClick = onResolve,
                    loading = resolveLoading
                )
            }
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun MyHelpRequestsScreenPreview() {
    NephTheme {
        MyHelpRequestsScreen(
            onNavigateToRoute = {},
            onOpenSettings = {},
            onProfileClick = {},
            profileBadgeText = "PP",
            isAuthenticated = true
        )
    }
}
