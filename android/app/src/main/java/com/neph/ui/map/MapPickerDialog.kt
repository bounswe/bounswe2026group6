package com.neph.ui.map

import android.annotation.SuppressLint
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.theme.LocalNephSpacing
import java.util.Locale

data class MapPickerSelection(
    val latitude: Double,
    val longitude: Double
)

@Composable
fun MapPickerDialog(
    title: String = "Select Location on Map",
    initialLatitude: Double? = null,
    initialLongitude: Double? = null,
    centerLatitude: Double? = null,
    centerLongitude: Double? = null,
    showCenterOnCurrentLocation: Boolean = false,
    centerActionLoading: Boolean = false,
    centerActionMessage: String = "",
    loading: Boolean = false,
    onDismiss: () -> Unit,
    onConfirm: (MapPickerSelection) -> Unit,
    onCenterOnCurrentLocation: (() -> Unit)? = null
) {
    val spacing = LocalNephSpacing.current
    val effectiveInitialLatitude = centerLatitude ?: initialLatitude
    val effectiveInitialLongitude = centerLongitude ?: initialLongitude
    var selection by remember(initialLatitude, initialLongitude, centerLatitude, centerLongitude) {
        mutableStateOf<MapPickerSelection?>(null)
    }
    var mapReady by remember { mutableStateOf(false) }
    var mapError by remember { mutableStateOf("") }

    Dialog(onDismissRequest = { if (!loading) onDismiss() }) {
        Surface(
            shape = MaterialTheme.shapes.large,
            tonalElevation = 6.dp,
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 640.dp)
        ) {
            Column(
                modifier = Modifier.padding(spacing.lg),
                verticalArrangement = Arrangement.spacedBy(spacing.md)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )

                HelperText(text = "Tap on the map to place a pin, then confirm the selection.")

                MapPickerMap(
                    initialLatitude = effectiveInitialLatitude,
                    initialLongitude = effectiveInitialLongitude,
                    onLocationSelected = { lat, lon ->
                        selection = MapPickerSelection(lat, lon)
                    },
                    onMapReady = { mapReady = true },
                    onMapError = { message ->
                        mapError = message.ifBlank { "Map failed to load. Check your connection and try again." }
                    }
                )

                if (!mapReady && mapError.isBlank()) {
                    HelperText(text = "Loading map...")
                }

                if (mapError.isNotBlank()) {
                    HelperText(text = mapError)
                }

                selection?.let {
                    HelperText(
                        text = "Selected coordinates: ${formatMapCoordinate(it.latitude)}, ${formatMapCoordinate(it.longitude)}"
                    )
                }

                if (loading) {
                    HelperText(text = "Resolving selected coordinates...")
                }

                if (showCenterOnCurrentLocation && onCenterOnCurrentLocation != null) {
                    SecondaryButton(
                        text = "Center on my location",
                        onClick = onCenterOnCurrentLocation,
                        enabled = !loading && !centerActionLoading
                    )
                }

                if (centerActionLoading) {
                    HelperText(text = "Finding your current location...")
                }

                if (centerActionMessage.isNotBlank()) {
                    HelperText(text = centerActionMessage)
                }

                PrimaryButton(
                    text = "Use Selected Location",
                    onClick = { selection?.let(onConfirm) },
                    enabled = selection != null && !loading
                )

                SecondaryButton(
                    text = "Cancel",
                    onClick = onDismiss,
                    enabled = !loading
                )
            }
        }
    }
}

private const val MapPickerBridgeName = "AndroidMapPicker"
private const val DefaultCenterLatitude = 39.9334
private const val DefaultCenterLongitude = 32.8597

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun MapPickerMap(
    initialLatitude: Double?,
    initialLongitude: Double?,
    onLocationSelected: (Double, Double) -> Unit,
    onMapReady: () -> Unit,
    onMapError: (String) -> Unit
) {
    val latestOnLocationSelected by rememberUpdatedState(onLocationSelected)
    val latestOnMapReady by rememberUpdatedState(onMapReady)
    val latestOnMapError by rememberUpdatedState(onMapError)
    val html = remember(initialLatitude, initialLongitude) {
        buildMapHtml(initialLatitude, initialLongitude)
    }
    val bridge = remember {
        MapPickerBridge(
            onLocationSelected = { lat, lon -> latestOnLocationSelected(lat, lon) },
            onMapReady = { latestOnMapReady() },
            onMapError = { latestOnMapError(it) }
        )
    }

    LeafletMapWebView(
        html = html,
        bridgeName = MapPickerBridgeName,
        bridge = bridge,
        modifier = Modifier
            .fillMaxWidth()
            .height(260.dp)
    )
}

private class MapPickerBridge(
    private val onLocationSelected: (Double, Double) -> Unit,
    private val onMapReady: () -> Unit,
    private val onMapError: (String) -> Unit
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun onLocationSelected(latitude: Double, longitude: Double) {
        mainHandler.post {
            onLocationSelected(latitude, longitude)
        }
    }

    @JavascriptInterface
    fun onMapReady() {
        mainHandler.post { onMapReady() }
    }

    @JavascriptInterface
    fun onMapError(message: String?) {
        val trimmed = message?.trim().orEmpty()
        mainHandler.post {
            onMapError(trimmed)
        }
    }
}

private fun buildMapHtml(initialLatitude: Double?, initialLongitude: Double?): String {
    val hasInitial = initialLatitude != null && initialLongitude != null
    val centerLat = initialLatitude ?: DefaultCenterLatitude
    val centerLon = initialLongitude ?: DefaultCenterLongitude
    val zoom = if (hasInitial) 15 else 6
    val formattedLat = String.format(Locale.US, "%.6f", centerLat)
    val formattedLon = String.format(Locale.US, "%.6f", centerLon)

    return """
        <!DOCTYPE html>
        <html>
        <head>
            ${buildLeafletDocumentHead()}
        </head>
        <body>
            <div id="map"></div>
            <script>
                ${buildLeafletErrorScript(MapPickerBridgeName)}

                var mapElement = document.getElementById('map');
                if (!mapElement) {
                    failMap('Map failed to load.');
                }
                var map = L.map('map').setView([$formattedLat, $formattedLon], $zoom);
                scheduleMapInvalidateSize(map);
                var tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '(c) OpenStreetMap'
                }).addTo(map);

                var marker = null;

                if (window.$MapPickerBridgeName && window.$MapPickerBridgeName.onMapReady) {
                    map.whenReady(function() {
                        window.$MapPickerBridgeName.onMapReady();
                    });
                }

                if (window.$MapPickerBridgeName && window.$MapPickerBridgeName.onMapError) {
                    tiles.on('tileerror', function() {
                        notifyMapError('Map tiles could not be loaded.');
                    });
                }

                function setMarker(lat, lon) {
                    if (marker) {
                        marker.setLatLng([lat, lon]);
                    } else {
                        marker = L.circleMarker([lat, lon], {
                            radius: 8,
                            color: '#B91C1C',
                            weight: 2,
                            fillColor: '#DC2626',
                            fillOpacity: 0.85
                        }).addTo(map);
                    }
                }

                map.on('click', function(e) {
                    var lat = e.latlng.lat;
                    var lon = e.latlng.lng;
                    setMarker(lat, lon);
                    if (window.$MapPickerBridgeName && window.$MapPickerBridgeName.onLocationSelected) {
                        window.$MapPickerBridgeName.onLocationSelected(lat, lon);
                    }
                });
            </script>
        </body>
        </html>
    """.trimIndent()
}
