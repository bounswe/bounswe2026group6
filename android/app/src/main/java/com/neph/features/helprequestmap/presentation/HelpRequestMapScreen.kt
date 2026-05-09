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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.neph.core.network.ApiException
import com.neph.features.helprequestmap.data.ActiveHelpRequestMapItem
import com.neph.features.helprequestmap.data.ActiveHelpRequestsRepository
import com.neph.features.helprequestmap.data.CrisisRequestType
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.map.LeafletMapInitializationTimeoutMessage
import com.neph.ui.map.LeafletMapInitializationTimeoutMillis
import com.neph.ui.map.LeafletMapMarker
import com.neph.ui.map.LeafletMarkerMap
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

private const val HelpRequestMapHeightCssPx = 280
private const val TurkeyOverviewLatitude = 39.0
private const val TurkeyOverviewLongitude = 35.0
private const val TurkeyOverviewZoom = 5

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
    val centerLongitude: Double,
    val markers: List<LeafletMapMarker>
)

internal fun helpRequestMapCenter(
    requests: List<ActiveHelpRequestMapItem>
): HelpRequestMapCenter {
    if (requests.isEmpty()) {
        return HelpRequestMapCenter(
            latitude = TurkeyOverviewLatitude,
            longitude = TurkeyOverviewLongitude
        )
    }

    return HelpRequestMapCenter(
        latitude = requests.sumOf { it.latitude } / requests.size,
        longitude = requests.sumOf { it.longitude } / requests.size
    )
}

internal fun helpRequestLeafletMarkers(
    requests: List<ActiveHelpRequestMapItem>
): List<LeafletMapMarker> {
    return requests.map { request ->
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
        centerLongitude = center.longitude,
        markers = helpRequestLeafletMarkers(requests)
    )
}

@Composable
fun HelpRequestMapScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: (() -> Unit)?,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    isAuthenticated: Boolean
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var loading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf("") }
    var infoMessage by remember { mutableStateOf("") }
    var requests by remember { mutableStateOf(emptyList<ActiveHelpRequestMapItem>()) }
    var selectedRequestId by remember { mutableStateOf<String?>(null) }
    var selectedTypes by remember { mutableStateOf(setOf<CrisisRequestType>()) }

    fun loadWaitingRequests() {
        scope.launch {
            loading = true
            errorMessage = ""
            infoMessage = ""

            try {
                val result = ActiveHelpRequestsRepository.fetchWaitingHelpRequests()
                requests = result.requests
                selectedRequestId = when {
                    result.requests.isEmpty() -> null
                    selectedRequestId != null && result.requests.any { it.requestId == selectedRequestId } -> selectedRequestId
                    else -> null
                }

                if (result.requests.isEmpty()) {
                    infoMessage = "No waiting help requests are available right now."
                } else if (result.skippedCount > 0) {
                    infoMessage = "${result.skippedCount} inactive or malformed request entries were hidden."
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (error: ApiException) {
                errorMessage = error.message.ifBlank {
                    "Could not load waiting help requests."
                }
                requests = emptyList()
                selectedRequestId = null
            } catch (_: Exception) {
                errorMessage = "Could not load waiting help requests."
                requests = emptyList()
                selectedRequestId = null
            } finally {
                loading = false
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

    LaunchedEffect(Unit) {
        loadWaitingRequests()
    }

    val visibleRequests = filterVisibleRequests(requests, selectedTypes)

    LaunchedEffect(visibleRequests, selectedRequestId) {
        selectedRequestId = reconcileSelectedRequestId(selectedRequestId, visibleRequests)
    }

    val selectedRequest = visibleRequests.firstOrNull { it.requestId == selectedRequestId }
    val isFilterEmpty = !loading && requests.isNotEmpty() && visibleRequests.isEmpty()

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
        profileLabel = if (isAuthenticated) "Profile" else "Login / Create Account"
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
                        onClick = { loadWaitingRequests() },
                        enabled = !loading
                    )
                }
            }

            when {
                loading -> {
                    SectionCard {
                        HelperText(text = "Loading waiting help requests...")
                    }
                }

                errorMessage.isNotBlank() -> {
                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                            HelperText(text = errorMessage)
                            SecondaryButton(
                                text = "Retry",
                                onClick = { loadWaitingRequests() }
                            )
                        }
                    }
                }

                requests.isEmpty() -> {
                    SectionCard {
                        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                            SectionHeader(
                                title = "No Waiting Requests",
                                subtitle = "There are no waiting help requests to show on the map right now."
                            )
                            SecondaryButton(
                                text = "Retry",
                                onClick = { loadWaitingRequests() }
                            )
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
                        CrisisRequestMapPanel(
                            requests = visibleRequests,
                            selectedRequestId = selectedRequest?.requestId,
                            onSelectRequest = { selectedRequestId = it }
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
                    HelperText(text = "No help requests match the selected request type filters.")
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

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
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
                    text = "Priority: ${ActiveHelpRequestsRepository.formatPriority(item.priorityLevel)} | ${item.district}",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (selected) {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }
            TextActionButton(text = "Get Directions", onClick = onGetDirections)
            TextActionButton(text = "Open", onClick = onOpenMap)
        }
        Spacer(modifier = Modifier.height(spacing.sm))
    }
}

@Composable
private fun CrisisRequestMapPanel(
    requests: List<ActiveHelpRequestMapItem>,
    selectedRequestId: String?,
    onSelectRequest: (String) -> Unit
) {
    val spacing = LocalNephSpacing.current
    val initializedInstanceIdState = remember { mutableStateOf<String?>(null) }
    val tileLoadedInstanceIdState = remember { mutableStateOf<String?>(null) }
    val errorInstanceIdState = remember { mutableStateOf<String?>(null) }
    var mapError by remember { mutableStateOf("") }
    val mapInstanceKey = helpRequestMapInstanceKey(requests)
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
    val selectedRequest = requests.firstOrNull { it.requestId == selectedRequestId }
    val markers = mapInstanceKey.markers

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
                "No request markers match the selected filters."
            } else {
                "Tap a marker to preview that help request."
            }
        )

        LeafletMarkerMap(
            mapInstanceId = mapInstanceId,
            currentMapInstanceId = { currentMapInstanceIdState.value },
            centerLatitude = mapInstanceKey.centerLatitude,
            centerLongitude = mapInstanceKey.centerLongitude,
            markers = markers,
            selectedMarkerId = selectedRequestId,
            mapHeightCssPx = HelpRequestMapHeightCssPx,
            zoom = if (markers.isEmpty()) TurkeyOverviewZoom else 13,
            showCenterMarker = false,
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
            modifier = Modifier
                .fillMaxWidth()
                .height(HelpRequestMapHeightCssPx.dp)
        )

        if (!activeMapInitialized && activeMapError.isBlank()) {
            HelperText(text = "Loading map...")
        }

        if (activeMapError.isNotBlank()) {
            HelperText(text = activeMapError)
        }

        if (markers.isEmpty()) {
            HelperText(text = "No help request markers are available for the selected filters.")
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
