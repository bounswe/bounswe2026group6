package com.neph.features.home.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.neph.core.network.ApiException
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.availability.data.AvailabilityAccessPolicy
import com.neph.features.availability.data.AvailabilityRepository
import com.neph.features.availability.presentation.AvailableToHelpCard
import com.neph.features.availability.presentation.AvailabilitySyncIndicator
import com.neph.features.profile.data.CurrentDeviceLocation
import com.neph.features.profile.data.CurrentLocationShareWarning
import com.neph.features.profile.data.DeviceLocationProvider
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.requesthelp.data.EmergencyDraftRequirementsException
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.features.safetystatus.data.SafetyStatusRepository
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.location.rememberForegroundLocationPermissionRequester
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(
    onRequestHelp: (String?) -> Unit,
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
    val context = LocalContext.current
    val sessionToken = AuthSessionStore.getAccessToken()

    val availabilityState by AvailabilityRepository.observeAvailabilityState()
        .collectAsState(initial = AvailabilityRepository.getAvailabilityState())
    var availabilityLoading by remember { mutableStateOf(false) }
    var availabilityError by remember { mutableStateOf("") }
    var availabilityInfo by remember { mutableStateOf("") }
    var availabilitySyncIndicator by remember { mutableStateOf(AvailabilitySyncIndicator.NONE) }
    var requestHelpLoading by remember { mutableStateOf(false) }
    var requestHelpError by remember { mutableStateOf("") }
    var markSafeLoading by remember { mutableStateOf(false) }
    var showMarkSafeLocationConsentDialog by remember { mutableStateOf(false) }
    var emergencyInfo by remember { mutableStateOf("") }
    var emergencyError by remember { mutableStateOf("") }
    var locationPermissionInfo by remember { mutableStateOf("") }
    var locationPermissionGranted by remember {
        mutableStateOf(DeviceLocationProvider.hasLocationPermission(context))
    }
    var pendingLocationPermissionAction by remember { mutableStateOf<((Boolean) -> Unit)?>(null) }

    val locationPermissionRequester = rememberForegroundLocationPermissionRequester { result ->
        locationPermissionGranted = result.granted
        val action = pendingLocationPermissionAction
        pendingLocationPermissionAction = null
        action?.invoke(result.granted)
    }

    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner, context) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                locationPermissionGranted = DeviceLocationProvider.hasLocationPermission(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    fun syncAvailabilityChange(
        nextValue: Boolean,
        currentDeviceLocation: CurrentDeviceLocation? = null
    ) {
        availabilityError = ""
        availabilityInfo = ""
        availabilitySyncIndicator = AvailabilitySyncIndicator.NONE

        if (!AvailabilityAccessPolicy.canAccess(sessionToken)) {
            availabilityError = "Please log in to manage your availability."
            availabilitySyncIndicator = AvailabilitySyncIndicator.FAILED
            if (AvailabilityAccessPolicy.shouldRedirectToLogin()) {
                onNavigateToLogin()
            }
            return
        }

        availabilityLoading = true

        scope.launch {
            val previousState = availabilityState
            try {
                availabilitySyncIndicator = AvailabilitySyncIndicator.SYNCING
                AvailabilityRepository.setAvailability(
                    isAvailable = nextValue,
                    token = sessionToken,
                    currentDeviceLocation = currentDeviceLocation
                )
                AvailabilityRepository.syncPendingAvailabilityNow(sessionToken)
                availabilitySyncIndicator = AvailabilitySyncIndicator.SYNCED
                delay(1400)
                availabilitySyncIndicator = AvailabilitySyncIndicator.NONE
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (error: ApiException) {
                if (error.status == 401) {
                    AuthRepository.logout()
                    availabilityError = "Session expired. Please log in again."
                    onNavigateToLogin()
                } else {
                    availabilityError = "Could not sync. Check internet."
                    AvailabilityRepository.rollbackAvailabilityAfterFailedSync(previousState, availabilityError)
                }
                availabilitySyncIndicator = AvailabilitySyncIndicator.FAILED
            } catch (_: Exception) {
                availabilityError = "Could not sync. Check internet."
                AvailabilityRepository.rollbackAvailabilityAfterFailedSync(previousState, availabilityError)
                availabilitySyncIndicator = AvailabilitySyncIndicator.FAILED
            } finally {
                availabilityLoading = false
            }
        }
    }

    fun enableAvailabilityWithCurrentLocation() {
        availabilityError = ""
        availabilityInfo = ""
        availabilitySyncIndicator = AvailabilitySyncIndicator.NONE
        availabilityLoading = true

        scope.launch {
            try {
                val locationAttempt = DeviceLocationProvider.captureCurrentLocationForSharing(
                    context = context,
                    sharingEnabled = true
                )
                if (locationAttempt.location == null) {
                    availabilityError = when (locationAttempt.warning) {
                        CurrentLocationShareWarning.PERMISSION_DENIED ->
                            "Location permission is required before you can become available to help."

                        CurrentLocationShareWarning.LOCATION_UNAVAILABLE,
                        null -> "Current location is unavailable. Availability was not enabled."
                    }
                    availabilitySyncIndicator = AvailabilitySyncIndicator.FAILED
                    availabilityLoading = false
                    return@launch
                }

                availabilityLoading = false
                syncAvailabilityChange(
                    nextValue = true,
                    currentDeviceLocation = locationAttempt.location
                )
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                availabilityError = "Current location is unavailable. Availability was not enabled."
                availabilitySyncIndicator = AvailabilitySyncIndicator.FAILED
                availabilityLoading = false
            }
        }
    }

    fun handleAvailabilityChange(nextValue: Boolean) {
        if (!nextValue) {
            syncAvailabilityChange(false)
            return
        }

        availabilityError = ""
        availabilityInfo = ""
        availabilitySyncIndicator = AvailabilitySyncIndicator.NONE

        if (!AvailabilityAccessPolicy.canAccess(sessionToken)) {
            availabilityError = "Please log in to manage your availability."
            availabilitySyncIndicator = AvailabilitySyncIndicator.FAILED
            if (AvailabilityAccessPolicy.shouldRedirectToLogin()) {
                onNavigateToLogin()
            }
            return
        }

        pendingLocationPermissionAction = { granted ->
            if (granted) {
                enableAvailabilityWithCurrentLocation()
            } else {
                availabilityError = "Location permission is required before you can become available to help."
                availabilitySyncIndicator = AvailabilitySyncIndicator.FAILED
            }
        }

        if (locationPermissionRequester.refreshPermissionState()) {
            val action = pendingLocationPermissionAction
            pendingLocationPermissionAction = null
            action?.invoke(true)
        } else {
            locationPermissionRequester.requestPermission()
        }
    }

    fun handleRequestHelp() {
        availabilityError = ""
        availabilityInfo = ""
        requestHelpError = ""
        emergencyError = ""
        emergencyInfo = ""

        scope.launch {
            requestHelpLoading = true
            try {
                val hasActiveRequest = try {
                    if (!sessionToken.isNullOrBlank()) {
                        RequestHelpRepository.hasActiveHelpRequest(sessionToken)
                    } else {
                        false
                    }
                } catch (error: ApiException) {
                    if (error.status == 401) throw error else false
                } catch (_: Exception) {
                    false
                }
                if (hasActiveRequest) {
                    onOpenMyHelpRequests()
                } else if (!isAuthenticated || sessionToken.isNullOrBlank()) {
                    onRequestHelp(null)
                } else {
                    val locationAttempt = DeviceLocationProvider.captureCurrentLocationForSharing(
                        context = context,
                        sharingEnabled = true
                    )
                    val currentLocation = locationAttempt.location
                    val reverseLocation = if (currentLocation != null) {
                        RequestHelpRepository.reverseGeocodeCurrentLocation(
                            latitude = currentLocation.latitude,
                            longitude = currentLocation.longitude
                        )
                    } else {
                        null
                    }
                    val draft = RequestHelpRepository.createEmergencyDraft(
                        token = sessionToken,
                        profile = ProfileRepository.getProfile(),
                        currentLocation = currentLocation,
                        reverseLocation = reverseLocation
                    )
                    onRequestHelp(draft.requestId)
                }
            } catch (error: ApiException) {
                if (error.status == 401) {
                    AuthRepository.logout()
                    requestHelpError = "Your session expired. Please log in again before requesting help."
                    onNavigateToLogin()
                } else {
                    requestHelpError = "We could not verify your current help request status. Please try again."
                }
            } catch (_: EmergencyDraftRequirementsException) {
                onRequestHelp(null)
            } catch (_: Exception) {
                requestHelpError = "We could not verify your current help request status. Please try again."
            } finally {
                requestHelpLoading = false
            }
        }
    }

    fun requestMarkSafeConfirmation() {
        availabilityError = ""
        availabilityInfo = ""
        requestHelpError = ""
        emergencyError = ""
        emergencyInfo = ""

        if (!isAuthenticated || sessionToken.isNullOrBlank()) {
            emergencyError = "Please log in before marking yourself safe."
            onNavigateToLogin()
            return
        }

        showMarkSafeLocationConsentDialog = true
    }

    fun handleMarkSafeWithOptionalLocation(
        shareLocation: Boolean,
        permissionDeniedBeforeCapture: Boolean = false
    ) {
        val safeSessionToken = sessionToken
        if (!isAuthenticated || safeSessionToken.isNullOrBlank()) {
            showMarkSafeLocationConsentDialog = false
            emergencyError = "Please log in before marking yourself safe."
            onNavigateToLogin()
            return
        }

        showMarkSafeLocationConsentDialog = false
        markSafeLoading = true
        scope.launch {
            try {
                val locationAttempt = if (shareLocation && !permissionDeniedBeforeCapture) {
                    DeviceLocationProvider.captureCurrentLocationForSharing(
                        context = context,
                        sharingEnabled = true
                    )
                } else {
                    null
                }
                val sharedLocation = locationAttempt?.location
                SafetyStatusRepository.markSafe(
                    token = safeSessionToken,
                    location = sharedLocation,
                    shareLocationConsent = shareLocation && sharedLocation != null
                )
                emergencyInfo = if (sharedLocation != null) {
                    "You are marked safe. Your current location was shared with your safety status."
                } else if (shareLocation && permissionDeniedBeforeCapture) {
                    "You are marked safe. Location was not shared because permission was denied."
                } else if (shareLocation && locationAttempt?.warning == CurrentLocationShareWarning.PERMISSION_DENIED) {
                    "You are marked safe. Location was not shared because permission was denied."
                } else if (shareLocation) {
                    "You are marked safe. Location was not shared because current location was unavailable."
                } else {
                    "You are marked safe. Your location was not shared."
                }
            } catch (error: ApiException) {
                if (error.status == 401) {
                    AuthRepository.logout()
                    emergencyError = "Your session expired. Please log in again before marking yourself safe."
                    onNavigateToLogin()
                } else {
                    emergencyError = error.message.ifBlank { "Could not mark you safe. Please try again." }
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                emergencyError = "Could not mark you safe. Please try again."
            } finally {
                markSafeLoading = false
            }
        }
    }

    fun handleMarkSafe(shareLocation: Boolean) {
        if (!shareLocation) {
            handleMarkSafeWithOptionalLocation(shareLocation = false)
            return
        }

        pendingLocationPermissionAction = { granted ->
            handleMarkSafeWithOptionalLocation(
                shareLocation = true,
                permissionDeniedBeforeCapture = !granted
            )
        }

        if (locationPermissionRequester.refreshPermissionState()) {
            val action = pendingLocationPermissionAction
            pendingLocationPermissionAction = null
            action?.invoke(true)
        } else {
            locationPermissionRequester.requestPermission()
        }
    }

    if (showMarkSafeLocationConsentDialog) {
        AlertDialog(
            onDismissRequest = { showMarkSafeLocationConsentDialog = false },
            title = {
                Text(text = "Share location with your safe status?")
            },
            text = {
                Text(
                    text = "Marking yourself safe does not need your location. Share it only if you want people allowed by your privacy settings, and admins, to see where this safety update came from."
                )
            },
            confirmButton = {
                TextButton(onClick = { handleMarkSafe(shareLocation = true) }) {
                    Text("Share location")
                }
            },
            dismissButton = {
                TextButton(onClick = { handleMarkSafe(shareLocation = false) }) {
                    Text("Mark safe without location")
                }
            }
        )
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
            if (!locationPermissionGranted) {
                SectionCard(
                    modifier = Modifier.clickable {
                        pendingLocationPermissionAction = { granted ->
                            locationPermissionGranted = granted
                            locationPermissionInfo = if (granted) {
                                ""
                            } else {
                                "Location permission was not enabled. You can still use NEPH with manual location entry."
                            }
                        }
                        locationPermissionRequester.requestPermission()
                    }
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                        SectionHeader(
                            title = "Enable location for faster emergency actions",
                            subtitle = "Allow NEPH to use your location while the app is open so Request Help and volunteer matching can work faster."
                        )
                    }
                }
            }

            if (locationPermissionInfo.isNotBlank()) {
                Text(
                    text = locationPermissionInfo,
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }

            if (isAuthenticated) {
                AvailableToHelpCard(
                    isAvailable = availabilityState.isAvailable,
                    loading = availabilityLoading,
                    errorMessage = availabilityError.ifBlank { availabilityState.pendingError.orEmpty() },
                    infoMessage = availabilityInfo,
                    syncMessage = when {
                        availabilityState.isPendingSync -> ""
                        availabilityState.isFailedSync -> availabilityState.pendingError.orEmpty()
                        else -> ""
                    },
                    syncIndicator = availabilitySyncIndicator,
                    onAvailabilityChange = ::handleAvailabilityChange
                )
            }

            SectionCard {
                Column(
                    verticalArrangement = Arrangement.spacedBy(spacing.sm)
                ) {
                    SectionHeader(
                        title = "Emergency Mode",
                        subtitle = "Choose the critical action first."
                    )

                    PrimaryButton(
                        text = "I need help",
                        onClick = ::handleRequestHelp,
                        modifier = Modifier.heightIn(min = 72.dp),
                        loading = requestHelpLoading,
                        enabled = !availabilityLoading && !markSafeLoading
                    )

                    SecondaryButton(
                        text = "I am safe",
                        onClick = ::requestMarkSafeConfirmation,
                        enabled = !availabilityLoading && !requestHelpLoading && !markSafeLoading
                    )

                    if (markSafeLoading) {
                        Text(
                            text = "Saving your safety status...",
                            modifier = Modifier.fillMaxWidth(),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }

            if (requestHelpError.isNotBlank()) {
                Text(
                    text = requestHelpError,
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center
                )
            }

            if (emergencyError.isNotBlank()) {
                Text(
                    text = emergencyError,
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center
                )
            }

            if (emergencyInfo.isNotBlank()) {
                Text(
                    text = emergencyInfo,
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = TextAlign.Center
                )
            }

            Text(
                text = "Use Emergency Mode to request help or check in safe from your phone.",
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
