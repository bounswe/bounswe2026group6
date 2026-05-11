package com.neph.features.gatheringareas.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Spacer
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.neph.core.network.ApiException
import com.neph.features.gatheringareas.data.GatheringAreaItem
import com.neph.features.gatheringareas.data.GatheringAreaCategoryMeta
import com.neph.features.gatheringareas.data.GatheringAreasRepository
import com.neph.features.gatheringareas.data.NearbyGatheringAreasResult
import com.neph.features.profile.data.CurrentLocationShareWarning
import com.neph.features.profile.data.DeviceLocationProvider
import com.neph.features.onboarding.data.MobileOnboardingStepId
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.location.rememberForegroundLocationPermissionRequester
import com.neph.ui.map.LeafletMapMarker
import com.neph.ui.map.LeafletMarkerMap
import com.neph.ui.map.LeafletMapInitializationTimeoutMessage
import com.neph.ui.map.LeafletMapInitializationTimeoutMillis
import com.neph.ui.map.LeafletMapViewport
import com.neph.ui.map.MapLocationControl
import com.neph.ui.map.NephMapIntegration
import com.neph.ui.map.effectiveLeafletViewportKey
import com.neph.ui.map.isLeafletMapInitializedForInstance
import com.neph.ui.map.isLeafletTileLoadedSignal
import com.neph.ui.map.isLeafletViewportDiscoverable
import com.neph.ui.map.leafletViewportBboxString
import com.neph.ui.map.leafletMapErrorForInstance
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
import java.util.Locale

private const val GatheringAreasMapHeightCssPx = 280
private const val TurkeyOverviewLatitude = 39.0
private const val TurkeyOverviewLongitude = 35.0
private const val TurkeyOverviewZoom = 5
internal const val GatheringAreasCurrentLocationZoom = 15
private const val ResourceInitialMessage = "Zoom in or use your device location to see resources in this area."
private const val ResourceZoomedOutMessage = "Zoom in to see resources in this area."
private const val ResourceLoadingMessage = "Loading resources in this area..."
private const val ResourceUpdatingMessage = "Updating visible area..."
private const val ResourceErrorMessage = "Resources could not be loaded for this area. Please try again."
private const val ResourceFilterEmptyMessage = "No results match the selected categories."
private const val ResourceProviderUnavailableMessage =
    "Gathering area provider is unavailable. Please try again."
private const val ResourceStaleCacheMessage =
    "Showing cached gathering areas; provider data may be temporarily unavailable."
internal const val GatheringAreasVisibleCategoriesTitle = "Visible Categories"
internal const val GatheringAreasVisibleCategoriesSubtitle =
    "Selected categories are shown on the map and in the list."
internal const val GatheringAreasShowAllCategoriesText = "Show All Categories"

internal data class GatheringAreasMapInstanceKey(
    val centerLatitude: Double,
    val centerLongitude: Double
)

internal fun gatheringAreasMapInstanceKey(
    result: NearbyGatheringAreasResult,
    visibleAreas: List<GatheringAreaItem>
): GatheringAreasMapInstanceKey {
    return GatheringAreasMapInstanceKey(
        centerLatitude = result.centerLatitude,
        centerLongitude = result.centerLongitude
    )
}

internal fun reconcileGatheringAreaCategoryFilters(
    previousOptionKeys: Set<String>,
    previousSelectedKeys: Set<String>,
    nextOptionKeys: Set<String>
): Set<String> {
    if (nextOptionKeys.isEmpty()) return emptySet()

    val wasShowingAll = previousOptionKeys.isEmpty() ||
        previousSelectedKeys.isEmpty() ||
        previousOptionKeys.all { it in previousSelectedKeys }

    if (wasShowingAll) {
        return nextOptionKeys
    }

    val newlyAvailableKeys = nextOptionKeys - previousOptionKeys
    return (previousSelectedKeys intersect nextOptionKeys) + newlyAvailableKeys
}

internal fun isGatheringAreasProviderUnavailable(result: NearbyGatheringAreasResult?): Boolean {
    val current = result ?: return false
    return current.source == "fallback" &&
        current.areas.isEmpty() &&
        !current.providerErrorCode.isNullOrBlank()
}

