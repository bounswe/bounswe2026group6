package com.neph.features.assignedrequest.presentation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.features.assignedrequest.data.AssignedRequestRepository
import com.neph.features.assignedrequest.data.AssignmentRouteUiModel
import com.neph.features.assignedrequest.data.AssignedRequestUiModel
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.onboarding.data.MobileOnboardingStepId
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.map.NephMapIntegration
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme

@Composable
fun AssignedRequestScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: () -> Unit,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    onNavigateToLogin: () -> Unit,
    mobileOnboardingStepId: MobileOnboardingStepId? = null,
    onMobileOnboardingStepCompleted: (String?) -> Unit = {},
    onMobileOnboardingFeedbackChanged: (String?) -> Unit = {}
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
    var routeInfo by remember { mutableStateOf<AssignmentRouteUiModel?>(null) }
    var routeLoading by remember { mutableStateOf(false) }
    var routeMessage by remember { mutableStateOf("") }

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

    suspend fun loadRouteInfo(assignmentId: String) {
        if (token.isBlank()) {
            routeInfo = null
            routeMessage = ""
            return
        }

        routeLoading = true
        routeMessage = ""

        try {
            val result = AssignedRequestRepository.fetchAssignmentRoute(
                token = token,
                assignmentId = assignmentId
            )
            routeInfo = result
            routeMessage = if (result == null) {
                "Route is unavailable until both locations are available."
            } else {
                ""
            }
        } catch (_: Exception) {
            routeInfo = null
            routeMessage = "Route information is unavailable right now."
        } finally {
            routeLoading = false
        }
    }

    fun openAssignedRequestDirections(request: AssignedRequestUiModel) {
        val latitude = request.latitude
        val longitude = request.longitude
        if (
            latitude == null ||
            longitude == null ||
            !NephMapIntegration.isValidCoordinate(latitude = latitude, longitude = longitude)
        ) {
            infoMessage = "Directions are unavailable because this request has no usable coordinates."
            return
        }

        val opened = NephMapIntegration.openDirections(
            context = context,
            latitude = latitude,
            longitude = longitude,
            label = request.helpTypeSummary
        )
        if (!opened) {
            infoMessage = "Could not open directions for this assigned request."
        }
    }

    LaunchedEffect(currentRequest?.assignmentId, token, refreshVersion) {
        val assignmentId = currentRequest?.assignmentId
        if (assignmentId.isNullOrBlank()) {
            routeInfo = null
            routeMessage = ""
            routeLoading = false
            return@LaunchedEffect
        }

        loadRouteInfo(assignmentId)
    }

    LaunchedEffect(mobileOnboardingStepId, loading, currentRequest?.assignmentId) {
        if (mobileOnboardingStepId == MobileOnboardingStepId.ASSIGNED_REQUESTS && !loading) {
            onMobileOnboardingFeedbackChanged(
                if (currentRequest == null) {
                    "There is no assigned request for you right now."
                } else {
                    "You currently have an assigned request here."
                }
            )
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
        profileLabel = "Profile",
        mobileOnboardingStepId = mobileOnboardingStepId,
        onMobileOnboardingStepCompleted = onMobileOnboardingStepCompleted
    ) {
        when {
            loading -> {
                HelperText(text = "Loading your assigned request...")
            }

            error.isNotBlank() && currentRequest == null -> {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.lg)) {
                    SectionCard {
                        Text(
                            text = "We could not load your current assignment.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
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
                        Text(
                            text = "This page shows the request currently assigned to you.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
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

                            request.openedAtLabel?.let {
                                Text(
                                    text = "Opened: $it",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            request.openDurationLabel?.let {
                                Text(
                                    text = "Open for: $it",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

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

                            if (request.shareProfileHealthInfoWithVolunteer) {
                                request.bloodType?.let {
                                    DetailLine(label = "Blood type", value = it)
                                }

                                if (request.medicalConditions.isNotEmpty()) {
                                    DetailLine(
                                        label = "Medical conditions",
                                        value = request.medicalConditions.joinToString(", ")
                                    )
                                }

                                if (request.chronicDiseases.isNotEmpty()) {
                                    DetailLine(
                                        label = "Chronic diseases",
                                        value = request.chronicDiseases.joinToString(", ")
                                    )
                                }

                                if (request.allergies.isNotEmpty()) {
                                    DetailLine(label = "Allergies", value = request.allergies.joinToString(", "))
                                }
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

                            if (
                                request.latitude != null &&
                                request.longitude != null &&
                                NephMapIntegration.isValidCoordinate(
                                    latitude = request.latitude,
                                    longitude = request.longitude
                                )
                            ) {
                                SecondaryButton(
                                    text = "Get Directions",
                                    onClick = { openAssignedRequestDirections(request) }
                                )
                            } else {
                                HelperText(text = "Directions are unavailable because this request has no usable coordinates.")
                            }

                            when {
                                routeLoading -> {
                                    HelperText(text = "Loading route information...")
                                }

                                routeInfo != null -> {
                                    val route = routeInfo!!
                                    DetailLine(
                                        label = "Distance",
                                        value = formatRouteDistance(route.distanceKm)
                                    )
                                    route.estimatedTimeMin?.let {
                                        DetailLine(
                                            label = "Estimated travel time",
                                            value = "$it min"
                                        )
                                    }
                                    DetailLine(
                                        label = "Route source",
                                        value = formatRouteSource(route.source)
                                    )
                                }

                                routeMessage.isNotBlank() -> {
                                    HelperText(text = routeMessage)
                                }
                            }
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

private fun formatRouteDistance(distanceKm: Double): String {
    return if (distanceKm < 1.0) {
        "${(distanceKm * 1000).toInt()} m"
    } else {
        String.format(java.util.Locale.US, "%.1f km", distanceKm)
    }
}

private fun formatRouteSource(source: String): String {
    return when (source.trim().lowercase()) {
        "routing" -> "Routing provider"
        "fallback" -> "Straight-line estimate"
        else -> "Estimate"
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
