package com.neph.features.helprequestmap.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.neph.core.network.ApiException
import com.neph.features.helprequestmap.data.ActiveHelpRequestMapItem
import com.neph.features.helprequestmap.data.ActiveHelpRequestsResult
import com.neph.features.helprequestmap.data.ActiveHelpRequestsRepository
import com.neph.features.helprequestmap.data.CrisisRequestType
import com.neph.features.onboarding.data.MobileOnboardingStepId
import com.neph.features.profile.data.CurrentDeviceLocation
import com.neph.features.profile.data.CurrentLocationShareWarning
import com.neph.features.profile.data.DeviceLocationProvider
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.location.rememberForegroundLocationPermissionRequester
import com.neph.ui.map.LeafletMapInitializationTimeoutMessage
import com.neph.ui.map.LeafletMapInitializationTimeoutMillis
import com.neph.ui.map.LeafletMapMarker
import com.neph.ui.map.LeafletMapStatusOverlay
import com.neph.ui.map.LeafletMapViewport
import com.neph.ui.map.LeafletMarkerMap
import com.neph.ui.map.MapLocationControl
import com.neph.ui.map.NephMapIntegration
import com.neph.ui.map.effectiveLeafletViewportKey
import com.neph.ui.map.isLeafletMapInitializedForInstance
import com.neph.ui.map.isLeafletTileLoadedSignal
import com.neph.ui.map.isLeafletViewportDiscoverable
import com.neph.ui.map.leafletViewportBboxString
import com.neph.ui.map.leafletMapErrorForInstance
import com.neph.ui.map.leafletMapStatusOverlayMessage
import com.neph.ui.map.logMapDebug
import com.neph.ui.map.newLeafletMapInstanceId
import com.neph.ui.map.shouldApplyLeafletMapError
import com.neph.ui.map.shouldApplyLeafletMapTimeout
import com.neph.ui.map.shouldClearLeafletMapErrorForSignal
import com.neph.ui.map.shouldFetchLeafletViewport
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val HelpRequestMapHeightCssPx = 280
private const val TurkeyOverviewLatitude = 39.0
private const val TurkeyOverviewLongitude = 35.0
private const val TurkeyOverviewZoom = 5
internal const val HelpRequestMapCurrentLocationZoom = 15
private const val ResourceInitialMessage = "Zoom in or use your device location to see resources in this area."
private const val ResourceZoomedOutMessage = "Zoom in to see resources in this area."
private const val ResourceLoadingMessage = "Loading resources in this area..."
private const val ResourceUpdatingMessage = "Updating visible area..."
private const val ResourceEmptyMessage = "No resources were found in this visible area."
private const val ResourceErrorMessage = "Resources could not be loaded for this area. Please try again."
private const val ResourceFilterEmptyMessage = "No help requests match the selected request type filters."
private const val InitialPermissionDeniedFallbackMessage =
    "Location permission was denied. Showing default help request results."
private const val InitialLocationUnavailableFallbackMessage =
    "Current location is unavailable. Showing default help request results."

private val RequestTypeFilterOrder = listOf(
    CrisisRequestType.FIRST_AID,
    CrisisRequestType.SHELTER,
    CrisisRequestType.FOOD_WATER,
    CrisisRequestType.SEARCH_AND_RESCUE,
    CrisisRequestType.OTHER
)

internal fun filterVisibleRequests(
    requests: List<ActiveHelpRequestMapItem>,
    selectedTypes: Set<CrisisRequestType>
): List<ActiveHelpRequestMapItem> {
    if (selectedTypes.isEmpty()) {
        return requests
    }
    return requests.filter { it.type in selectedTypes }
}

internal fun reconcileSelectedRequestId(
    selectedRequestId: String?,
    visibleRequests: List<ActiveHelpRequestMapItem>
): String? {
    if (selectedRequestId == null) {
        return null
    }
    return selectedRequestId.takeIf { selected ->
        visibleRequests.any { it.requestId == selected }
    }
}

internal data class HelpRequestMapCenter(
    val latitude: Double,
    val longitude: Double
)

internal data class HelpRequestMapInstanceKey(
    val centerLatitude: Double,
    val centerLongitude: Double
)

internal fun helpRequestMapCenter(
    requests: List<ActiveHelpRequestMapItem>
): HelpRequestMapCenter {
    val validRequests = requests.filter { it.hasValidMapCoordinates() }
    if (validRequests.isEmpty()) {
        return HelpRequestMapCenter(
            latitude = TurkeyOverviewLatitude,
            longitude = TurkeyOverviewLongitude
        )
    }

    return HelpRequestMapCenter(
        latitude = validRequests.sumOf { it.latitude } / validRequests.size,
        longitude = validRequests.sumOf { it.longitude } / validRequests.size
    )
}

