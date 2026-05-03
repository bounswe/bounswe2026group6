package com.neph.features.helprequestmap.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.IntOffset
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
import com.neph.ui.map.NephMapIntegration
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

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
                    else -> result.requests.first().requestId
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

    LaunchedEffect(Unit) {
        loadWaitingRequests()
    }

    val selectedRequest = requests.firstOrNull { it.requestId == selectedRequestId } ?: requests.firstOrNull()

    AppDrawerScaffold(
        title = "Help Request Map",
        currentRoute = Routes.HelpRequestMap.route,
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
                        title = "Help Request Map",
                        subtitle = "Showing waiting help requests by type and priority."
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
                        CrisisRequestMapPanel(
                            requests = requests,
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
                                    onOpenMap = { openRequestInMap(selectedRequest) }
                                )
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

                            requests.forEachIndexed { index, item ->
                                RequestListItem(
                                    item = item,
                                    selected = item.requestId == selectedRequest?.requestId,
                                    onSelect = { selectedRequestId = item.requestId },
                                    onOpenMap = { openRequestInMap(item) }
                                )

                                if (index < requests.lastIndex) {
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
private fun RequestDetails(
    item: ActiveHelpRequestMapItem,
    onOpenMap: () -> Unit
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
    onOpenMap: () -> Unit
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
    var zoom by remember { mutableStateOf(1f) }
    var panX by remember { mutableStateOf(0f) }
    var panY by remember { mutableStateOf(0f) }
    val minLatitude = requests.minOfOrNull { it.latitude } ?: 0.0
    val maxLatitude = requests.maxOfOrNull { it.latitude } ?: minLatitude
    val minLongitude = requests.minOfOrNull { it.longitude } ?: 0.0
    val maxLongitude = requests.maxOfOrNull { it.longitude } ?: minLongitude
    val latSpan = (maxLatitude - minLatitude).takeIf { it > 0.000001 } ?: 0.01
    val lonSpan = (maxLongitude - minLongitude).takeIf { it > 0.000001 } ?: 0.01
    val selectedRequest = requests.firstOrNull { it.requestId == selectedRequestId }
    val density = LocalDensity.current

    Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
        SectionHeader(
            title = "Live Crisis Map",
            subtitle = "Pinch or drag the map, then tap a marker to see request details."
        )

        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1.18f)
                .clip(RoundedCornerShape(20.dp))
                .background(
                    Brush.linearGradient(
                        listOf(
                            Color(0xFFE2ECE8),
                            Color(0xFFDDE7EF),
                            Color(0xFFECE6D8)
                        )
                    )
                )
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(20.dp))
                .pointerInput(Unit) {
                    detectTransformGestures { _, pan, gestureZoom, _ ->
                        val nextZoom = (zoom * gestureZoom).coerceIn(1f, 2.6f)
                        zoom = nextZoom
                        panX = (panX + pan.x).coerceIn(-220f * nextZoom, 220f * nextZoom)
                        panY = (panY + pan.y).coerceIn(-220f * nextZoom, 220f * nextZoom)
                    }
                }
        ) {
            val availableHeight = maxHeight
            val availableWidth = maxWidth
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(availableHeight)
                    .graphicsLayer {
                        scaleX = zoom
                        scaleY = zoom
                        translationX = panX
                        translationY = panY
                    }
            ) {
                MapRoad(
                    modifier = Modifier
                        .offset { IntOffset(0, (availableHeight * 0.22f).roundToPx()) }
                        .fillMaxWidth()
                        .height(12.dp)
                )
                MapRoad(
                    modifier = Modifier
                        .offset { IntOffset(0, (availableHeight * 0.58f).roundToPx()) }
                        .fillMaxWidth()
                        .height(9.dp)
                )
                MapRoad(
                    modifier = Modifier
                        .offset { IntOffset((availableWidth * 0.30f).roundToPx(), 0) }
                        .size(11.dp, availableHeight)
                )
                MapRoad(
                    modifier = Modifier
                        .offset { IntOffset((availableWidth * 0.70f).roundToPx(), 0) }
                        .size(8.dp, availableHeight)
                )
                MapNeighborhoodPatch(
                    modifier = Modifier
                        .offset {
                            IntOffset(
                                (availableWidth * 0.08f).roundToPx(),
                                (availableHeight * 0.10f).roundToPx()
                            )
                        }
                        .size(width = availableWidth * 0.24f, height = availableHeight * 0.18f)
                )
                MapNeighborhoodPatch(
                    modifier = Modifier
                        .offset {
                            IntOffset(
                                (availableWidth * 0.58f).roundToPx(),
                                (availableHeight * 0.68f).roundToPx()
                            )
                        }
                        .size(width = availableWidth * 0.28f, height = availableHeight * 0.16f)
                )

                requests.forEach { item ->
                    val xFraction = ((item.longitude - minLongitude) / lonSpan).coerceIn(0.08, 0.92)
                    val yFraction = (1.0 - ((item.latitude - minLatitude) / latSpan)).coerceIn(0.10, 0.88)
                    val x = with(density) {
                        (availableWidth * xFraction.toFloat()).roundToPx()
                    } - 21
                    val y = with(density) {
                        (availableHeight * yFraction.toFloat()).roundToPx()
                    } - 42

                    MapMarker(
                        item = item,
                        selected = item.requestId == selectedRequestId,
                        modifier = Modifier.offset { IntOffset(x, y) },
                        onClick = { onSelectRequest(item.requestId) }
                    )
                }
            }

            if (selectedRequest != null) {
                MapTooltip(
                    item = selectedRequest,
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(spacing.md)
                )
            }
        }
    }
}

