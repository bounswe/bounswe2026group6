package com.neph.features.myhelprequests.presentation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Help
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.neph.core.network.ApiException
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.myhelprequests.data.buildMyHelpRequestsOverview
import com.neph.features.myhelprequests.data.MyHelpRequestUiModel
import com.neph.features.myhelprequests.data.MyHelpRequestsRepository
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.buttons.TextActionButton
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
    val listState = rememberLazyListState()

    val requests by MyHelpRequestsRepository.observeHelpRequests(isAuthenticated)
        .collectAsState(initial = emptyList())
    var actionInProgress by remember { mutableStateOf(false) }
    var actionMessage by remember { mutableStateOf("") }
    var initialRefreshInProgress by remember(isAuthenticated, token) { mutableStateOf(true) }
    var reconnectRefreshInProgress by remember { mutableStateOf(false) }
    var pendingAction by remember { mutableStateOf<PendingRequestAction?>(null) }
    val pullRefreshThreshold = 96.dp

    fun refreshRequests(showFullPageLoading: Boolean) {
        scope.launch {
            if (showFullPageLoading) {
                initialRefreshInProgress = true
            } else {
                reconnectRefreshInProgress = true
            }

            OfflineSyncScheduler.enqueueSync(context, reason = "my-help-requests-refresh", replaceExisting = true)
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
                // Keep showing the best local snapshot if reconnecting fails.
            } finally {
                if (showFullPageLoading) {
                    initialRefreshInProgress = false
                } else {
                    reconnectRefreshInProgress = false
                }
            }
        }
    }

    fun resolveCurrentRequest(currentActiveRequest: MyHelpRequestUiModel) {
        actionMessage = ""
        actionInProgress = true
        scope.launch {
            try {
                if (isAuthenticated && token.isNotBlank()) {
                    MyHelpRequestsRepository.markRequestAsResolved(
                        token = token,
                        requestId = currentActiveRequest.id
                    )
                } else {
                    MyHelpRequestsRepository.markGuestRequestAsResolved(
                        requestId = currentActiveRequest.id,
                        guestAccessToken = currentActiveRequest.guestAccessToken
                    )
                }
                actionMessage = "Request marked resolved."
            } catch (_: Exception) {
                actionMessage = "Could not update request status."
            } finally {
                actionInProgress = false
            }
        }
    }

    fun cancelCurrentRequest(currentActiveRequest: MyHelpRequestUiModel) {
        actionMessage = ""
        actionInProgress = true
        scope.launch {
            try {
                if (isAuthenticated && token.isNotBlank()) {
                    MyHelpRequestsRepository.markRequestAsCancelled(
                        token = token,
                        requestId = currentActiveRequest.id
                    )
                } else {
                    MyHelpRequestsRepository.markGuestRequestAsCancelled(
                        requestId = currentActiveRequest.id,
                        guestAccessToken = currentActiveRequest.guestAccessToken
                    )
                }
                actionMessage = "Request cancelled."
            } catch (_: Exception) {
                actionMessage = "Could not cancel request."
            } finally {
                actionInProgress = false
            }
        }
    }

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
            refreshRequests(showFullPageLoading = true)
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(initialRefreshInProgress, reconnectRefreshInProgress, requests.size) {
                    var pullDistance = 0f
                    detectVerticalDragGestures(
                        onDragEnd = { pullDistance = 0f },
                        onDragCancel = { pullDistance = 0f },
                        onVerticalDrag = { change, dragAmount ->
                            val isAtTop = requests.isEmpty() || (
                                listState.firstVisibleItemIndex == 0 &&
                                    listState.firstVisibleItemScrollOffset == 0
                                )
                            if (dragAmount > 0 && isAtTop && !initialRefreshInProgress && !reconnectRefreshInProgress) {
                                pullDistance += dragAmount
                                change.consume()
                                if (pullDistance >= pullRefreshThreshold.toPx()) {
                                    pullDistance = 0f
                                    refreshRequests(showFullPageLoading = false)
                                }
                            } else if (dragAmount < 0) {
                                pullDistance = 0f
                            }
                        }
                    )
                }
        ) {
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
                    val overview = buildMyHelpRequestsOverview(requests)
                    val currentActiveRequest = overview.activeRequests.firstOrNull()
                    val requestHistory = overview.historyRequests

                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(spacing.lg),
                        contentPadding = PaddingValues(vertical = spacing.sm)
                    ) {
                        if (reconnectRefreshInProgress) {
                            item {
                                ReconnectRefreshIndicator()
                            }
                        }

                    if (overview.hasMultipleRequestContext) {
                        item {
                            RequestsOverviewCard(
                                overview = overview,
                                isAuthenticated = isAuthenticated
                            )
                        }
                    }

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

                    if (currentActiveRequest == null) {
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
                        item(key = currentActiveRequest.id) {
                            MyHelpRequestCard(
                                request = currentActiveRequest,
                                titleOverride = currentActiveRequest.helpTypeSummary,
                                subtitleOverride = currentActiveRequest.createdAt?.let { "Opened: $it" }
                                    ?: "Opened time unavailable",
                                actionMessage = actionMessage,
                                onEdit = { pendingAction = PendingRequestAction.Edit(currentActiveRequest) },
                                onCancel = if (isAuthenticated || currentActiveRequest.localId.isNotBlank()) {
                                    { pendingAction = PendingRequestAction.Cancel(currentActiveRequest) }
                                } else {
                                    null
                                },
                                onResolve = if (isAuthenticated || currentActiveRequest.localId.isNotBlank()) {
                                    { pendingAction = PendingRequestAction.Resolve(currentActiveRequest) }
                                } else {
                                    null
                                },
                                actionLoading = actionInProgress
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

            if (reconnectRefreshInProgress && requests.isEmpty()) {
                ReconnectRefreshIndicator(
                    modifier = Modifier.align(Alignment.TopCenter)
                )
            }
        }

        pendingAction?.let { action ->
            ConfirmRequestActionDialog(
                action = action,
                onDismiss = { pendingAction = null },
                onConfirm = {
                    pendingAction = null
                    when (action) {
                        is PendingRequestAction.Edit -> onNavigateToRoute(Routes.requestHelpWithDraft(action.request.localId))
                        is PendingRequestAction.Cancel -> cancelCurrentRequest(action.request)
                        is PendingRequestAction.Resolve -> resolveCurrentRequest(action.request)
                    }
                }
            )
        }
    }
}

private sealed class PendingRequestAction(open val request: MyHelpRequestUiModel) {
    data class Edit(override val request: MyHelpRequestUiModel) : PendingRequestAction(request)
    data class Cancel(override val request: MyHelpRequestUiModel) : PendingRequestAction(request)
    data class Resolve(override val request: MyHelpRequestUiModel) : PendingRequestAction(request)
}

@Composable
private fun ConfirmRequestActionDialog(
    action: PendingRequestAction,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    val title = when (action) {
        is PendingRequestAction.Edit -> "Edit help request?"
        is PendingRequestAction.Cancel -> "Cancel help request?"
        is PendingRequestAction.Resolve -> "Mark request resolved?"
    }
    val text = when (action) {
        is PendingRequestAction.Edit -> "You will return to the request form and update this same request."
        is PendingRequestAction.Cancel -> "This closes the request as cancelled."
        is PendingRequestAction.Resolve -> "This closes the request as resolved."
    }
    val confirm = when (action) {
        is PendingRequestAction.Edit -> "Edit"
        is PendingRequestAction.Cancel -> "Cancel request"
        is PendingRequestAction.Resolve -> "Mark resolved"
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = title) },
        text = { Text(text = text) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(confirm)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Keep current")
            }
        }
    )
}