internal fun helpRequestLeafletMarkers(
    requests: List<ActiveHelpRequestMapItem>
): List<LeafletMapMarker> {
    return requests.filter { it.hasValidMapCoordinates() }.map { request ->
        val style = requestMarkerStyle(request.type)
        val subtitle = "Priority: ${ActiveHelpRequestsRepository.formatPriority(request.priorityLevel)} - " +
            "${request.district}, ${request.city}"
        LeafletMapMarker(
            id = request.requestId,
            latitude = request.latitude,
            longitude = request.longitude,
            title = request.typeLabel,
            subtitle = subtitle,
            strokeColorHex = style.strokeHex,
            fillColorHex = style.fillHex
        )
    }
}

internal fun helpRequestMapInstanceKey(
    requests: List<ActiveHelpRequestMapItem>
): HelpRequestMapInstanceKey {
    val center = helpRequestMapCenter(requests)
    return HelpRequestMapInstanceKey(
        centerLatitude = center.latitude,
        centerLongitude = center.longitude
    )
}

internal fun helpRequestMapEmptyMessage(
    blockingLoading: Boolean,
    errorMessage: String,
    currentViewport: LeafletMapViewport?,
    isFilterEmpty: Boolean,
    hasFetchedViewport: Boolean
): String {
    return when {
        blockingLoading -> ResourceLoadingMessage
        errorMessage.isNotBlank() -> "Request markers are unavailable for this area."
        currentViewport == null -> ResourceInitialMessage
        !isLeafletViewportDiscoverable(currentViewport) -> ResourceZoomedOutMessage
        isFilterEmpty -> "No request markers to display with these filters."
        hasFetchedViewport -> "No request markers to display in this visible area."
        else -> ResourceInitialMessage
    }
}

internal fun shouldShowPreviousHelpRequestsDuringViewportFetch(
    requests: List<ActiveHelpRequestMapItem>,
    manualRefresh: Boolean
): Boolean {
    return requests.isNotEmpty() && !manualRefresh
}

internal fun markersShouldFitBounds(
    requests: List<ActiveHelpRequestMapItem>,
    mapResetToken: Int
): Boolean {
    return mapResetToken == 0 && requests.any { it.hasValidMapCoordinates() }
}

private fun ActiveHelpRequestMapItem.hasValidMapCoordinates(): Boolean {
    return latitude.isFinite() &&
        longitude.isFinite() &&
        latitude in -90.0..90.0 &&
        longitude in -180.0..180.0
}

