package com.neph.features.assignedrequest.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
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
import com.neph.features.assignedrequest.data.AssignedRequestRepository
import com.neph.features.assignedrequest.data.AssignedRequestUiModel
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.availability.data.AvailabilityRepository
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

@Composable
fun AssignedRequestScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: () -> Unit,
    onNavigateToLogin: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val token = AuthSessionStore.getAccessToken().orEmpty()

    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var infoMessage by remember { mutableStateOf("") }
    var currentRequest by remember { mutableStateOf<AssignedRequestUiModel?>(null) }
    var refreshVersion by remember { mutableStateOf(0) }
    var resolving by remember { mutableStateOf(false) }
    var cancelling by remember { mutableStateOf(false) }

    fun startLoading() {
        loading = true
        error = ""
        infoMessage = ""
    }

    LaunchedEffect(token, refreshVersion) {
        if (token.isBlank()) {
            loading = false
            onNavigateToLogin()
            return@LaunchedEffect
        }

        startLoading()

        try {
            currentRequest = AssignedRequestRepository.fetchCurrentAssignment(token)
            AvailabilityRepository.refreshAssignmentState(token)
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (errorResponse: ApiException) {
            when (errorResponse.status) {
                401 -> {
                    AuthRepository.logout()
                    onNavigateToLogin()
                    return@LaunchedEffect
                }
                else -> {
                    error = errorResponse.message.ifBlank {
                        "Could not load your assigned request."
                    }
                }
            }
        } catch (_: Exception) {
            error = "Something went wrong while loading your assigned request."
        } finally {
            loading = false
        }
    }

    suspend fun runAssignmentAction(action: suspend () -> AssignedRequestUiModel?, successMessage: String) {
        error = ""
        infoMessage = ""

        try {
            val nextAssignment = action()
            currentRequest = nextAssignment
            AvailabilityRepository.setAvailabilityStateForUi(
                AvailabilityRepository.getAvailabilityState().copy(
                    assignmentId = nextAssignment?.assignmentId
                )
            )
            infoMessage = successMessage
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (errorResponse: ApiException) {
            if (errorResponse.status == 401) {
                AuthRepository.logout()
                onNavigateToLogin()
            } else {
                error = errorResponse.message.ifBlank { "Could not update this assignment." }
            }
        } catch (_: Exception) {
            error = "Something went wrong while updating this assignment."
        }
    }

    AppDrawerScaffold(
        title = "Assigned Request",
        currentRoute = Routes.AssignedRequest.route,
        onNavigateToRoute = onNavigateToRoute,
        onOpenSettings = onOpenSettings
    ) {
        when {
            loading -> {
                HelperText(text = "Loading your assigned request...")
            }

            error.isNotBlank() && currentRequest == null -> {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.lg)) {
                    SectionCard {
                        SectionHeader(
                            title = "Assigned Request",
                            subtitle = "We could not load your current assignment."
                        )

                        HelperText(text = error)

                        SecondaryButton(
                            text = "Retry",
                            onClick = {
                                refreshVersion += 1
                            }
                        )
                    }
                }
            }

            currentRequest == null -> {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.lg)) {
                    SectionCard {
                        SectionHeader(
                            title = "Assigned Request",
                            subtitle = "This page shows the request currently assigned to you."
                        )

                        Text(
                            text = "No assigned request right now.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        if (infoMessage.isNotBlank()) {
                            HelperText(text = infoMessage)
                        }
                    }
                }
            }

            else -> {
                val request = currentRequest!!

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(spacing.lg)
                ) {
                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                            SectionHeader(
                                title = request.helpType,
                                subtitle = request.requesterName
                                    ?: request.requesterEmail
                                    ?: "Requester details unavailable"
                            )

                            Text(
                                text = request.shortDescription,
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

                            request.requesterEmail?.let {
                                Text(
                                    text = "Requester email: $it",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            request.assignedAt?.let {
                                Text(
                                    text = "Assigned: $it",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }

                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                            SectionHeader(
                                title = "Actions",
                                subtitle = "Update the assignment when your work is complete or if you need to release it."
                            )

                            if (error.isNotBlank()) {
                                HelperText(text = error)
                            }

                            if (infoMessage.isNotBlank()) {
                                HelperText(text = infoMessage)
                            }

                            PrimaryButton(
                                text = if (resolving) "Resolving..." else "Mark As Resolved",
                                onClick = {
                                    resolving = true
                                },
                                loading = resolving,
                                enabled = !cancelling
                            )

                            SecondaryButton(
                                text = "Release Assignment",
                                onClick = {
                                    cancelling = true
                                },
                                enabled = !resolving && !cancelling
                            )
                        }
                    }
                }

                if (resolving) {
                    LaunchedEffect(request.assignmentId, resolving) {
                        runAssignmentAction(
                            action = {
                                AssignedRequestRepository.resolveAssignment(
                                    token = token,
                                    requestId = request.requestId
                                )
                            },
                            successMessage = "Assignment updated successfully."
                        )
                        resolving = false
                    }
                }

                if (cancelling) {
                    LaunchedEffect(request.assignmentId, cancelling) {
                        runAssignmentAction(
                            action = {
                                AssignedRequestRepository.cancelAssignment(
                                    token = token,
                                    assignmentId = request.assignmentId
                                )
                            },
                            successMessage = "Assignment released successfully."
                        )
                        cancelling = false
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun AssignedRequestScreenPreview() {
    NephTheme {
        AssignedRequestScreen(
            onNavigateToRoute = {},
            onOpenSettings = {},
            onNavigateToLogin = {}
        )
    }
}
