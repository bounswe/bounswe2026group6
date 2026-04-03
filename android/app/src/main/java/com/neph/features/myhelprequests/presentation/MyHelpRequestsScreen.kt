package com.neph.features.myhelprequests.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
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
    isAuthenticated: Boolean
) {
    val spacing = LocalNephSpacing.current
    val token = AuthSessionStore.getAccessToken().orEmpty()
    val scope = rememberCoroutineScope()

    var loading by remember { mutableStateOf(isAuthenticated) }
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
        onOpenSettings = onOpenSettings
    ) {
        LaunchedEffect(isAuthenticated, token, refreshVersion) {
            if (!isAuthenticated || token.isBlank()) {
                loading = false
                error = ""
                requests = emptyList()
                return@LaunchedEffect
            }

            loading = true
            error = ""

            try {
                requests = MyHelpRequestsRepository.fetchMyHelpRequests(token)
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (errorResponse: ApiException) {
                if (errorResponse.status == 401) {
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
            !isAuthenticated -> {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.lg)) {
                    SectionCard {
                        SectionHeader(
                            title = "My Help Requests",
                            subtitle = "This page shows the requests created from your account."
                        )

                        Text(
                            text = "Login to view your help requests.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            loading -> {
                HelperText(text = "Loading your help requests...")
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
                Column(verticalArrangement = Arrangement.spacedBy(spacing.lg)) {
                    SectionCard {
                        SectionHeader(
                            title = "My Help Requests",
                            subtitle = "Track the current request created from your account."
                        )

                        Text(
                            text = "No active or past help requests were found for your account.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            else -> {
                val activeRequest = requests.firstOrNull { it.isActive }
                val requestHistory = requests.filterNot { it.isActive }

                LazyColumn(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(spacing.lg)
                ) {
                    item {
                        SectionHeader(
                            title = "Current Request",
                            subtitle = "Your latest active help request is shown first."
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
                                onResolve = {
                                    if (token.isBlank()) return@MyHelpRequestCard

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
                                },
                                resolveLoading = actionInProgressRequestId == activeRequest.id
                            )
                        }
                    }

                    if (requestHistory.isNotEmpty()) {
                        item {
                            SectionHeader(
                                title = "Request History",
                                subtitle = "Previous requests from your account."
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
private fun MyHelpRequestCard(
    request: MyHelpRequestUiModel,
    titleOverride: String? = null,
    subtitleOverride: String? = null,
    actionMessage: String = "",
    onResolve: (() -> Unit)? = null,
    resolveLoading: Boolean = false
) {
    val spacing = LocalNephSpacing.current

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

            if (request.helpTypes.size > 1) {
                Text(
                    text = "Help Types: ${request.helpTypes.joinToString(", ")}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            request.contactName?.let {
                Text(
                    text = "Contact: $it",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            request.contactPhone?.let {
                Text(
                    text = "Phone: $it",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            request.alternativePhone?.let {
                Text(
                    text = "Alternative phone: $it",
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
            isAuthenticated = true
        )
    }
}
