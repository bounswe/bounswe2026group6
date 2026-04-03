package com.neph.features.home.presentation

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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.neph.core.network.ApiException
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.availability.data.AvailabilityAccessPolicy
import com.neph.features.availability.data.AvailabilityRepository
import com.neph.features.availability.presentation.AvailableToHelpCard
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(
    onRequestHelp: () -> Unit,
    onOpenAssignedRequest: () -> Unit,
    onOpenMyHelpRequests: () -> Unit,
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: (() -> Unit)?,
    onNavigateToLogin: () -> Unit,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    isAuthenticated: Boolean,
    modifier: Modifier = Modifier
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()
    val sessionToken = AuthSessionStore.getAccessToken()

    var availabilityState by remember {
        mutableStateOf(AvailabilityRepository.getAvailabilityState())
    }
    var availabilityLoading by remember { mutableStateOf(false) }
    var availabilityError by remember { mutableStateOf("") }
    var availabilityInfo by remember { mutableStateOf("") }

    LaunchedEffect(isAuthenticated, sessionToken) {
        if (!isAuthenticated || sessionToken.isNullOrBlank()) {
            return@LaunchedEffect
        }

        try {
            availabilityState = AvailabilityRepository.refreshAssignmentState(sessionToken)
        } catch (_: Exception) {
            // Keep the cached state if the refresh attempt fails.
        }
    }

    fun handleAvailabilityChange(nextValue: Boolean) {
        availabilityError = ""
        availabilityInfo = ""

        if (!AvailabilityAccessPolicy.canAccess(sessionToken)) {
            availabilityError = "Please log in to manage your availability."
            if (AvailabilityAccessPolicy.shouldRedirectToLogin()) {
                onNavigateToLogin()
            }
            return
        }

        val previousState = availabilityState
        availabilityState = previousState.copy(isAvailable = nextValue)
        availabilityLoading = true

        scope.launch {
            try {
                availabilityState = AvailabilityRepository.setAvailability(
                    isAvailable = nextValue,
                    token = sessionToken
                )
                availabilityInfo = if (availabilityState.isAvailable) {
                    if (availabilityState.assignmentId != null) {
                        onOpenAssignedRequest()
                        "You are now available to help. A request has been assigned to you."
                    } else {
                        "You are now available to help."
                    }
                } else {
                    "You are no longer available."
                }
            } catch (cancellationException: CancellationException) {
                availabilityState = previousState
                throw cancellationException
            } catch (error: ApiException) {
                availabilityState = previousState
                availabilityError = when {
                    error.status == 401 && !sessionToken.isNullOrBlank() && AvailabilityAccessPolicy.shouldRedirectToLogin() -> {
                        onNavigateToLogin()
                        "Your session expired. Please log in again."
                    }
                    error.status == 401 -> {
                        "The backend currently requires login to update availability."
                    }
                    else -> error.message.ifBlank { "Could not update your availability." }
                }
            } catch (_: Exception) {
                availabilityState = previousState
                availabilityError = "Something went wrong while updating your availability."
            } finally {
                availabilityLoading = false
            }
        }
    }

    fun handleRequestHelp() {
        availabilityError = ""
        availabilityInfo = ""

        if (!isAuthenticated || sessionToken.isNullOrBlank()) {
            onRequestHelp()
            return
        }

        scope.launch {
            try {
                val hasActiveRequest = RequestHelpRepository.hasActiveHelpRequest(sessionToken)
                if (hasActiveRequest) {
                    onOpenMyHelpRequests()
                } else {
                    onRequestHelp()
                }
            } catch (_: Exception) {
                onRequestHelp()
            }
        }
    }

    AppDrawerScaffold(
        title = "NEPH",
        currentRoute = Routes.Home.route,
        onNavigateToRoute = onNavigateToRoute,
        drawerItems = if (isAuthenticated) {
            Routes.authenticatedDrawerItems
        } else {
            Routes.guestDrawerItems
        },
        modifier = modifier,
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = if (isAuthenticated) "Profile" else "Login / Create Account",
        contentMaxWidth = 360.dp,
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            if (isAuthenticated) {
                AvailableToHelpCard(
                    isAvailable = availabilityState.isAvailable,
                    loading = availabilityLoading,
                    errorMessage = availabilityError,
                    infoMessage = availabilityInfo,
                    onAvailabilityChange = ::handleAvailabilityChange
                )
            }

            PrimaryButton(
                text = "Request Help",
                onClick = ::handleRequestHelp
            )

            Text(
                text = "Create an emergency help request and share your situation.",
                modifier = Modifier.fillMaxWidth(),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun HomeScreenPreview() {
    NephTheme {
        HomeScreen(
            onRequestHelp = {},
            onOpenAssignedRequest = {},
            onOpenMyHelpRequests = {},
            onNavigateToRoute = {},
            onOpenSettings = {},
            onNavigateToLogin = {},
            onProfileClick = {},
            profileBadgeText = "PP",
            isAuthenticated = true
        )
    }
}
