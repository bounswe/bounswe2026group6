package com.neph.features.home.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.neph.core.network.ApiException
import com.neph.core.sync.SyncStatus
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.availability.data.AvailabilityAccessPolicy
import com.neph.features.availability.data.AvailabilityRepository
import com.neph.features.availability.presentation.AvailableToHelpCard
import com.neph.features.availability.presentation.AvailabilitySyncIndicator
import com.neph.features.operationallocation.data.OperationalLocationRepository
import com.neph.features.profile.data.CurrentDeviceLocation
import com.neph.features.profile.data.CurrentLocationShareWarning
import com.neph.features.profile.data.DeviceLocationProvider
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.requesthelp.data.EmergencyDraftRequirementsException
import com.neph.features.requesthelp.data.RequestHelpReverseLocation
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.features.safetycircles.presentation.CircleStatusCard
import com.neph.features.safetystatus.data.SafetyStatusRepository
import com.neph.features.safetystatus.data.SafetyStatusState
import com.neph.navigation.Routes
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.location.rememberForegroundLocationPermissionRequester
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import com.neph.ui.components.theme.ThemeIconButton
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
    val profile = ProfileRepository.getProfile()
    val profileDisplayName = remember(
        profile.firstName,
        profile.fullName,
        profileBadgeText
    ) {
        val firstName = profile.firstName?.trim()?.takeIf { it.isNotBlank() }
        val firstNameFromFullName = profile.fullName
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?.substringBefore(' ')

        when {
            !firstName.isNullOrBlank() -> firstName
            !firstNameFromFullName.isNullOrBlank() -> firstNameFromFullName
            else -> profileBadgeText
        }
    }

    val availabilityState by AvailabilityRepository.observeAvailabilityState()
        .collectAsState(initial = AvailabilityRepository.getAvailabilityState())
    val safetyStatusState by SafetyStatusRepository.observeSafetyStatusState()
        .collectAsState(initial = SafetyStatusState())
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
                if (!sessionToken.isNullOrBlank()) {
                    AvailabilityRepository.refreshAssignmentState(sessionToken)
                }
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

                OperationalLocationRepository.saveAndSyncIfAuthenticated(locationAttempt.location)
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

    fun RequestHelpReverseLocation?.hasCompleteEmergencyAdministrativeLocation(): Boolean {
        return this != null &&
            !country.isNullOrBlank() &&
            !city.isNullOrBlank() &&
            !district.isNullOrBlank() &&
            !neighborhood.isNullOrBlank()
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
                    if (!DeviceLocationProvider.hasLocationPermission(context)) {
                        requestHelpLoading = false
                        pendingLocationPermissionAction = { granted ->
                            if (granted) {
                                handleRequestHelp()
                            } else {
                                onRequestHelp(null)
                            }
                        }
                        locationPermissionRequester.requestPermission()
                        return@launch
                    }
                    val locationAttempt = DeviceLocationProvider.captureCurrentLocationForSharing(
                        context = context,
                        sharingEnabled = true
                    )
                    val currentLocation = locationAttempt.location
                    if (currentLocation != null) {
                        runCatching {
                            OperationalLocationRepository.saveAndSyncIfAuthenticated(currentLocation)
                        }
                    }
                    val reverseLocation = if (currentLocation != null) {
                        RequestHelpRepository.reverseGeocodeCurrentLocation(
                            latitude = currentLocation.latitude,
                            longitude = currentLocation.longitude
                        )
                    } else {
                        null
                    }
                    if (currentLocation != null && !reverseLocation.hasCompleteEmergencyAdministrativeLocation()) {
                        RequestHelpRepository.storePendingCoordinateSnapshot(currentLocation)
                        onRequestHelp(null)
                        return@launch
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
                if (sharedLocation != null) {
                    runCatching {
                        OperationalLocationRepository.saveAndSyncIfAuthenticated(sharedLocation)
                    }
                }
                val nextSafetyStatus = SafetyStatusRepository.markSafe(
                    token = safeSessionToken,
                    location = sharedLocation,
                    shareLocationConsent = shareLocation && sharedLocation != null
                )
                emergencyError = ""
                emergencyInfo = buildMarkSafeFeedback(
                    safetyStatus = nextSafetyStatus,
                    shareLocation = shareLocation,
                    sharedLocation = sharedLocation,
                    locationWarning = locationAttempt?.warning,
                    permissionDeniedBeforeCapture = permissionDeniedBeforeCapture
                )
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
        bottomNavItems = if (isAuthenticated) {
            Routes.authenticatedBottomNavItems
        } else {
            Routes.guestBottomNavItems
        },
        modifier = modifier,
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = if (isAuthenticated) "Profile" else "Login / Create Account",
        topBarActions = {
            ThemeIconButton()
        }
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(spacing.xl)
        ) {
            HomeGreetingHero(
                isAuthenticated = isAuthenticated,
                displayName = profileDisplayName,
                safetyStatus = safetyStatusState.status
            )

            EmergencyHelpAction(
                loading = requestHelpLoading,
                enabled = !availabilityLoading && !markSafeLoading,
                onClick = ::handleRequestHelp
            )

            MarkSafeRow(
                loading = markSafeLoading,
                enabled = !availabilityLoading && !requestHelpLoading && !markSafeLoading,
                statusMessage = buildSafetyStatusSyncMessage(safetyStatusState),
                isError = safetyStatusState.isFailedSync,
                onClick = ::requestMarkSafeConfirmation
            )

            if (!locationPermissionGranted) {
                LocationPermissionPrompt(
                    onClick = {
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
                )
            }

            if (locationPermissionInfo.isNotBlank()) {
                Text(
                    text = locationPermissionInfo,
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (isAuthenticated) {
                AvailableToHelpCard(
                    availabilityState = availabilityState,
                    loading = availabilityLoading,
                    errorMessage = availabilityError.ifBlank { availabilityState.pendingError.orEmpty() },
                    infoMessage = availabilityInfo,
                    syncMessage = when {
                        availabilityState.isPendingSync -> ""
                        availabilityState.isFailedSync -> availabilityState.pendingError.orEmpty()
                        else -> ""
                    },
                    syncIndicator = availabilitySyncIndicator,
                    onRefreshLocationAndBecomeAvailable = { handleAvailabilityChange(true) },
                    onAvailabilityChange = ::handleAvailabilityChange
                )
            }

            if (isAuthenticated) {
                CircleStatusCard(
                    onOpenSafetyCircles = { onNavigateToRoute(Routes.SafetyCircles.route) },
                    onOpenLogin = onNavigateToLogin
                )
            }

            val statusMessages = listOfNotNull(
                requestHelpError.takeIf { it.isNotBlank() }?.let { it to true },
                emergencyError.takeIf { it.isNotBlank() }?.let { it to true },
                emergencyInfo.takeIf { it.isNotBlank() }?.let { it to false }
            )
            statusMessages.forEach { (message, isError) ->
                Text(
                    text = message,
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun HomeGreetingHero(
    isAuthenticated: Boolean,
    displayName: String,
    safetyStatus: String
) {
    val spacing = LocalNephSpacing.current
    val safetyTone = when (safetyStatus.lowercase()) {
        "safe" -> Triple(MaterialTheme.colorScheme.tertiary, MaterialTheme.colorScheme.onTertiary, "You're marked safe")
        "not_safe", "needs_help" -> Triple(MaterialTheme.colorScheme.error, MaterialTheme.colorScheme.onError, "Help requested")
        else -> Triple(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant, "Status unknown")
    }
    val greetingPrimary = if (isAuthenticated) "Hello" else "Welcome"
    val greetingDetail = if (isAuthenticated) {
        if (displayName.isNotBlank()) "Glad you're here, $displayName." else "Glad you're here."
    } else {
        "Neighbors helping neighbors."
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(
                        MaterialTheme.colorScheme.primaryContainer,
                        MaterialTheme.colorScheme.surface
                    )
                ),
                shape = RoundedCornerShape(28.dp)
            )
            .padding(horizontal = spacing.xl, vertical = spacing.xl)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
            Text(
                text = greetingPrimary,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = greetingDetail,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(spacing.xs))
            Row(
                modifier = Modifier
                    .background(
                        color = safetyTone.first,
                        shape = RoundedCornerShape(50)
                    )
                    .padding(horizontal = spacing.md, vertical = spacing.xs),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(spacing.xs)
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(safetyTone.second, CircleShape)
                )
                Text(
                    text = safetyTone.third,
                    style = MaterialTheme.typography.labelMedium,
                    color = safetyTone.second,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun EmergencyHelpAction(
    loading: Boolean,
    enabled: Boolean,
    onClick: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val effectiveEnabled = enabled && !loading
    val gradient = Brush.linearGradient(
        colors = listOf(
            MaterialTheme.colorScheme.primary,
            MaterialTheme.colorScheme.secondary
        )
    )
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 96.dp)
            .background(brush = gradient, shape = RoundedCornerShape(24.dp))
            .clickable(enabled = effectiveEnabled) { onClick() }
            .padding(horizontal = spacing.xl, vertical = spacing.lg),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(spacing.lg)
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .background(
                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.20f),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
            } else {
                Icon(
                    imageVector = Icons.Filled.Warning,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = "I need help now",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onPrimary,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Tap to alert nearby neighbors and volunteers.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f)
            )
        }
    }
}

@Composable
private fun MarkSafeRow(
    loading: Boolean,
    enabled: Boolean,
    statusMessage: String,
    isError: Boolean,
    onClick: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val effectiveEnabled = enabled && !loading
    Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .border(
                    width = 1.dp,
                    color = MaterialTheme.colorScheme.outlineVariant,
                    shape = RoundedCornerShape(20.dp)
                )
                .clickable(enabled = effectiveEnabled) { onClick() }
                .padding(horizontal = spacing.lg, vertical = spacing.md),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(
                        color = MaterialTheme.colorScheme.tertiary.copy(alpha = 0.12f),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        color = MaterialTheme.colorScheme.tertiary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(
                        imageVector = Icons.Filled.CheckCircle,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.tertiary
                    )
                }
            }
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "I'm safe",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "Let your circle know you're okay.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        if (statusMessage.isNotBlank()) {
            Text(
                text = statusMessage,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = spacing.sm),
                style = MaterialTheme.typography.bodySmall,
                color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun LocationPermissionPrompt(onClick: () -> Unit) {
    val spacing = LocalNephSpacing.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = MaterialTheme.colorScheme.tertiary.copy(alpha = 0.10f),
                shape = RoundedCornerShape(20.dp)
            )
            .clickable { onClick() }
            .padding(horizontal = spacing.lg, vertical = spacing.md),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(spacing.md)
    ) {
        Icon(
            imageVector = Icons.Filled.LocationOn,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.tertiary
        )
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Enable location",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "Help us find responders nearby faster.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun buildMarkSafeFeedback(
    safetyStatus: SafetyStatusState,
    shareLocation: Boolean,
    sharedLocation: CurrentDeviceLocation?,
    locationWarning: CurrentLocationShareWarning?,
    permissionDeniedBeforeCapture: Boolean
): String {
    val locationMessage = when {
        sharedLocation != null -> "with location."
        shareLocation && (permissionDeniedBeforeCapture || locationWarning == CurrentLocationShareWarning.PERMISSION_DENIED) ->
            "without location because permission was denied."
        shareLocation -> "without location because current location was unavailable."
        else -> "without location."
    }

    return when {
        safetyStatus.isFailedSync -> "Your safe status was saved on this device $locationMessage Sync failed; try again when you have connection."
        safetyStatus.isPendingSync && safetyStatus.pendingError.requiresLoginForSync() ->
            "Your safe status was saved on this device $locationMessage It will sync after you log in again."
        safetyStatus.isPendingSync -> "Your safe status is queued $locationMessage It will sync when connection returns."
        safetyStatus.syncStatus == SyncStatus.SYNCED -> "Safe status synced $locationMessage"
        else -> "Your safe status was saved $locationMessage"
    }
}

private fun buildSafetyStatusSyncMessage(safetyStatus: SafetyStatusState): String {
    return when {
        safetyStatus.isFailedSync -> safetyStatus.pendingError
            ?.takeIf { it.isNotBlank() }
            ?.let { "Safe status sync failed: $it" }
            ?: "Safe status sync failed. Try again when you have connection."
        safetyStatus.isPendingSync && safetyStatus.pendingError.requiresLoginForSync() ->
            "Safe status saved locally. It will sync after you log in again."
        safetyStatus.isPendingSync -> "Safe status saved locally and waiting to sync."
        else -> ""
    }
}

private fun String?.requiresLoginForSync(): Boolean {
    val message = this?.lowercase().orEmpty()
    return "login" in message || "session expired" in message
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
