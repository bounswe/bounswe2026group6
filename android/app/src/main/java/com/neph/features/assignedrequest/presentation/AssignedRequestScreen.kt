package com.neph.features.assignedrequest.presentation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.foundation.verticalScroll
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.features.assignedrequest.data.AssignedRequestRepository
import com.neph.features.assignedrequest.data.AssignedRequestUiModel
import com.neph.features.auth.data.AuthSessionStore
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme

@Composable
fun AssignedRequestScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: () -> Unit,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    onNavigateToLogin: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val token = AuthSessionStore.getAccessToken().orEmpty()

    val currentRequest by AssignedRequestRepository.observeCurrentAssignment()
        .collectAsState(initial = null)
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var infoMessage by remember { mutableStateOf("") }
    var refreshVersion by remember { mutableStateOf(0) }
    var cancelling by remember { mutableStateOf(false) }

    DisposableEffect(lifecycleOwner, token) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME && token.isNotBlank()) {
                refreshVersion += 1
            }
        }

        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LaunchedEffect(token, refreshVersion) {
        if (token.isBlank()) {
            loading = false
            onNavigateToLogin()
            return@LaunchedEffect
        }

        error = ""
        infoMessage = ""
        OfflineSyncScheduler.enqueueSync(context, reason = "assigned-request-open", replaceExisting = true)
        loading = false
    }

    suspend fun runCancelAction(assignmentId: String) {
        error = ""
        infoMessage = ""

        try {
            AssignedRequestRepository.cancelAssignment(
                token = token,
                assignmentId = assignmentId
            )
            infoMessage = "Assignment release saved locally and queued for sync."
        } catch (_: Exception) {
            error = "Could not save the assignment update locally."
        }
    }

    AppDrawerScaffold(
        title = "Assigned Request",
        currentRoute = Routes.AssignedRequest.route,
        onNavigateToRoute = onNavigateToRoute,
        drawerItems = Routes.authenticatedDrawerItems,
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = "Profile"
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
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(spacing.lg)
                ) {
                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                            SectionHeader(
                                title = request.helpTypeSummary,
                                subtitle = request.requesterName
                                    ?: request.contactFullName
                                    ?: request.requesterEmail
                                    ?: "Requester details unavailable"
                            )

                            Text(
                                text = "Status: ${request.statusLabel}",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary
                            )

                            if (request.isPendingSync) {
                                HelperText(text = "Saved locally. Assignment changes will sync when connected.")
                            }

                            if (request.isFailedSync) {
                                HelperText(text = request.pendingError ?: "Sync failed. Retry when connected.")
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
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                            SectionHeader(
                                title = "Help Types",
                                subtitle = "Support requested by the requester."
                            )

                            Text(
                                text = request.helpTypes.joinToString(", ").ifBlank { request.helpType },
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            request.otherHelpText?.let {
                                DetailLine(label = "Other help detail", value = it)
                            }
                        }
                    }

                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                            SectionHeader(
                                title = "Situation Details",
                                subtitle = "Submitted details from the request form."
                            )

                            DetailLine(label = "Description", value = request.description)

                            request.affectedPeopleCount?.let {
                                DetailLine(label = "Affected people count", value = it.toString())
                            }

                            if (request.riskFlags.isNotEmpty()) {
                                DetailLine(label = "Risk flags", value = request.riskFlags.joinToString(", "))
                            }

                            if (request.vulnerableGroups.isNotEmpty()) {
                                DetailLine(
                                    label = "Vulnerable groups",
                                    value = request.vulnerableGroups.joinToString(", ")
                                )
                            }

                            request.bloodType?.let {
                                DetailLine(label = "Blood type", value = it)
                            }
                        }
                    }

                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                            SectionHeader(
                                title = "Location",
                                subtitle = "Location details provided in the request form."
                            )

                            DetailLine(label = "Location", value = request.locationLabel)
                        }
                    }

                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                            SectionHeader(
                                title = "Contact",
                                subtitle = "Use these details to coordinate directly with the requester."
                            )

                            request.contactFullName?.let {
                                DetailLine(label = "Full name", value = it)
                            }

                            request.contactPhone?.let {
                                DetailLine(
                                    label = "Phone",
                                    value = it,
                                    onClick = {
                                        val normalized = it.filter { char -> char.isDigit() || char == '+' }
                                        if (normalized.isNotBlank()) {
                                            context.startActivity(
                                                Intent(Intent.ACTION_DIAL, Uri.parse("tel:$normalized"))
                                            )
                                        }
                                    }
                                )
                            }

                            request.contactAlternativePhone?.let {
                                DetailLine(
                                    label = "Alternative phone",
                                    value = it,
                                    onClick = {
                                        val normalized = it.filter { char -> char.isDigit() || char == '+' }
                                        if (normalized.isNotBlank()) {
                                            context.startActivity(
                                                Intent(Intent.ACTION_DIAL, Uri.parse("tel:$normalized"))
                                            )
                                        }
                                    }
                                )
                            }

                            request.requesterEmail?.let {
                                DetailLine(label = "Email", value = it)
                            }
                        }
                    }

                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                            SectionHeader(
                                title = "Actions",
                                subtitle = "Release this assignment if you cannot continue."
                            )

                            if (error.isNotBlank()) {
                                HelperText(text = error)
                            }

                            if (infoMessage.isNotBlank()) {
                                HelperText(text = infoMessage)
                            }

                            SecondaryButton(
                                text = "Release Assignment",
                                onClick = {
                                    cancelling = true
                                },
                                enabled = !cancelling
                            )
                        }
                    }
                }

                if (cancelling) {
                    LaunchedEffect(request.assignmentId, cancelling) {
                        runCancelAction(request.assignmentId)
                        cancelling = false
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailLine(label: String, value: String, onClick: (() -> Unit)? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(LocalNephSpacing.current.xs)) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = if (onClick != null) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
            modifier = Modifier
                .then(
                    if (onClick != null) {
                        Modifier.clickable { onClick() }
                    } else {
                        Modifier
                    }
                )
        )
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun AssignedRequestScreenPreview() {
    NephTheme {
        AssignedRequestScreen(
            onNavigateToRoute = {},
            onOpenSettings = {},
            onProfileClick = {},
            profileBadgeText = "PP",
            onNavigateToLogin = {}
        )
    }
}