@Composable
private fun ReconnectRefreshIndicator(modifier: Modifier = Modifier) {
    val spacing = LocalNephSpacing.current

    SectionCard(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(spacing.sm, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(32.dp),
                    strokeWidth = 2.dp
                )
                Icon(
                    imageVector = Icons.Filled.Refresh,
                    contentDescription = "Trying to reconnect",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(18.dp)
                )
            }

            Text(
                text = "Trying to reconnect...",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun RequestsOverviewCard(
    overview: com.neph.features.myhelprequests.data.MyHelpRequestsOverviewUiModel,
    isAuthenticated: Boolean
) {
    val spacing = LocalNephSpacing.current

    SectionCard {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
            SectionHeader(
                title = "Overview",
                subtitle = if (isAuthenticated) {
                    "See your current and previous requests together."
                } else {
                    "See the requests tracked from this device together."
                }
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(spacing.sm)
            ) {
                OverviewMetric(
                    label = "Tracked",
                    value = overview.totalRequests.toString(),
                    modifier = Modifier.weight(1f)
                )
                OverviewMetric(
                    label = "Current",
                    value = if (overview.activeCount > 0) "Yes" else "No",
                    modifier = Modifier.weight(1f)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(spacing.sm)
            ) {
                OverviewMetric(
                    label = "Resolved",
                    value = overview.resolvedCount.toString(),
                    modifier = Modifier.weight(1f)
                )
                OverviewMetric(
                    label = "Cancelled",
                    value = overview.cancelledCount.toString(),
                    modifier = Modifier.weight(1f)
                )
            }

            val responderSummary = when {
                overview.activeCount > 0 && overview.assignedResponderCount > 0 -> {
                    "Your current request includes assigned responder details below."
                }

                overview.historyCount > 0 -> {
                    "${overview.historyCount} previous request${if (overview.historyCount == 1) "" else "s"} kept in history for quick context."
                }

                else -> {
                    "Open and closed requests stay grouped so the flow remains easy to scan."
                }
            }

            Text(
                text = responderSummary,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun OverviewMetric(
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    val spacing = LocalNephSpacing.current

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(spacing.xs)
    ) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
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
    onEdit: (() -> Unit)? = null,
    onCancel: (() -> Unit)? = null,
    actionLoading: Boolean = false
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
                subtitle = subtitleOverride ?: (request.createdAt?.let { "Opened: $it" }
                    ?: "Opened time unavailable")
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

            request.urgencyLabel?.let {
                Text(
                    text = "Urgency: $it",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            request.priorityLabel?.let {
                Text(
                    text = "Priority: $it",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            request.openDurationLabel?.let {
                Text(
                    text = if (request.isActive) "Open for: $it" else "Was open for: $it",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            request.closedAtLabel?.let {
                Text(
                    text = "${request.closedStateLabel ?: "Closed"}: $it",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (request.isPendingSync) {
                HelperText(text = request.pendingSyncMessage())
            }

            if (request.isFailedSync) {
                HelperText(text = request.failedSyncMessage())
                if (request.isActive) {
                    SecondaryButton(
                        text = "Retry Sync",
                        onClick = {
                            OfflineSyncScheduler.enqueueSync(context, reason = "manual-help-request-retry", replaceExisting = true)
                        }
                    )
                }
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

            if (request.isActive) {
                if (actionMessage.isNotBlank()) {
                    HelperText(text = actionMessage)
                }

                PrimaryButton(
                    text = "Edit Request",
                    onClick = onEdit ?: {},
                    enabled = onEdit != null && !actionLoading
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(spacing.sm)
                ) {
                    SecondaryButton(
                        text = "Cancel",
                        onClick = onCancel ?: {},
                        modifier = Modifier.weight(1f),
                        enabled = onCancel != null && !actionLoading
                    )

                    TextActionButton(
                        text = "Mark Resolved",
                        onClick = onResolve ?: {},
                        modifier = Modifier.weight(1f),
                        enabled = onResolve != null && !actionLoading
                    )
                }

                if (actionLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier
                            .size(18.dp)
                            .align(Alignment.CenterHorizontally),
                        strokeWidth = 2.dp
                    )
                }
            }
        }
    }
}

private fun MyHelpRequestUiModel.pendingSyncMessage(): String {
    return when (status.trim().uppercase()) {
        "CANCELLED" -> if (syncStatus == com.neph.core.sync.SyncStatus.PENDING_CREATE) {
            "Cancellation saved offline, waiting to sync."
        } else {
            "Cancellation waiting to sync."
        }
        "RESOLVED" -> if (syncStatus == com.neph.core.sync.SyncStatus.PENDING_CREATE) {
            "Resolution saved offline, waiting to sync."
        } else {
            "Resolution waiting to sync."
        }
        else -> "Saved locally. NEPH will sync this change when the network is available."
    }
}

private fun MyHelpRequestUiModel.failedSyncMessage(): String {
    return when (status.trim().uppercase()) {
        "CANCELLED" -> pendingError ?: "Cancellation could not sync yet. Pull down to reconnect when online."
        "RESOLVED" -> pendingError ?: "Resolution could not sync yet. Pull down to reconnect when online."
        else -> pendingError ?: "Sync failed. Retry when connected."
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
