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

    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var requests by remember { mutableStateOf<List<MyHelpRequestUiModel>>(emptyList()) }
    var refreshVersion by remember { mutableStateOf(0) }
    var actionInProgressRequestId by remember { mutableStateOf<String?>(null) }
    var actionMessage by remember { mutableStateOf("") }

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
        LaunchedEffect(isAuthenticated, token, refreshVersion) {
            loading = true
            error = ""

            try {
                requests = if (!isAuthenticated || token.isBlank()) {
                    MyHelpRequestsRepository.fetchGuestHelpRequests()
                } else {
                    MyHelpRequestsRepository.fetchMyHelpRequests(token)
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (errorResponse: ApiException) {
                if (errorResponse.status == 401 && isAuthenticated) {
                    AuthRepository.logout()
                    requests = emptyList()
                    error = "Your session expired. Please log in again to view your help requests."
                } else {
                    error = errorResponse.message.ifBlank { "Could not load your help requests." }
                }
            } catch (_: Exception) {
                error = "Something went wrong while loading your help requests."
            } finally {
                loading = false
            }
        }

        when {
            loading -> {
                LoadingStateView()
            }

            error.isNotBlank() -> {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.lg)) {
                    SectionCard {
                        SectionHeader(
                            title = "My Help Requests",
                            subtitle = "We could not load your request history."
                        )

                        HelperText(text = error)

                        SecondaryButton(
                            text = "Retry",
                            onClick = { refreshVersion += 1 }
                        )
                    }
                }
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
                                                val updatedRequest = MyHelpRequestsRepository.markRequestAsResolved(
                                                    token = token,
                                                    requestId = activeRequest.id
                                                )
                                                requests = buildList {
                                                    for (request in requests) {
                                                        if (request.id == activeRequest.id && updatedRequest != null) {
                                                            add(updatedRequest)
                                                        } else {
                                                            add(request)
                                                        }
                                                    }
                                                }
                                                actionMessage = "Your help request was marked as resolved."
                                            } catch (cancellationException: CancellationException) {
                                                throw cancellationException
                                            } catch (errorResponse: ApiException) {
                                                if (errorResponse.status == 401) {
                                                    AuthRepository.logout()
                                                    error = "Your session expired. Please log in again to manage your request."
                                                } else {
                                                    actionMessage = errorResponse.message.ifBlank {
                                                        "Could not update your help request."
                                                    }
                                                }
                                            } catch (_: Exception) {
                                                actionMessage = "Something went wrong while updating your help request."
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
                                                val updatedRequest = MyHelpRequestsRepository.markGuestRequestAsResolved(
                                                    requestId = activeRequest.id,
                                                    guestAccessToken = activeRequest.guestAccessToken
                                                )
                                                requests = buildList {
                                                    for (request in requests) {
                                                        if (request.id == activeRequest.id && updatedRequest != null) {
                                                            add(updatedRequest)
                                                        } else {
                                                            add(request)
                                                        }
                                                    }
                                                }
                                                actionMessage = "Your help request was marked as resolved."
                                            } catch (cancellationException: CancellationException) {
                                                throw cancellationException
                                            } catch (errorResponse: ApiException) {
                                                actionMessage = errorResponse.message.ifBlank {
                                                    "Could not update your help request."
                                                }
                                            } catch (_: Exception) {
                                                actionMessage = "Something went wrong while updating your help request."
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

            if (
                request.helperFullName != null ||
                request.helperPhone != null ||
                request.helperProfession != null ||
                request.helperExpertise != null
            ) {
                SectionHeader(
                    title = "Assigned Helper Details",
                    subtitle = "Name, phone, profession, and expertise of your assigned helper."
                )

                request.helperFullName?.let {
                    Text(
                        text = "Name: $it",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                request.helperPhone?.let {
                    Text(
                        text = "Phone: $it",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable { openDialer(it) }
                    )
                }

                request.helperProfession?.let {
                    Text(
                        text = "Profession: $it",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                request.helperExpertise?.let {
                    Text(
                        text = "Expertise: $it",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
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