@Composable
fun HelpRequestMapScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: (() -> Unit)?,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    isAuthenticated: Boolean,
    mobileOnboardingStepId: MobileOnboardingStepId? = null,
    onMobileOnboardingStepCompleted: (String?) -> Unit = {}
) {
    val spacing = LocalNephSpacing.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var loading by remember { mutableStateOf(false) }
    var backgroundUpdating by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }
    var infoMessage by remember { mutableStateOf("") }
    var requests by remember { mutableStateOf(emptyList<ActiveHelpRequestMapItem>()) }
    var selectedRequestId by remember { mutableStateOf<String?>(null) }
    var selectedTypes by remember { mutableStateOf(setOf<CrisisRequestType>()) }
    var currentViewport by remember { mutableStateOf<LeafletMapViewport?>(null) }
    var pendingViewport by remember { mutableStateOf<LeafletMapViewport?>(null) }
    var viewportUpdateQueued by remember { mutableStateOf(false) }
    var lastFetchedViewportKey by remember { mutableStateOf<String?>(null) }
    var viewportRefreshNonce by remember { mutableStateOf(0) }
    var viewportRequestSerial by remember { mutableStateOf(0) }
    var mapCenterLatitude by remember { mutableStateOf(TurkeyOverviewLatitude) }
    var mapCenterLongitude by remember { mutableStateOf(TurkeyOverviewLongitude) }
    var mapZoom by remember { mutableStateOf(TurkeyOverviewZoom) }
    var mapResetNonce by remember { mutableStateOf(0) }
    var currentLocation by remember { mutableStateOf<CurrentDeviceLocation?>(null) }
    var attemptedInitialLocation by remember { mutableStateOf(false) }
    var initialLocationPermissionRequestPending by remember { mutableStateOf(false) }
    var initialFallbackFetchRequested by remember { mutableStateOf(false) }
    var initialFallbackFetchCompleted by remember { mutableStateOf(false) }
    var initialFallbackInfoMessage by remember { mutableStateOf<String?>(null) }
    var initialMarkerFitApplied by remember { mutableStateOf(false) }
    var markerFitBoundsToken by remember { mutableStateOf<Int?>(null) }

    fun applyRequestResult(
        result: ActiveHelpRequestsResult,
        viewportKey: String?,
        infoOverride: String? = null
    ) {
        if (
            !initialMarkerFitApplied &&
            viewportKey == null &&
            result.requests.any { it.hasValidMapCoordinates() }
        ) {
            markerFitBoundsToken = (markerFitBoundsToken ?: 0) + 1
            initialMarkerFitApplied = true
        }
        requests = result.requests
        viewportKey?.let { lastFetchedViewportKey = it }
        viewportRefreshNonce = 0
        selectedRequestId = selectedRequestId
            ?.takeIf { selected -> result.requests.any { it.requestId == selected } }
        infoMessage = when {
            !infoOverride.isNullOrBlank() -> infoOverride
            result.requests.isEmpty() -> ResourceEmptyMessage
            result.skippedCount > 0 ->
                "${result.skippedCount} inactive or malformed request entries were hidden."
            else -> ""
        }
    }

    fun queueInitialFallbackFetch(message: String) {
        if (initialFallbackFetchCompleted || initialFallbackFetchRequested) {
            if (infoMessage.isBlank()) {
                infoMessage = message
            }
            return
        }
        initialFallbackInfoMessage = message
        initialFallbackFetchRequested = true
    }

    fun queueViewportFetch(
        viewport: LeafletMapViewport?,
        manualRefresh: Boolean = false
    ) {
        if (!isLeafletViewportDiscoverable(viewport)) {
            viewportRequestSerial += 1
            pendingViewport = null
            requests = emptyList()
            selectedRequestId = null
            errorMessage = ""
            loading = false
            backgroundUpdating = false
            viewportUpdateQueued = false
            infoMessage = ""
            return
        }

        val viewportKey = effectiveLeafletViewportKey(viewport)
        if (viewportKey == null) {
            viewportRequestSerial += 1
            pendingViewport = null
            viewportUpdateQueued = false
            loading = false
            backgroundUpdating = false
            return
        }

        val previousPendingViewportKey = effectiveLeafletViewportKey(pendingViewport)
        val viewportChanged = viewportKey != previousPendingViewportKey
        val shouldQueue = shouldFetchLeafletViewport(
            viewportKey = viewportKey,
            lastFetchedViewportKey = lastFetchedViewportKey,
            manualRefresh = manualRefresh
        )

        errorMessage = ""
        pendingViewport = viewport
        if (shouldQueue) {
            viewportRequestSerial += 1
            viewportUpdateQueued = true
            if (manualRefresh) {
                viewportRefreshNonce += 1
            }
        } else {
            if (viewportChanged) {
                viewportRequestSerial += 1
                loading = false
                backgroundUpdating = false
            }
            viewportUpdateQueued = false
        }
    }

    fun queueViewportRefresh() {
        queueViewportFetch(
            viewport = currentViewport,
            manualRefresh = true
        )
    }

    fun requestCurrentLocationAndRefresh(
        silent: Boolean = false,
        isInitialAttempt: Boolean = false
    ) {
        scope.launch {
            loading = true
            backgroundUpdating = false
            viewportUpdateQueued = false
            errorMessage = ""
            if (!silent) {
                infoMessage = ""
            }

            try {
                val attempt = DeviceLocationProvider.captureCurrentLocationForSharing(
                    context = context,
                    sharingEnabled = true
                )

                val location = attempt.location
                if (location != null) {
                    currentLocation = location
                    viewportRequestSerial += 1
                    currentViewport = null
                    pendingViewport = null
                    viewportUpdateQueued = false
                    requests = emptyList()
                    mapCenterLatitude = location.latitude
                    mapCenterLongitude = location.longitude
                    mapZoom = HelpRequestMapCurrentLocationZoom
                    mapResetNonce += 1
                    markerFitBoundsToken = null
                    selectedRequestId = null
                    lastFetchedViewportKey = null
                    infoMessage = ""
                    loading = false
                    backgroundUpdating = false
                    return@launch
                }

                loading = false
                val fallbackMessage = when (attempt.warning) {
                    CurrentLocationShareWarning.PERMISSION_DENIED ->
                        if (isInitialAttempt) {
                            InitialPermissionDeniedFallbackMessage
                        } else {
                            "Location permission was denied. Help request map was not recentered."
                        }

                    CurrentLocationShareWarning.LOCATION_UNAVAILABLE,
                    null -> if (isInitialAttempt) {
                        InitialLocationUnavailableFallbackMessage
                    } else {
                        "Current location is unavailable. Help request map was not recentered."
                    }
                }
                if (isInitialAttempt) {
                    queueInitialFallbackFetch(fallbackMessage)
                    infoMessage = fallbackMessage
                } else if (!silent) {
                    infoMessage = fallbackMessage
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                loading = false
                if (isInitialAttempt) {
                    queueInitialFallbackFetch(InitialLocationUnavailableFallbackMessage)
                    infoMessage = InitialLocationUnavailableFallbackMessage
                } else if (!silent) {
                    infoMessage = "Current location is unavailable. Help request map was not recentered."
                }
            }
        }
    }

    fun openRequestInMap(item: ActiveHelpRequestMapItem) {
        val opened = NephMapIntegration.openCoordinates(
            context = context,
            latitude = item.latitude,
            longitude = item.longitude,
            label = item.typeLabel
        )
        if (!opened) {
            infoMessage = "Could not open map application."
        }
    }

    fun openRequestDirections(item: ActiveHelpRequestMapItem) {
        val opened = NephMapIntegration.openDirections(
            context = context,
            latitude = item.latitude,
            longitude = item.longitude,
            label = item.typeLabel
        )
        if (!opened) {
            infoMessage = "Directions are unavailable for this request location."
        }
    }

    LaunchedEffect(initialFallbackFetchRequested) {
        if (!initialFallbackFetchRequested) return@LaunchedEffect
        loading = true
        backgroundUpdating = false
        errorMessage = ""

        try {
            val result = ActiveHelpRequestsRepository.fetchWaitingHelpRequests()
            applyRequestResult(
                result = result,
                viewportKey = null,
                infoOverride = initialFallbackInfoMessage
            )
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (error: ApiException) {
            errorMessage = error.message.ifBlank { ResourceErrorMessage }
            requests = emptyList()
            selectedRequestId = null
            if (infoMessage.isBlank()) {
                infoMessage = initialFallbackInfoMessage.orEmpty()
            }
        } catch (_: Exception) {
            errorMessage = ResourceErrorMessage
            requests = emptyList()
            selectedRequestId = null
            if (infoMessage.isBlank()) {
                infoMessage = initialFallbackInfoMessage.orEmpty()
            }
        } finally {
            loading = false
            initialFallbackFetchRequested = false
            initialFallbackFetchCompleted = true
        }
    }

    LaunchedEffect(pendingViewport, lastFetchedViewportKey, viewportRefreshNonce, viewportRequestSerial) {
        val viewport = pendingViewport
        if (viewport == null || !isLeafletViewportDiscoverable(viewport)) {
            viewportUpdateQueued = false
            return@LaunchedEffect
        }
        val viewportKey = effectiveLeafletViewportKey(viewport)
        if (viewportKey == null) {
            viewportUpdateQueued = false
            return@LaunchedEffect
        }
        val manualRefresh = viewportRefreshNonce > 0
        if (!shouldFetchLeafletViewport(viewportKey, lastFetchedViewportKey, manualRefresh)) {
            viewportUpdateQueued = false
            return@LaunchedEffect
        }
        val requestSerial = viewportRequestSerial
        delay(450)
        viewportUpdateQueued = false
        val blockingLoading = !shouldShowPreviousHelpRequestsDuringViewportFetch(
            requests = requests,
            manualRefresh = manualRefresh
        )
        loading = blockingLoading
        backgroundUpdating = !blockingLoading
        errorMessage = ""
        infoMessage = ""

        try {
            val result = ActiveHelpRequestsRepository.fetchWaitingHelpRequests(
                bbox = leafletViewportBboxString(viewport)
            )
            if (requestSerial == viewportRequestSerial) {
                applyRequestResult(result, viewportKey = viewportKey)
            }
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (error: ApiException) {
            if (requestSerial == viewportRequestSerial) {
                errorMessage = error.message.ifBlank { ResourceErrorMessage }
                infoMessage = ""
                if (requests.isEmpty()) {
                    selectedRequestId = null
                }
            }
        } catch (_: Exception) {
            if (requestSerial == viewportRequestSerial) {
                errorMessage = ResourceErrorMessage
                infoMessage = ""
                if (requests.isEmpty()) {
                    selectedRequestId = null
                }
            }
        } finally {
            if (requestSerial == viewportRequestSerial) {
                viewportUpdateQueued = false
                loading = false
                backgroundUpdating = false
            }
        }
    }

    val locationPermissionRequester = rememberForegroundLocationPermissionRequester { result ->
        val isInitialRequest = initialLocationPermissionRequestPending
        initialLocationPermissionRequestPending = false
        if (result.granted) {
            requestCurrentLocationAndRefresh(
                silent = false,
                isInitialAttempt = isInitialRequest
            )
        } else {
            errorMessage = ""
            loading = false
            backgroundUpdating = false
            viewportUpdateQueued = false
            if (isInitialRequest) {
                infoMessage = InitialPermissionDeniedFallbackMessage
                queueInitialFallbackFetch(InitialPermissionDeniedFallbackMessage)
            } else {
                infoMessage = "Location permission was denied. Help request map was not recentered."
            }
        }
    }

    fun showCurrentLocationOnMap() {
        if (locationPermissionRequester.refreshPermissionState()) {
            requestCurrentLocationAndRefresh()
        } else {
            locationPermissionRequester.requestPermission()
        }
    }

    LaunchedEffect(Unit) {
        if (attemptedInitialLocation) return@LaunchedEffect
        attemptedInitialLocation = true
        if (locationPermissionRequester.refreshPermissionState()) {
            requestCurrentLocationAndRefresh(silent = false, isInitialAttempt = true)
        } else {
            initialLocationPermissionRequestPending = true
            locationPermissionRequester.requestPermission()
        }
    }

    val visibleRequests = filterVisibleRequests(requests, selectedTypes)

    LaunchedEffect(visibleRequests, selectedRequestId) {
        selectedRequestId = reconcileSelectedRequestId(selectedRequestId, visibleRequests)
    }

    fun handleViewportChanged(viewport: LeafletMapViewport) {
        currentViewport = viewport
        mapCenterLatitude = viewport.centerLatitude
        mapCenterLongitude = viewport.centerLongitude
        if (isLeafletViewportDiscoverable(viewport)) {
            errorMessage = ""
            if (infoMessage == ResourceZoomedOutMessage) {
                infoMessage = ""
            }
            queueViewportFetch(viewport)
        } else {
            lastFetchedViewportKey = null
            queueViewportFetch(viewport = null)
        }
    }

    val selectedRequest = visibleRequests.firstOrNull { it.requestId == selectedRequestId }
    val isFilterEmpty = !loading && requests.isNotEmpty() && visibleRequests.isEmpty()
    val mapActionsEnabled = !loading && !backgroundUpdating && !viewportUpdateQueued
    val mapEmptyMarkersMessage = helpRequestMapEmptyMessage(
        blockingLoading = loading,
        errorMessage = errorMessage,
        currentViewport = currentViewport,
        isFilterEmpty = isFilterEmpty,
        hasFetchedViewport = lastFetchedViewportKey != null
    )

    AppDrawerScaffold(
        title = "Help Request Map",
        currentRoute = Routes.HelpRequestMap.route,
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
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = if (isAuthenticated) "Profile" else "Login / Create Account",
        mobileOnboardingStepId = mobileOnboardingStepId,
        onMobileOnboardingStepCompleted = onMobileOnboardingStepCompleted
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    Text(
                        text = "Showing waiting help requests by type and priority.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    SecondaryButton(
                        text = "Refresh Help Request Map",
                        onClick = { queueViewportRefresh() },
                        enabled = mapActionsEnabled
                    )
                }
            }

            SectionCard {
                CrisisRequestMapPanel(
                    requests = visibleRequests,
                    selectedRequestId = selectedRequest?.requestId,
                    emptyMarkersMessage = mapEmptyMarkersMessage,
                    loadingResources = loading,
                    updatingResources = backgroundUpdating || viewportUpdateQueued,
                    mapCenterLatitude = mapCenterLatitude,
                    mapCenterLongitude = mapCenterLongitude,
                    currentLocationLatitude = currentLocation?.latitude,
                    currentLocationLongitude = currentLocation?.longitude,
                    mapZoom = mapZoom,
                    mapResetToken = mapResetNonce,
                    fitBoundsRequestToken = markerFitBoundsToken,
                    onShowCurrentLocation = ::showCurrentLocationOnMap,
                    showCurrentLocationEnabled = mapActionsEnabled,
                    onViewportChanged = ::handleViewportChanged,
                    onSelectRequest = { selectedRequestId = it }
                )
            }

            when {
                requests.isEmpty() -> {
                    if (
                        lastFetchedViewportKey != null &&
                        !loading &&
                        errorMessage.isBlank() &&
                        isLeafletViewportDiscoverable(currentViewport)
                    ) {
                        SectionCard {
                            Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                                SectionHeader(
                                    title = "No Waiting Requests",
                                    subtitle = ResourceEmptyMessage
                                )
                                SecondaryButton(
                                    text = "Retry",
                                    onClick = { queueViewportRefresh() },
                                    enabled = mapActionsEnabled
                                )
                            }
                        }
                    }
                }

                else -> {
                    SectionCard {
                        RequestTypeFiltersCard(
                            selectedTypes = selectedTypes,
                            onToggleType = { type ->
                                selectedTypes = if (type in selectedTypes) {
                                    selectedTypes - type
                                } else {
                                    selectedTypes + type
                                }
                            },
                            onClear = { selectedTypes = emptySet() }
                        )
                    }

                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                            Text(
                                text = "Selected Request",
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.onSurface,
                                fontWeight = FontWeight.SemiBold
                            )

                            if (selectedRequest != null) {
                                RequestDetails(
                                    item = selectedRequest,
                                    onOpenMap = { openRequestInMap(selectedRequest) },
                                    onGetDirections = { openRequestDirections(selectedRequest) }
                                )
                            } else {
                                HelperText(text = "Tap a request marker or list item to see details.")
                            }
                        }
                    }

                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                            Text(
                                text = "Waiting Requests",
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.onSurface,
                                fontWeight = FontWeight.SemiBold
                            )

                            if (visibleRequests.isEmpty()) {
                                HelperText(text = "No waiting requests in view.")
                            }

                            visibleRequests.forEachIndexed { index, item ->
                                RequestListItem(
                                    item = item,
                                    selected = item.requestId == selectedRequest?.requestId,
                                    onSelect = { selectedRequestId = item.requestId },
                                    onOpenMap = { openRequestInMap(item) },
                                    onGetDirections = { openRequestDirections(item) }
                                )

                                if (index < visibleRequests.lastIndex) {
                                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                                }
                            }
                        }
                    }
                }
            }

            if (isFilterEmpty) {
                SectionCard {
                    HelperText(text = ResourceFilterEmptyMessage)
                }
            }

            if (errorMessage.isNotBlank()) {
                SectionCard {
                    Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                        HelperText(text = errorMessage)
                        SecondaryButton(
                            text = "Retry",
                            onClick = { queueViewportRefresh() },
                            enabled = mapActionsEnabled
                        )
                    }
                }
            }

            if (infoMessage.isNotBlank()) {
                SectionCard {
                    HelperText(text = infoMessage)
                }
            }
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun RequestTypeFiltersCard(
    selectedTypes: Set<CrisisRequestType>,
    onToggleType: (CrisisRequestType) -> Unit,
    onClear: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Filter by Request Type",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold
            )
            TextActionButton(
                text = "Clear",
                enabled = selectedTypes.isNotEmpty(),
                onClick = onClear
            )
        }

        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(spacing.sm),
            verticalArrangement = Arrangement.spacedBy(spacing.sm)
        ) {
            RequestTypeFilterOrder.forEach { type ->
                val style = requestMarkerStyle(type)
                val selected = type in selectedTypes
                FilterChip(
                    selected = selected,
                    onClick = { onToggleType(type) },
                    label = {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(spacing.xs),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(style.dotColor)
                            )
                            Text(text = ActiveHelpRequestsRepository.labelForType(type))
                        }
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                        selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                )
            }
        }

        Text(
            text = "Legend",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = FontWeight.SemiBold
        )
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(spacing.md),
            verticalArrangement = Arrangement.spacedBy(spacing.sm)
        ) {
            RequestTypeFilterOrder.forEach { type ->
                val style = requestMarkerStyle(type)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(spacing.xs),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(style.dotColor)
                    )
                    Text(
                        text = ActiveHelpRequestsRepository.labelForType(type),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun RequestDetails(
    item: ActiveHelpRequestMapItem,
    onOpenMap: () -> Unit,
    onGetDirections: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(spacing.md),
            verticalAlignment = Alignment.CenterVertically
        ) {
            PinGlyph(type = item.type)
            Text(
                text = item.typeLabel,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold
            )
        }

        Text(
            text = "Priority: ${ActiveHelpRequestsRepository.formatPriority(item.priorityLevel)}",
            style = MaterialTheme.typography.bodyMedium,
            color = priorityColor(item.priorityLevel)
        )
        Text(
            text = "Location: ${item.district}, ${item.city}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
        Text(
            text = "Opened: ${ActiveHelpRequestsRepository.formatOpenedAt(item.createdAt)}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
            verticalArrangement = Arrangement.spacedBy(spacing.xs)
        ) {
            TextActionButton(
                text = "Get Directions",
                onClick = onGetDirections
            )
            TextActionButton(
                text = "Open in Map",
                onClick = onOpenMap
            )
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun RequestListItem(
    item: ActiveHelpRequestMapItem,
    selected: Boolean,
    onSelect: () -> Unit,
    onOpenMap: () -> Unit,
    onGetDirections: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val backgroundColor = if (selected) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.surface
    }
    val textColor = if (selected) {
        MaterialTheme.colorScheme.onPrimaryContainer
    } else {
        MaterialTheme.colorScheme.onSurface
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(backgroundColor, RoundedCornerShape(16.dp))
            .clickable(onClick = onSelect),
        verticalArrangement = Arrangement.spacedBy(spacing.xs)
    ) {
        Spacer(modifier = Modifier.height(spacing.sm))
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(spacing.sm)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(spacing.md),
                verticalAlignment = Alignment.CenterVertically
            ) {
                PinGlyph(type = item.type)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = item.typeLabel,
                        style = MaterialTheme.typography.titleSmall,
                        color = textColor,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "Priority: ${ActiveHelpRequestsRepository.formatPriority(item.priorityLevel)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (selected) {
                            MaterialTheme.colorScheme.onPrimaryContainer
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        }
                    )
                    Text(
                        text = "${item.district}, ${item.city}",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (selected) {
                            MaterialTheme.colorScheme.onPrimaryContainer
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        }
                    )
                }
            }
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalArrangement = Arrangement.spacedBy(spacing.xs)
            ) {
                TextActionButton(
                    text = "Get Directions",
                    onClick = onGetDirections
                )
                TextActionButton(
                    text = "Open in Map",
                    onClick = onOpenMap
                )
            }
        }
        Spacer(modifier = Modifier.height(spacing.sm))
    }
}