internal fun gatheringAreasResultHelperMessage(result: NearbyGatheringAreasResult): String {
    return when {
        result.stale -> ResourceStaleCacheMessage
        result.skippedCount > 0 -> "${result.skippedCount} malformed provider entries were skipped."
        else -> ""
    }
}

internal fun gatheringAreasMapEmptyMessage(
    blockingLoading: Boolean,
    errorMessage: String,
    currentViewport: LeafletMapViewport?,
    isFilterEmpty: Boolean,
    currentResult: NearbyGatheringAreasResult?
): String {
    return when {
        blockingLoading -> ResourceLoadingMessage
        errorMessage.isNotBlank() -> "Markers are unavailable for this area."
        currentViewport == null -> ResourceInitialMessage
        !isLeafletViewportDiscoverable(currentViewport) -> ResourceZoomedOutMessage
        isFilterEmpty -> "No markers to display with these categories."
        isGatheringAreasProviderUnavailable(currentResult) -> "Provider did not return markers for this area."
        currentResult?.areas?.isEmpty() == true -> "No markers to display in this visible area."
        else -> ResourceInitialMessage
    }
}

internal fun shouldShowPreviousGatheringAreasDuringViewportFetch(
    currentResult: NearbyGatheringAreasResult?,
    manualRefresh: Boolean
): Boolean {
    return currentResult != null && !manualRefresh
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
fun GatheringAreasScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: (() -> Unit)?,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    isAuthenticated: Boolean,
    mobileOnboardingStepId: MobileOnboardingStepId? = null,
    onMobileOnboardingStepCompleted: (String?) -> Unit = {}
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var loading by remember { mutableStateOf(false) }
    var backgroundUpdating by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }
    var infoMessage by remember { mutableStateOf("") }
    var mapCenterLatitude by remember { mutableStateOf(TurkeyOverviewLatitude) }
    var mapCenterLongitude by remember { mutableStateOf(TurkeyOverviewLongitude) }
    var mapZoom by remember { mutableStateOf(TurkeyOverviewZoom) }
    var mapResetNonce by remember { mutableStateOf(0) }
    var currentViewport by remember { mutableStateOf<LeafletMapViewport?>(null) }
    var pendingViewport by remember { mutableStateOf<LeafletMapViewport?>(null) }
    var lastFetchedViewportKey by remember { mutableStateOf<String?>(null) }
    var viewportRefreshNonce by remember { mutableStateOf(0) }
    var viewportRequestSerial by remember { mutableStateOf(0) }
    var nearbyResult by remember { mutableStateOf<NearbyGatheringAreasResult?>(null) }
    var selectedAreaId by remember { mutableStateOf<String?>(null) }
    var categoryFilters by remember { mutableStateOf<Set<String>>(emptySet()) }

    fun applyViewportResult(result: NearbyGatheringAreasResult) {
        val previousOptions = resolveCategoryOptions(nearbyResult).map { it.key }.toSet()
        val nextOptions = resolveCategoryOptions(result).map { it.key }.toSet()
        nearbyResult = result
        errorMessage = ""
        selectedAreaId = selectedAreaId
            ?.takeIf { selected -> result.areas.any { it.id == selected } }
            ?: result.areas.firstOrNull()?.id
        categoryFilters = reconcileGatheringAreaCategoryFilters(
            previousOptionKeys = previousOptions,
            previousSelectedKeys = categoryFilters,
            nextOptionKeys = nextOptions
        )

        infoMessage = ""
    }

    fun requestCurrentLocationAndRefresh() {
        scope.launch {
            loading = true
            errorMessage = ""
            infoMessage = ""

            try {
                val attempt = DeviceLocationProvider.captureCurrentLocationForSharing(
                    context = context,
                    sharingEnabled = true
                )

                val location = attempt.location
                if (location != null) {
                    viewportRequestSerial += 1
                    currentViewport = null
                    pendingViewport = null
                    nearbyResult = null
                    mapCenterLatitude = location.latitude
                    mapCenterLongitude = location.longitude
                    mapZoom = GatheringAreasCurrentLocationZoom
                    mapResetNonce += 1
                    selectedAreaId = null
                    lastFetchedViewportKey = null
                    loading = false
                    backgroundUpdating = false
                    return@launch
                }

                loading = false
                infoMessage = when (attempt.warning) {
                    CurrentLocationShareWarning.PERMISSION_DENIED ->
                        "Location permission was denied. Nearby results were not updated."

                    CurrentLocationShareWarning.LOCATION_UNAVAILABLE,
                    null -> "Current location is unavailable. Nearby results were not updated."
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                loading = false
                infoMessage = "Current location is unavailable. Nearby results were not updated."
            }
        }
    }

    LaunchedEffect(pendingViewport, lastFetchedViewportKey, viewportRefreshNonce) {
        val viewport = pendingViewport ?: return@LaunchedEffect
        if (!isLeafletViewportDiscoverable(viewport)) return@LaunchedEffect
        val viewportKey = effectiveLeafletViewportKey(viewport) ?: return@LaunchedEffect
        val manualRefresh = viewportRefreshNonce > 0
        if (!shouldFetchLeafletViewport(viewportKey, lastFetchedViewportKey, manualRefresh)) {
            return@LaunchedEffect
        }
        delay(450)
        val requestSerial = viewportRequestSerial + 1
        viewportRequestSerial = requestSerial
        val blockingLoading = !shouldShowPreviousGatheringAreasDuringViewportFetch(
            currentResult = nearbyResult,
            manualRefresh = manualRefresh
        )
        loading = blockingLoading
        backgroundUpdating = !blockingLoading
        errorMessage = ""
        infoMessage = ""

        try {
            val result = GatheringAreasRepository.fetchViewportGatheringAreas(
                bbox = leafletViewportBboxString(viewport),
                centerLatitude = viewport.centerLatitude,
                centerLongitude = viewport.centerLongitude,
                widestVisibleDimensionKm = viewport.widestVisibleDimensionKm
            )
            if (requestSerial == viewportRequestSerial) {
                lastFetchedViewportKey = viewportKey
                viewportRefreshNonce = 0
                applyViewportResult(result)
            }
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (error: ApiException) {
            if (requestSerial == viewportRequestSerial) {
                errorMessage = mapGatheringAreasErrorMessage(error).ifBlank { ResourceErrorMessage }
                infoMessage = ""
                if (nearbyResult == null) {
                    selectedAreaId = null
                }
            }
        } catch (_: Exception) {
            if (requestSerial == viewportRequestSerial) {
                errorMessage = ResourceErrorMessage
                infoMessage = ""
                if (nearbyResult == null) {
                    selectedAreaId = null
                }
            }
        } finally {
            if (requestSerial == viewportRequestSerial) {
                loading = false
                backgroundUpdating = false
            }
        }
    }

    val locationPermissionRequester = rememberForegroundLocationPermissionRequester { result ->
        if (result.granted) {
            requestCurrentLocationAndRefresh()
        } else {
            errorMessage = ""
            loading = false
            backgroundUpdating = false
            infoMessage = "Location permission was denied. Nearby results were not updated."
        }
    }

    fun showCurrentLocationOnMap() {
        if (locationPermissionRequester.refreshPermissionState()) {
            requestCurrentLocationAndRefresh()
        } else {
            locationPermissionRequester.requestPermission()
        }
    }

    fun openAreaInMap(item: GatheringAreaItem) {
        val opened = NephMapIntegration.openCoordinates(
            context = context,
            latitude = item.latitude,
            longitude = item.longitude,
            label = item.name.ifBlank { "Gathering Area" }
        )
        if (!opened) {
            infoMessage = "Could not open map application."
        }
    }

    fun openAreaDirections(item: GatheringAreaItem) {
        val opened = NephMapIntegration.openDirections(
            context = context,
            latitude = item.latitude,
            longitude = item.longitude,
            label = item.name.ifBlank { "Gathering Area" }
        )
        if (!opened) {
            infoMessage = "Directions are unavailable for this gathering area."
        }
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
            pendingViewport = viewport
        } else {
            viewportRequestSerial += 1
            nearbyResult = null
            selectedAreaId = null
            lastFetchedViewportKey = null
            errorMessage = ""
            loading = false
            backgroundUpdating = false
            infoMessage = ""
        }
    }

    val currentResult = nearbyResult
    val categoryOptions = remember(currentResult) {
        resolveCategoryOptions(currentResult)
    }
    val activeFilterKeys = if (categoryFilters.isEmpty() && categoryOptions.isNotEmpty()) {
        categoryOptions.map { it.key }.toSet()
    } else {
        categoryFilters
    }
    val visibleAreas = currentResult?.areas?.filter { item ->
        activeFilterKeys.contains(item.category.trim().lowercase())
    }.orEmpty()
    val isFilterEmpty = currentResult != null && currentResult.areas.isNotEmpty() && visibleAreas.isEmpty()
    val mapActionsEnabled = !loading && !backgroundUpdating

    if (selectedAreaId != null && visibleAreas.none { it.id == selectedAreaId }) {
        selectedAreaId = null
    }
    val selectedArea = visibleAreas.firstOrNull { it.id == selectedAreaId }
    val mapResult = currentResult ?: turkeyOverviewGatheringAreasResult()
    val mapEmptyMarkersMessage = gatheringAreasMapEmptyMessage(
        blockingLoading = loading,
        errorMessage = errorMessage,
        currentViewport = currentViewport,
        isFilterEmpty = isFilterEmpty,
        currentResult = currentResult
    )

    AppDrawerScaffold(
        title = "Gathering Areas",
        currentRoute = Routes.GatheringAreas.route,
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
                        text = "Location-based assembly points and shelters are retrieved from the gathering areas service.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    SecondaryButton(
                        text = "Refresh Visible Area",
                        onClick = {
                            val viewport = currentViewport
                            if (!isLeafletViewportDiscoverable(viewport)) {
                                errorMessage = ""
                                loading = false
                                infoMessage = ""
                                return@SecondaryButton
                            }
                            errorMessage = ""
                            pendingViewport = viewport
                            viewportRefreshNonce += 1
                        },
                        enabled = mapActionsEnabled
                    )
                }
            }

            GatheringAreasMapCard(
                result = mapResult,
                visibleAreas = if (currentResult == null) emptyList() else visibleAreas,
                selectedAreaId = selectedArea?.id,
                onAreaSelected = { selectedAreaId = it },
                onOpenAreaInMap = ::openAreaInMap,
                onGetDirections = ::openAreaDirections,
                emptyMarkersMessage = mapEmptyMarkersMessage,
                mapCenterLatitude = mapCenterLatitude,
                mapCenterLongitude = mapCenterLongitude,
                mapZoom = mapZoom,
                mapResetToken = mapResetNonce,
                showCenterMarker = false,
                loadingResources = loading,
                updatingResources = backgroundUpdating,
                onShowCurrentLocation = ::showCurrentLocationOnMap,
                showCurrentLocationEnabled = mapActionsEnabled,
                onViewportChanged = ::handleViewportChanged
            )

            when {
                nearbyResult == null -> {
                    Unit
                }

                isGatheringAreasProviderUnavailable(nearbyResult) -> {
                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                            SectionHeader(
                                title = "Gathering Area Provider Unavailable",
                                subtitle = ResourceProviderUnavailableMessage
                            )
                            if (isLeafletViewportDiscoverable(currentViewport)) {
                                SecondaryButton(
                                    text = "Retry",
                                    onClick = {
                                        pendingViewport = currentViewport
                                        viewportRefreshNonce += 1
                                    },
                                    enabled = mapActionsEnabled
                                )
                            }
                        }
                    }
                }

                nearbyResult?.areas?.isEmpty() == true -> {
                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                            SectionHeader(
                                title = "No Gathering Areas Found",
                                subtitle = "Try refreshing or using your current location for a different area."
                            )
                            if (isLeafletViewportDiscoverable(currentViewport)) {
                                SecondaryButton(
                                    text = "Retry",
                                    onClick = {
                                        pendingViewport = currentViewport
                                        viewportRefreshNonce += 1
                                    },
                                    enabled = mapActionsEnabled
                                )
                            }
                        }
                    }
                }

                else -> {
                    val result = nearbyResult ?: return@AppDrawerScaffold

                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                            Text(
                                text = "${result.returnedCount} areas within ${formatDistance(result.radiusMeters)}",
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.onSurface,
                                fontWeight = FontWeight.SemiBold
                            )

                            Text(
                                text = "Source: ${result.source.uppercase()} • Requested limit: ${result.requestedLimit}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            gatheringAreasResultHelperMessage(result).takeIf { it.isNotBlank() }?.let {
                                HelperText(text = it)
                            }
                        }
                    }

                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                            SectionHeader(
                                title = GatheringAreasVisibleCategoriesTitle,
                                subtitle = GatheringAreasVisibleCategoriesSubtitle
                            )
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(spacing.xs),
                                verticalArrangement = Arrangement.spacedBy(spacing.xs)
                            ) {
                                val categoryCounts = areaCountsByCategory(currentResult)
                                categoryOptions.forEach { category ->
                                    val selected = activeFilterKeys.contains(category.key)
                                    val count = categoryCounts[category.key] ?: 0
                                    FilterChip(
                                        selected = selected,
                                        onClick = {
                                            categoryFilters = if (selected) {
                                                activeFilterKeys - category.key
                                            } else {
                                                activeFilterKeys + category.key
                                            }
                                        },
                                        enabled = count > 0,
                                        label = { Text("${category.label} ($count)") }
                                    )
                                }
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                TextActionButton(
                                    text = GatheringAreasShowAllCategoriesText,
                                    onClick = {
                                        categoryFilters = categoryOptions.map { it.key }.toSet()
                                    }
                                )
                            }
                            if (isFilterEmpty) {
                                HelperText(text = ResourceFilterEmptyMessage)
                            }
                            GatheringAreasLegend(categoryOptions = categoryOptions)
                        }
                    }

                    visibleAreas.forEachIndexed { index, area ->
                        SectionCard {
                            Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                                Text(
                                    text = area.name.ifBlank { "Unnamed Gathering Area" },
                                    style = MaterialTheme.typography.titleMedium,
                                    color = MaterialTheme.colorScheme.onSurface
                                )

                                Text(
                                    text = "Category: ${area.categoryLabel}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )

                                Text(
                                    text = "Distance: ${formatDistance(area.distanceMeters)}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurface
                                )

                                area.addressLine?.takeIf { it.isNotBlank() }?.let { address ->
                                    Text(
                                        text = address,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }

                                if (area.id == selectedArea?.id) {
                                    HelperText(text = "Selected on map.")
                                }

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.End
                                ) {
                                    TextActionButton(
                                        text = "Get Directions",
                                        onClick = { openAreaDirections(area) }
                                    )
                                    TextActionButton(
                                        text = "Open in Map",
                                        onClick = { openAreaInMap(area) }
                                    )
                                }

                                if (index < visibleAreas.lastIndex) {
                                    Spacer(modifier = Modifier.height(spacing.xs))
                                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                                }
                            }
                        }
                    }
                }
            }

            if (errorMessage.isNotBlank()) {
                SectionCard {
                    Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                        HelperText(text = errorMessage)
                        if (isLeafletViewportDiscoverable(currentViewport)) {
                            SecondaryButton(
                                text = "Retry",
                                onClick = {
                                    pendingViewport = currentViewport
                                    viewportRefreshNonce += 1
                                },
                                enabled = mapActionsEnabled
                            )
                        }
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
private fun GatheringAreasMapCard(
    result: NearbyGatheringAreasResult,
    visibleAreas: List<GatheringAreaItem>,
    selectedAreaId: String?,
    onAreaSelected: (String) -> Unit,
    onOpenAreaInMap: (GatheringAreaItem) -> Unit,
    onGetDirections: (GatheringAreaItem) -> Unit,
    onViewportChanged: (LeafletMapViewport) -> Unit,
    emptyMarkersMessage: String = "No gathering area markers are available for this search center.",
    mapCenterLatitude: Double = result.centerLatitude,
    mapCenterLongitude: Double = result.centerLongitude,
    mapZoom: Int = 13,
    mapResetToken: Int = 0,
    showCenterMarker: Boolean = true,
    loadingResources: Boolean = false,
    updatingResources: Boolean = false,
    onShowCurrentLocation: (() -> Unit)? = null,
    showCurrentLocationEnabled: Boolean = true
) {
    val spacing = LocalNephSpacing.current
    val initializedInstanceIdState = remember { mutableStateOf<String?>(null) }
    val tileLoadedInstanceIdState = remember { mutableStateOf<String?>(null) }
    val errorInstanceIdState = remember { mutableStateOf<String?>(null) }
    var mapError by remember {
        mutableStateOf("")
    }
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

    fun markMapAlive(instanceId: String, source: String) {
        if (instanceId == currentMapInstanceIdState.value) {
            logMapDebug("native GatheringAreas initialized source=$source instance=$instanceId")
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
                "native GatheringAreas initialized ignored stale source=$source instance=$instanceId current=${currentMapInstanceIdState.value}"
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
            logMapDebug("native GatheringAreas timeout applied instance=$mapInstanceId")
            errorInstanceIdState.value = mapInstanceId
            mapError = LeafletMapInitializationTimeoutMessage
        } else {
            logMapDebug(
                "native GatheringAreas timeout ignored instance=$mapInstanceId current=${currentMapInstanceIdState.value} initialized=${initializedInstanceIdState.value} error=${errorInstanceIdState.value}"
            )
        }
    }

    val selectedArea = visibleAreas.firstOrNull { it.id == selectedAreaId }
    val markers = visibleAreas.map { area ->
        val markerStyle = categoryMarkerStyle(area.category)
        LeafletMapMarker(
            id = area.id,
            latitude = area.latitude,
            longitude = area.longitude,
            title = area.name.ifBlank { "Unnamed Gathering Area" },
            subtitle = "${area.categoryLabel} - ${formatDistance(area.distanceMeters)}",
            strokeColorHex = markerStyle.strokeHex,
            fillColorHex = markerStyle.fillHex
        )
    }

    SectionCard {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
            SectionHeader(
                title = "Gathering Areas Map",
                subtitle = if (markers.isEmpty()) {
                    "Map markers appear after a discoverable area loads."
                } else {
                    "Tap a marker to preview that gathering area."
                }
            )

            Box {
                LeafletMarkerMap(
                    mapInstanceId = mapInstanceId,
                    currentMapInstanceId = { currentMapInstanceIdState.value },
                    centerLatitude = mapCenterLatitude,
                    centerLongitude = mapCenterLongitude,
                    markers = markers,
                    selectedMarkerId = selectedAreaId,
                    mapHeightCssPx = GatheringAreasMapHeightCssPx,
                    zoom = mapZoom,
                    showCenterMarker = showCenterMarker,
                    fitBoundsToMarkers = false,
                    onMarkerSelected = { markerInstanceId, markerId ->
                        if (markerInstanceId == currentMapInstanceIdState.value) {
                            onAreaSelected(markerId)
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
                        .height(GatheringAreasMapHeightCssPx.dp)
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
                HelperText(
                    text = emptyMarkersMessage
                )
            }

            selectedArea?.let { area ->
                GatheringAreaMapSelectionPreview(
                    area = area,
                    onOpenAreaInMap = onOpenAreaInMap,
                    onGetDirections = onGetDirections
                )
            }
        }
    }
}

@Composable
private fun GatheringAreaMapSelectionPreview(
    area: GatheringAreaItem,
    onOpenAreaInMap: (GatheringAreaItem) -> Unit,
    onGetDirections: (GatheringAreaItem) -> Unit
) {
    val spacing = LocalNephSpacing.current

    Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
        Text(
            text = area.name.ifBlank { "Unnamed Gathering Area" },
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = "Category: ${area.categoryLabel}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = "Distance: ${formatDistance(area.distanceMeters)}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface
        )

        val address = area.addressLine?.takeIf { it.isNotBlank() }
        if (address != null) {
            Text(
                text = address,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
            TextActionButton(
                text = "Get Directions",
                onClick = { onGetDirections(area) }
            )
            TextActionButton(
                text = "Open in Map",
                onClick = { onOpenAreaInMap(area) }
            )
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun GatheringAreasLegend(categoryOptions: List<GatheringAreaCategoryMeta>) {
    if (categoryOptions.isEmpty()) return
    val spacing = LocalNephSpacing.current
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(spacing.sm),
        verticalArrangement = Arrangement.spacedBy(spacing.xs)
    ) {
        categoryOptions.forEach { option ->
            val style = categoryMarkerStyle(option.key)
            Text(
                text = "● ${option.label}",
                style = MaterialTheme.typography.bodySmall,
                color = style.dotColor
            )
        }
    }
}

private data class MarkerStyle(
    val strokeHex: String,
    val fillHex: String,
    val dotColor: Color
)

private fun categoryMarkerStyle(categoryKey: String): MarkerStyle {
    return when (categoryKey.trim().lowercase()) {
        "assembly_point" -> MarkerStyle("#B42318", "#EF4444", Color(0xFFDC2626))
        "shelter" -> MarkerStyle("#6D28D9", "#8B5CF6", Color(0xFF8B5CF6))
        "hospital" -> MarkerStyle("#A21CAF", "#D946EF", Color(0xFFD946EF))
        "police" -> MarkerStyle("#1D4ED8", "#3B82F6", Color(0xFF3B82F6))
        "fire_station" -> MarkerStyle("#C2410C", "#F97316", Color(0xFFF97316))
        "pharmacy" -> MarkerStyle("#15803D", "#22C55E", Color(0xFF22C55E))
        else -> MarkerStyle("#0F766E", "#14B8A6", Color(0xFF14B8A6))
    }
}

private fun resolveCategoryOptions(result: NearbyGatheringAreasResult?): List<GatheringAreaCategoryMeta> {
    if (result == null) return emptyList()
    val mapped = linkedMapOf<String, String>()
    result.categories.forEach { meta ->
        val key = meta.key.trim().lowercase()
        if (key.isNotBlank()) mapped[key] = meta.label
    }
    result.areas.forEach { item ->
        val key = item.category.trim().lowercase()
        if (key.isNotBlank() && !mapped.containsKey(key)) {
            mapped[key] = item.categoryLabel
        }
    }
    return mapped.entries.map { (key, label) ->
        GatheringAreaCategoryMeta(key = key, label = label)
    }
}

private fun areaCountsByCategory(result: NearbyGatheringAreasResult?): Map<String, Int> {
    if (result == null) return emptyMap()
    return result.areas
        .groupingBy { it.category.trim().lowercase() }
        .eachCount()
}

private fun turkeyOverviewGatheringAreasResult(): NearbyGatheringAreasResult {
    return NearbyGatheringAreasResult(
        centerLatitude = TurkeyOverviewLatitude,
        centerLongitude = TurkeyOverviewLongitude,
        radiusMeters = 0,
        source = "overview",
        requestedLimit = 0,
        returnedCount = 0,
        skippedCount = 0,
        providerErrorCode = null,
        stale = false,
        fallbackReason = null,
        categories = emptyList(),
        areas = emptyList()
    )
}

private fun formatDistance(distanceMeters: Int): String {
    if (distanceMeters >= 1000) {
        return String.format(Locale.US, "%.1f km", distanceMeters / 1000.0)
    }

    return "$distanceMeters m"
}

private fun isProviderError(error: ApiException): Boolean {
    return isProviderTimeout(error) || isProviderUnavailable(error)
}

private fun isProviderTimeout(error: ApiException): Boolean {
    return error.code == "OVERPASS_TIMEOUT" || error.status == 504
}

private fun isProviderUnavailable(error: ApiException): Boolean {
    return error.code == "OVERPASS_UNAVAILABLE" || error.status == 503
}

internal fun mapGatheringAreasErrorMessage(error: ApiException): String {
    return when {
        isProviderTimeout(error) -> "Gathering area lookup timed out. Please try again."
        isProviderUnavailable(error) -> "Nearby gathering areas could not be loaded right now. Please try again later."
        else -> error.message.ifBlank { "Could not load gathering areas right now." }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun GatheringAreasScreenPreview() {
    NephTheme {
        GatheringAreasScreen(
            onNavigateToRoute = {},
            onOpenSettings = {},
            onProfileClick = {},
            profileBadgeText = "PP",
            isAuthenticated = true
        )
    }
}
