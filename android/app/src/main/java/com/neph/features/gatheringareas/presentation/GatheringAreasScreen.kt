package com.neph.features.gatheringareas.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import com.neph.ui.map.NephMapIntegration
import com.neph.ui.map.isLeafletMapInitializedForInstance
import com.neph.ui.map.isLeafletTileLoadedSignal
import com.neph.ui.map.leafletMapErrorForInstance
import com.neph.ui.map.logMapDebug
import com.neph.ui.map.newLeafletMapInstanceId
import com.neph.ui.map.shouldApplyLeafletMapError
import com.neph.ui.map.shouldApplyLeafletMapTimeout
import com.neph.ui.map.shouldClearLeafletMapErrorForSignal
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale

private enum class GatheringAreasSearchOrigin {
    CURRENT_LOCATION,
    OTHER
}

private const val GatheringAreasMapHeightCssPx = 280
private const val TurkeyOverviewLatitude = 39.0
private const val TurkeyOverviewLongitude = 35.0
private const val TurkeyOverviewZoom = 5
internal const val GatheringAreasVisibleCategoriesTitle = "Visible Categories"
internal const val GatheringAreasVisibleCategoriesSubtitle =
    "Selected categories are shown on the map and in the list."
internal const val GatheringAreasShowAllCategoriesText = "Show All Categories"

internal data class GatheringAreaMapMarkerKey(
    val id: String,
    val latitude: Double,
    val longitude: Double
)

internal data class GatheringAreasMapInstanceKey(
    val centerLatitude: Double,
    val centerLongitude: Double,
    val markers: List<GatheringAreaMapMarkerKey>
)

