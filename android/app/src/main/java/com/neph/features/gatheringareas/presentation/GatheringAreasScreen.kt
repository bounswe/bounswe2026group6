package com.neph.features.gatheringareas.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import com.neph.core.network.ApiException
import com.neph.features.gatheringareas.data.GatheringAreaItem
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
import com.neph.ui.map.NephMapIntegration
import com.neph.ui.map.formatMapCoordinate
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.util.Locale

private enum class GatheringAreasSearchOrigin {
    CURRENT_LOCATION,
    OTHER
}

@Composable
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

    AppDrawerScaffold(
        title = "Gathering Areas",
        currentRoute = Routes.GatheringAreas.route,
        onNavigateToRoute = onNavigateToRoute,
        drawerItems = if (isAuthenticated) {
            Routes.authenticatedDrawerItems
        } else {
            Routes.guestDrawerItems
        },
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = if (isAuthenticated) "Profile" else "Login / Create Account"
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(spacing.lg),
            modifier = Modifier.verticalScroll(rememberScrollState())
        ) {
            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(
                        title = "Nearby Gathering Areas",
                        subtitle = "Location-based assembly points and shelters are retrieved from the gathering areas service."
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

                    result.areas.forEachIndexed { index, area ->
                        SectionCard {
                            Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                                Text(
                                    text = area.name.ifBlank { "Unnamed Gathering Area" },
                                    style = MaterialTheme.typography.titleMedium,
                                    color = MaterialTheme.colorScheme.onSurface
                                )

                                Text(
                                    text = "Category: ${formatCategory(area.category)}",
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

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.End
                                ) {
                                    TextActionButton(
                                        text = "Open in Map",
                                        onClick = { openAreaInMap(area) }
                                    )
                                }

                                if (index < result.areas.lastIndex) {
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

private fun formatDistance(distanceMeters: Int): String {
    if (distanceMeters >= 1000) {
        return String.format(Locale.US, "%.1f km", distanceMeters / 1000.0)
    }

    return "$distanceMeters m"
}

private fun formatCategory(category: String): String {
    return when (category.trim().lowercase()) {
        "assembly_point" -> "Assembly Point"
        "shelter" -> "Shelter"
        else -> category.replace('_', ' ').replaceFirstChar { it.uppercase() }
    }
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