@Composable
private fun MapRoad(modifier: Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Color.White.copy(alpha = 0.72f))
            .border(1.dp, Color(0xFFC8D4D8).copy(alpha = 0.70f), RoundedCornerShape(999.dp))
    )
}

@Composable
private fun MapNeighborhoodPatch(modifier: Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White.copy(alpha = 0.32f))
            .border(1.dp, Color.White.copy(alpha = 0.45f), RoundedCornerShape(18.dp))
    )
}

@Composable
private fun MapTooltip(
    item: ActiveHelpRequestMapItem,
    modifier: Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.94f))
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Text(
            text = item.typeLabel,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = "Priority: ${ActiveHelpRequestsRepository.formatPriority(item.priorityLevel)}",
            style = MaterialTheme.typography.labelMedium,
            color = priorityColor(item.priorityLevel)
        )
        Text(
            text = "${item.district}, ${item.city}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun MapMarker(
    item: ActiveHelpRequestMapItem,
    selected: Boolean,
    modifier: Modifier,
    onClick: () -> Unit
) {
    Column(
        modifier = modifier
            .semantics {
                contentDescription = "Crisis marker ${item.typeLabel}"
            }
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        PinGlyph(type = item.type, selected = selected)
        Box(
            modifier = Modifier
                .padding(top = 3.dp)
                .size(width = 16.dp, height = 5.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(Color.Black.copy(alpha = if (selected) 0.30f else 0.18f))
        )
    }
}

@Composable
private fun PinGlyph(type: CrisisRequestType, selected: Boolean = false) {
    val style = markerStyle(type)

    Box(
        modifier = Modifier
            .size(if (selected) 40.dp else 34.dp)
            .background(style.color, RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp, bottomEnd = 14.dp, bottomStart = 5.dp))
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

private data class MarkerStyle(
    val color: Color,
    val glyph: String
)

private fun markerStyle(type: CrisisRequestType): MarkerStyle {
    return when (type) {
        CrisisRequestType.SHELTER -> MarkerStyle(Color(0xFF3B66D8), "SH")
        CrisisRequestType.FIRST_AID -> MarkerStyle(Color(0xFFD94141), "+")
        CrisisRequestType.SEARCH_AND_RESCUE -> MarkerStyle(Color(0xFFF08C00), "SR")
        CrisisRequestType.FOOD_WATER -> MarkerStyle(Color(0xFF2F9E67), "FW")
        CrisisRequestType.OTHER -> MarkerStyle(Color(0xFF687280), "?")
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