internal fun gatheringAreasMapInstanceKey(
    result: NearbyGatheringAreasResult,
    visibleAreas: List<GatheringAreaItem>
): GatheringAreasMapInstanceKey {
    return GatheringAreasMapInstanceKey(
        centerLatitude = result.centerLatitude,
        centerLongitude = result.centerLongitude,
        markers = visibleAreas.map { area ->
            GatheringAreaMapMarkerKey(
                id = area.id,
                latitude = area.latitude,
                longitude = area.longitude
            )
        }
    )
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
fun GatheringAreasScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: (() -> Unit)?,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    isAuthenticated: Boolean
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }
    var infoMessage by remember { mutableStateOf("") }
    var sourceLabel by remember { mutableStateOf("") }
    var lastCenterLatitude by remember { mutableStateOf<Double?>(null) }
    var lastCenterLongitude by remember { mutableStateOf<Double?>(null) }
    var lastSearchOrigin by remember { mutableStateOf<GatheringAreasSearchOrigin?>(null) }
    var nearbyResult by remember { mutableStateOf<NearbyGatheringAreasResult?>(null) }
    var selectedAreaId by remember { mutableStateOf<String?>(null) }
    var categoryFilters by remember { mutableStateOf<Set<String>>(emptySet()) }
    val hasSearchCenter = lastCenterLatitude != null && lastCenterLongitude != null

    fun fetchGatheringAreas(
        lat: Double,
        lon: Double,
        label: String,
        origin: GatheringAreasSearchOrigin
    ) {
        val normalizedLabel = label.ifBlank { "selected location" }
        sourceLabel = normalizedLabel
        lastCenterLatitude = lat
        lastCenterLongitude = lon
        lastSearchOrigin = origin

        scope.launch {
            loading = true
            errorMessage = ""
            infoMessage = ""

            try {
                val result = GatheringAreasRepository.fetchNearbyGatheringAreas(
                    latitude = lat,
                    longitude = lon
                )
                nearbyResult = result
                sourceLabel = normalizedLabel
                lastCenterLatitude = result.centerLatitude
                lastCenterLongitude = result.centerLongitude
                selectedAreaId = selectedAreaId
                    ?.takeIf { selected -> result.areas.any { it.id == selected } }
                    ?: result.areas.firstOrNull()?.id
                categoryFilters = resolveCategoryOptions(result).map { it.key }.toSet()

                if (result.areas.isEmpty()) {
                    infoMessage = "No gathering areas were found in this area."
                } else if (result.skippedCount > 0) {
                    infoMessage = "${result.skippedCount} malformed area entries were skipped safely."
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (error: ApiException) {
                errorMessage = mapGatheringAreasErrorMessage(error)
                if (origin == GatheringAreasSearchOrigin.CURRENT_LOCATION && isProviderError(error)) {
                    infoMessage = "Current location detected. Nearby gathering areas could not be loaded right now."
                }
            } catch (_: Exception) {
                errorMessage = "Could not load gathering areas right now."
            } finally {
                loading = false
            }
        }
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
                    fetchGatheringAreas(
                        lat = location.latitude,
                        lon = location.longitude,
                        label = "your current location",
                        origin = GatheringAreasSearchOrigin.CURRENT_LOCATION
                    )
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

    val locationPermissionRequester = rememberForegroundLocationPermissionRequester { result ->
        if (result.granted) {
            requestCurrentLocationAndRefresh()
        } else {
            errorMessage = ""
            loading = false
            infoMessage = "Location permission was denied. Nearby results were not updated."
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

    if (selectedAreaId != null && visibleAreas.none { it.id == selectedAreaId }) {
        selectedAreaId = null
    }

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
        profileLabel = if (isAuthenticated) "Profile" else "Login / Create Account"
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

                    if (hasSearchCenter && lastCenterLatitude != null && lastCenterLongitude != null) {
                        HelperText(
                            text = "Showing results around $sourceLabel."
                        )
                    } else {
                        HelperText(text = "Use your current location to find nearby gathering areas.")
                    }

                    SecondaryButton(
                        text = "Use Current Location",
                        onClick = {
                            if (locationPermissionRequester.refreshPermissionState()) {
                                requestCurrentLocationAndRefresh()
                            } else {
                                locationPermissionRequester.requestPermission()
                            }
                        },
                        enabled = !loading
                    )

                    SecondaryButton(
                        text = "Refresh Nearby Areas",
                        onClick = {
                            val lat = lastCenterLatitude ?: return@SecondaryButton
                            val lon = lastCenterLongitude ?: return@SecondaryButton
                            fetchGatheringAreas(
                                lat = lat,
                                lon = lon,
                                label = sourceLabel,
                                origin = lastSearchOrigin ?: GatheringAreasSearchOrigin.OTHER
                            )
                        },
                        enabled = !loading && hasSearchCenter
                    )
                }
            }

            when {
                loading -> {
                    SectionCard {
                        HelperText(text = "Loading nearby gathering areas...")
                    }
                }

                errorMessage.isNotBlank() -> {
                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                            HelperText(text = errorMessage)
                            if (hasSearchCenter && lastCenterLatitude != null && lastCenterLongitude != null) {
                                SecondaryButton(
                                    text = "Retry",
                                    onClick = {
                                        fetchGatheringAreas(
                                            lat = lastCenterLatitude!!,
                                            lon = lastCenterLongitude!!,
                                            label = sourceLabel,
                                            origin = lastSearchOrigin ?: GatheringAreasSearchOrigin.OTHER
                                        )
                                    }
                                )
                            }
                        }
                    }
                }

                !hasSearchCenter -> {
                    GatheringAreasMapCard(
                        result = turkeyOverviewGatheringAreasResult(),
                        visibleAreas = emptyList(),
                        selectedAreaId = null,
                        onAreaSelected = { selectedAreaId = it },
                        onOpenAreaInMap = ::openAreaInMap,
                        onGetDirections = ::openAreaDirections,
                        emptyMarkersMessage = "Use your device location to find nearby gathering areas.",
                        emptyMapSubtitle = "Turkey overview. Nearby markers will appear after using your device location.",
                        mapZoom = TurkeyOverviewZoom,
                        showCenterMarker = false
                    )
                }

                nearbyResult?.areas?.isEmpty() == true -> {
                    val result = nearbyResult ?: return@AppDrawerScaffold

                    GatheringAreasMapCard(
                        result = result,
                        visibleAreas = emptyList(),
                        selectedAreaId = null,
                        onAreaSelected = { selectedAreaId = it },
                        onOpenAreaInMap = ::openAreaInMap,
                        onGetDirections = ::openAreaDirections
                    )

                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                            SectionHeader(
                                title = "No Gathering Areas Found",
                                subtitle = "Try refreshing or using your current location for a different area."
                            )
                            if (hasSearchCenter && lastCenterLatitude != null && lastCenterLongitude != null) {
                                SecondaryButton(
                                    text = "Retry",
                                    onClick = {
                                        fetchGatheringAreas(
                                            lat = lastCenterLatitude!!,
                                            lon = lastCenterLongitude!!,
                                            label = sourceLabel,
                                            origin = lastSearchOrigin ?: GatheringAreasSearchOrigin.OTHER
                                        )
                                    }
                                )
                            }
                        }
                    }
                }

                else -> {
                    val result = nearbyResult ?: return@AppDrawerScaffold
                    val selectedArea = visibleAreas.firstOrNull { it.id == selectedAreaId }

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

                            if (result.skippedCount > 0) {
                                HelperText(text = "${result.skippedCount} malformed provider entries were skipped.")
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
                                HelperText(text = "No results match the selected categories.")
                            }
                            GatheringAreasLegend(categoryOptions = categoryOptions)
                        }
                    }

                    GatheringAreasMapCard(
                        result = result,
                        visibleAreas = visibleAreas,
                        selectedAreaId = selectedArea?.id,
                        onAreaSelected = { selectedAreaId = it },
                        onOpenAreaInMap = ::openAreaInMap,
                        onGetDirections = ::openAreaDirections
                    )

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
    emptyMarkersMessage: String = "No gathering area markers are available for this search center.",
    emptyMapSubtitle: String = "Showing the searched area. No gathering area markers were returned.",
    mapZoom: Int = 13,
    showCenterMarker: Boolean = true
) {
    val spacing = LocalNephSpacing.current
    val initializedInstanceIdState = remember { mutableStateOf<String?>(null) }
    val tileLoadedInstanceIdState = remember { mutableStateOf<String?>(null) }
    val errorInstanceIdState = remember { mutableStateOf<String?>(null) }
    var mapError by remember {
        mutableStateOf("")
    }
    val mapInstanceKey = gatheringAreasMapInstanceKey(result, visibleAreas)
    val mapInstanceId = remember(mapInstanceKey) {
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
                    emptyMapSubtitle
                } else {
                    "Tap a marker to preview that gathering area."
                }
            )

            LeafletMarkerMap(
                mapInstanceId = mapInstanceId,
                currentMapInstanceId = { currentMapInstanceIdState.value },
                centerLatitude = result.centerLatitude,
                centerLongitude = result.centerLongitude,
                markers = markers,
                selectedMarkerId = selectedAreaId,
                mapHeightCssPx = GatheringAreasMapHeightCssPx,
                zoom = mapZoom,
                showCenterMarker = showCenterMarker,
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
                modifier = Modifier
                    .fillMaxWidth()
                    .height(GatheringAreasMapHeightCssPx.dp)
            )

            if (!activeMapInitialized && activeMapError.isBlank()) {
                HelperText(text = "Loading map...")
            }

            if (activeMapError.isNotBlank()) {
                HelperText(text = activeMapError)
            }

            if (markers.isEmpty()) {
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