@Composable
private fun CrisisRequestMapPanel(
    requests: List<ActiveHelpRequestMapItem>,
    selectedRequestId: String?,
    emptyMarkersMessage: String = ResourceEmptyMessage,
    loadingResources: Boolean = false,
    updatingResources: Boolean = false,
    mapCenterLatitude: Double = TurkeyOverviewLatitude,
    mapCenterLongitude: Double = TurkeyOverviewLongitude,
    currentLocationLatitude: Double? = null,
    currentLocationLongitude: Double? = null,
    mapZoom: Int = TurkeyOverviewZoom,
    mapResetToken: Int = 0,
    fitBoundsRequestToken: Int? = null,
    onShowCurrentLocation: (() -> Unit)? = null,
    showCurrentLocationEnabled: Boolean = true,
    onViewportChanged: (LeafletMapViewport) -> Unit,
    onSelectRequest: (String) -> Unit
) {
    val spacing = LocalNephSpacing.current
    val initializedInstanceIdState = remember { mutableStateOf<String?>(null) }
    val tileLoadedInstanceIdState = remember { mutableStateOf<String?>(null) }
    val errorInstanceIdState = remember { mutableStateOf<String?>(null) }
    var mapError by remember { mutableStateOf("") }
    val mapInstanceKey = helpRequestMapInstanceKey(requests)
    val shouldFitRequestMarkers = markersShouldFitBounds(requests, mapResetToken)
    val effectiveCenterLatitude = if (shouldFitRequestMarkers) mapInstanceKey.centerLatitude else mapCenterLatitude
    val effectiveCenterLongitude = if (shouldFitRequestMarkers) mapInstanceKey.centerLongitude else mapCenterLongitude
    val effectiveZoom = if (shouldFitRequestMarkers) 13 else mapZoom
    val mapInstanceId = remember(mapResetToken) {
        newLeafletMapInstanceId()
    }
    val currentMapInstanceIdState = remember { mutableStateOf(mapInstanceId) }
    currentMapInstanceIdState.value = mapInstanceId
    val activeMapInitialized = isLeafletMapInitializedForInstance(
        activeInstanceId = mapInstanceId,
        initializedInstanceId = initializedInstanceIdState.value
    )
    val activeMapError = leafletMapErrorForInstance(
        activeInstanceId = mapInstanceId,
        tileLoadedInstanceId = tileLoadedInstanceIdState.value,
        errorInstanceId = errorInstanceIdState.value,
        errorMessage = mapError
    )
    val mapOverlayMessage = leafletMapStatusOverlayMessage(
        mapInitialized = activeMapInitialized,
        mapError = activeMapError,
        loadingResources = loadingResources,
        updatingResources = updatingResources
    )
    val selectedRequest = requests.firstOrNull { it.requestId == selectedRequestId }
    val markers = helpRequestLeafletMarkers(requests)

    fun markMapAlive(instanceId: String, source: String) {
        if (instanceId == currentMapInstanceIdState.value) {
            logMapDebug("native HelpRequestMap initialized source=$source instance=$instanceId")
            initializedInstanceIdState.value = instanceId
            if (isLeafletTileLoadedSignal(source)) {
                tileLoadedInstanceIdState.value = instanceId
            }
            if (shouldClearLeafletMapErrorForSignal(source, mapError)) {
                errorInstanceIdState.value = null
                mapError = ""
            }
        } else {
            logMapDebug(
                "native HelpRequestMap initialized ignored stale source=$source instance=$instanceId current=${currentMapInstanceIdState.value}"
            )
        }
    }

    LaunchedEffect(mapInstanceId) {
        errorInstanceIdState.value = null
        mapError = ""
        delay(LeafletMapInitializationTimeoutMillis)
        if (shouldApplyLeafletMapTimeout(
                activeInstanceId = mapInstanceId,
                currentInstanceId = currentMapInstanceIdState.value,
                initializedInstanceId = initializedInstanceIdState.value,
                errorInstanceId = errorInstanceIdState.value
            )
        ) {
            logMapDebug("native HelpRequestMap timeout applied instance=$mapInstanceId")
            errorInstanceIdState.value = mapInstanceId
            mapError = LeafletMapInitializationTimeoutMessage
        } else {
            logMapDebug(
                "native HelpRequestMap timeout ignored instance=$mapInstanceId current=${currentMapInstanceIdState.value} initialized=${initializedInstanceIdState.value} error=${errorInstanceIdState.value}"
            )
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
        SectionHeader(
            title = "Live Help Request Map",
            subtitle = if (markers.isEmpty()) {
                "Map markers appear after a discoverable area loads."
            } else {
                "Tap a marker to preview that help request."
            }
        )

        Box {
            LeafletMarkerMap(
                mapInstanceId = mapInstanceId,
                currentMapInstanceId = { currentMapInstanceIdState.value },
                centerLatitude = effectiveCenterLatitude,
                centerLongitude = effectiveCenterLongitude,
                currentLocationLatitude = currentLocationLatitude,
                currentLocationLongitude = currentLocationLongitude,
                markers = markers,
                selectedMarkerId = selectedRequestId,
                mapHeightCssPx = HelpRequestMapHeightCssPx,
                zoom = effectiveZoom,
                showCenterMarker = false,
                fitBoundsToMarkers = shouldFitRequestMarkers,
                fitBoundsRequestToken = fitBoundsRequestToken,
                onMarkerSelected = { markerInstanceId, markerId ->
                    if (markerInstanceId == currentMapInstanceIdState.value) {
                        onSelectRequest(markerId)
                    }
                },
                onMapReady = { initializedInstanceId, source ->
                    markMapAlive(initializedInstanceId, source)
                },
                onMapError = { errorInstanceId, message ->
                    if (
                        shouldApplyLeafletMapError(
                            activeInstanceId = errorInstanceId,
                            currentInstanceId = currentMapInstanceIdState.value,
                            tileLoadedInstanceId = tileLoadedInstanceIdState.value,
                            errorMessage = message
                        )
                    ) {
                        errorInstanceIdState.value = errorInstanceId
                        mapError = message.ifBlank { "Map failed to load. Check your connection and try again." }
                    }
                },
                onViewportChanged = { viewportInstanceId, viewport ->
                    if (viewportInstanceId == currentMapInstanceIdState.value) {
                        onViewportChanged(viewport)
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(HelpRequestMapHeightCssPx.dp)
            )
            onShowCurrentLocation?.let { showCurrentLocation ->
                MapLocationControl(
                    onClick = showCurrentLocation,
                    enabled = showCurrentLocationEnabled,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(spacing.sm)
                )
            }
            LeafletMapStatusOverlay(
                message = mapOverlayMessage,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(spacing.sm)
            )
        }

        if (!activeMapInitialized && activeMapError.isBlank()) {
            HelperText(text = "Loading map...")
        }

        if (activeMapError.isNotBlank()) {
            HelperText(text = activeMapError)
        }

        if (loadingResources) {
            HelperText(text = ResourceLoadingMessage)
        }

        if (updatingResources) {
            HelperText(text = ResourceUpdatingMessage)
        }

        if (markers.isEmpty() && !loadingResources && !updatingResources) {
            HelperText(text = emptyMarkersMessage)
        }

        selectedRequest?.let { request ->
            HelpRequestMapSelectionPreview(item = request)
        }
    }
}

@Composable
private fun PinGlyph(type: CrisisRequestType, selected: Boolean = false) {
    val style = requestMarkerStyle(type)

    Box(
        modifier = Modifier
            .size(if (selected) 40.dp else 34.dp)
            .semantics { contentDescription = "Crisis marker: ${ActiveHelpRequestsRepository.labelForType(type)}" }
            .background(
                color = style.dotColor,
                shape = RoundedCornerShape(
                    topStart = 14.dp,
                    topEnd = 14.dp,
                    bottomEnd = 14.dp,
                    bottomStart = 5.dp
                )
            )
            .border(
                width = if (selected) 3.dp else 2.dp,
                color = if (selected) MaterialTheme.colorScheme.onSurface else Color.White,
                shape = RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp, bottomEnd = 14.dp, bottomStart = 5.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = style.glyph,
            style = MaterialTheme.typography.labelMedium,
            color = Color.White,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun HelpRequestMapSelectionPreview(
    item: ActiveHelpRequestMapItem
) {
    val spacing = LocalNephSpacing.current

    Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
        Text(
            text = item.typeLabel,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = "Priority: ${ActiveHelpRequestsRepository.formatPriority(item.priorityLevel)}",
            style = MaterialTheme.typography.bodySmall,
            color = priorityColor(item.priorityLevel)
        )
        Text(
            text = "${item.district}, ${item.city}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

internal data class RequestMarkerStyle(
    val strokeHex: String,
    val fillHex: String,
    val dotColor: Color,
    val glyph: String
)

internal fun requestMarkerStyle(type: CrisisRequestType): RequestMarkerStyle {
    return when (type) {
        CrisisRequestType.SHELTER -> RequestMarkerStyle("#1D4ED8", "#3B66D8", Color(0xFF3B66D8), "SH")
        CrisisRequestType.FIRST_AID -> RequestMarkerStyle("#B42318", "#D94141", Color(0xFFD94141), "+")
        CrisisRequestType.SEARCH_AND_RESCUE -> RequestMarkerStyle("#C2410C", "#F08C00", Color(0xFFF08C00), "SR")
        CrisisRequestType.FOOD_WATER -> RequestMarkerStyle("#15803D", "#2F9E67", Color(0xFF2F9E67), "FW")
        CrisisRequestType.OTHER -> RequestMarkerStyle("#4B5563", "#687280", Color(0xFF687280), "?")
    }
}

private fun priorityColor(priority: String): Color {
    return when (priority.trim().uppercase()) {
        "HIGH" -> Color(0xFFA62626)
        "LOW" -> Color(0xFF166534)
        else -> Color(0xFF8A5A00)
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun HelpRequestMapScreenPreview() {
    NephTheme {
        HelpRequestMapScreen(
            onNavigateToRoute = {},
            onOpenSettings = {},
            onProfileClick = {},
            profileBadgeText = "PP",
            isAuthenticated = true
        )
    }
}
