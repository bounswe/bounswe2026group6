package com.neph.features.gatheringareas.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import com.neph.ui.map.formatMapCoordinate
import com.neph.ui.map.newLeafletMapInstanceId
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
                selectedAreaId = result.areas.firstOrNull()?.id
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
        selectedAreaId = visibleAreas.firstOrNull()?.id
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
                            text = "Showing results around $sourceLabel (${formatMapCoordinate(lastCenterLatitude!!)}, ${formatMapCoordinate(lastCenterLongitude!!)})."
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
                    SectionCard {
                        SectionHeader(
                            title = "No Search Location Selected",
                            subtitle = "No search location selected yet. Tap \"Use Current Location\" to search nearby gathering areas."
                        )
                    }
                }

                nearbyResult?.areas?.isEmpty() == true -> {
                    val result = nearbyResult ?: return@AppDrawerScaffold

                    GatheringAreasMapCard(
                        result = result,
                        visibleAreas = emptyList(),
                        selectedAreaId = null,
                        onAreaSelected = { selectedAreaId = it },
                        onOpenAreaInMap = ::openAreaInMap
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
                        ?: visibleAreas.firstOrNull()

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
                                title = "Category Filters",
                                subtitle = "Select one or more categories to filter map markers and list results."
                            )
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(spacing.xs),
                                verticalArrangement = Arrangement.spacedBy(spacing.xs)
                            ) {
                                categoryOptions.forEach { category ->
                                    val selected = activeFilterKeys.contains(category.key)
                                    FilterChip(
                                        selected = selected,
                                        onClick = {
                                            categoryFilters = if (selected) {
                                                activeFilterKeys - category.key
                                            } else {
                                                activeFilterKeys + category.key
                                            }
                                        },
                                        label = { Text(category.label) }
                                    )
                                }
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                TextActionButton(
                                    text = "Clear Filters",
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
                        onOpenAreaInMap = ::openAreaInMap
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

                                Text(
                                    text = "Coordinates: ${formatMapCoordinate(area.latitude)}, ${formatMapCoordinate(area.longitude)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )

                                area.addressLine?.takeIf { it.isNotBlank() }?.let { address ->
                                    Text(
                                        text = "Address: $address",
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
    onOpenAreaInMap: (GatheringAreaItem) -> Unit
) {
    val spacing = LocalNephSpacing.current
    var mapReady by remember(result.centerLatitude, result.centerLongitude, visibleAreas, selectedAreaId) {
        mutableStateOf(false)
    }
    var mapError by remember(result.centerLatitude, result.centerLongitude, visibleAreas, selectedAreaId) {
        mutableStateOf("")
    }
    val mapInstanceId = remember(result.centerLatitude, result.centerLongitude, visibleAreas, selectedAreaId) {
        newLeafletMapInstanceId()
    }
    val currentMapInstanceIdState = remember { mutableStateOf(mapInstanceId) }
    currentMapInstanceIdState.value = mapInstanceId

    LaunchedEffect(mapInstanceId, mapReady, mapError) {
        if (mapReady || mapError.isNotBlank()) {
            return@LaunchedEffect
        }
        delay(LeafletMapInitializationTimeoutMillis)
        if (
            currentMapInstanceIdState.value == mapInstanceId &&
            !mapReady &&
            mapError.isBlank()
        ) {
            mapError = LeafletMapInitializationTimeoutMessage
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
                    "Showing the searched area. No gathering area markers were returned."
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
                onMarkerSelected = { markerInstanceId, markerId ->
                    if (markerInstanceId == currentMapInstanceIdState.value) {
                        onAreaSelected(markerId)
                    }
                },
                onMapReady = { readyInstanceId ->
                    if (readyInstanceId == currentMapInstanceIdState.value) {
                        mapReady = true
                        mapError = ""
                    }
                },
                onMapError = { errorInstanceId, message ->
                    if (errorInstanceId == currentMapInstanceIdState.value) {
                        mapError = message.ifBlank { "Map failed to load. Check your connection and try again." }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(GatheringAreasMapHeightCssPx.dp)
            )

            if (!mapReady && mapError.isBlank()) {
                HelperText(text = "Loading map...")
            }

            if (!mapReady && mapError.isNotBlank()) {
                HelperText(text = mapError)
            }

            if (markers.isEmpty()) {
                HelperText(
                    text = "No gathering area markers are available for this search center."
                )
            }

            selectedArea?.let { area ->
                GatheringAreaMapSelectionPreview(
                    area = area,
                    onOpenAreaInMap = onOpenAreaInMap
                )
            }
        }
    }
}

@Composable
private fun GatheringAreaMapSelectionPreview(
    area: GatheringAreaItem,
    onOpenAreaInMap: (GatheringAreaItem) -> Unit
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
        Text(
            text = address ?: "Coordinates: ${formatMapCoordinate(area.latitude)}, ${formatMapCoordinate(area.longitude)}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
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
        "assembly_point" -> MarkerStyle("#C73D2A", "#E35F4F", Color(0xFFE35F4F))
        "shelter" -> MarkerStyle("#D08A1F", "#F3B545", Color(0xFFF3B545))
        "hospital" -> MarkerStyle("#B91C1C", "#EF4444", Color(0xFFEF4444))
        "police" -> MarkerStyle("#1E40AF", "#3B82F6", Color(0xFF3B82F6))
        "fire_station" -> MarkerStyle("#9A3412", "#F97316", Color(0xFFF97316))
        "pharmacy" -> MarkerStyle("#166534", "#22C55E", Color(0xFF22C55E))
        else -> MarkerStyle("#2B7FC8", "#4DA2EA", Color(0xFF4DA2EA))
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
