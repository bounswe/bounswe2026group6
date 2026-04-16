package com.neph.features.home.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
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

    val availabilityState by AvailabilityRepository.observeAvailabilityState()
        .collectAsState(initial = AvailabilityRepository.getAvailabilityState())
    var availabilityLoading by remember { mutableStateOf(false) }
    var availabilityError by remember { mutableStateOf("") }
    var availabilityInfo by remember { mutableStateOf("") }
    var requestHelpLoading by remember { mutableStateOf(false) }
    var requestHelpError by remember { mutableStateOf("") }

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

        availabilityLoading = true

        scope.launch {
            try {
                val recordedState = AvailabilityRepository.setAvailability(
                    isAvailable = nextValue,
                    token = sessionToken
                )
                availabilityInfo = if (recordedState.isAvailable) {
                    "Availability saved locally and will sync when connected."
                } else {
                    "Unavailable status saved locally and will sync when connected."
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                availabilityError = "Could not save your availability locally. Please try again."
            } finally {
                availabilityLoading = false
            }
        }
    }

    fun handleRequestHelp() {
        availabilityError = ""
        availabilityInfo = ""
        requestHelpError = ""

        if (!isAuthenticated || sessionToken.isNullOrBlank()) {
            onRequestHelp()
            return
        }

        scope.launch {
            requestHelpLoading = true
            try {
                val hasActiveRequest = RequestHelpRepository.hasActiveHelpRequest(sessionToken)
                if (hasActiveRequest) {
                    onOpenMyHelpRequests()
                } else {
                    onRequestHelp()
                }
            } catch (_: Exception) {
                requestHelpError = "We could not verify your current help request status. Please try again."
            } finally {
                requestHelpLoading = false
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
                    errorMessage = availabilityError.ifBlank { availabilityState.pendingError.orEmpty() },
                    infoMessage = availabilityInfo,
                    syncMessage = when {
                        availabilityState.isPendingSync -> "Pending sync — your latest availability is saved on this device."
                        availabilityState.isFailedSync -> "Sync failed — use Retry from a connected network."
                        else -> ""
                    },
                    onAvailabilityChange = ::handleAvailabilityChange
                )
            }

            PrimaryButton(
                text = "Request Help",
                onClick = ::handleRequestHelp,
                loading = requestHelpLoading,
                enabled = !availabilityLoading
            )

            if (requestHelpError.isNotBlank()) {
                Text(
                    text = requestHelpError,
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center
                )
            }

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
