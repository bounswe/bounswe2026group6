package com.neph.ui.map

import android.annotation.SuppressLint
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
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
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.viewinterop.AndroidView
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
    loading: Boolean = false,
    onDismiss: () -> Unit,
    onConfirm: (MapPickerSelection) -> Unit
) {
    val spacing = LocalNephSpacing.current
    val initialSelection = remember(initialLatitude, initialLongitude) {
        if (initialLatitude != null && initialLongitude != null) {
            MapPickerSelection(initialLatitude, initialLongitude)
        } else {
            null
        }
    }
    var selection by remember(initialLatitude, initialLongitude) {
        mutableStateOf(initialSelection)
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

                HelperText(text = "Tap on the map to place a pin.")

                MapPickerMap(
                    initialLatitude = initialLatitude,
                    initialLongitude = initialLongitude,
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
    val context = LocalContext.current
    val html = remember(initialLatitude, initialLongitude) {
        buildMapHtml(initialLatitude, initialLongitude)
    }
    val bridge = remember {
        MapPickerBridge(onLocationSelected, onMapReady, onMapError)
    }

    key(html) {
        AndroidView(
            factory = {
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.useWideViewPort = true
                    settings.loadWithOverviewMode = true
                    webViewClient = WebViewClient()
                    addJavascriptInterface(bridge, MapPickerBridgeName)
                    loadDataWithBaseURL("https://neph.app", html, "text/html", "utf-8", null)
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(260.dp)
        )
    }
}

private class MapPickerBridge(
    private val onLocationSelected: (Double, Double) -> Unit,
    private val onMapReady: () -> Unit,
    private val onMapError: (String) -> Unit
) {
    @JavascriptInterface
    fun onLocationSelected(latitude: Double, longitude: Double) {
        onLocationSelected(latitude, longitude)
    }

    @JavascriptInterface
    fun onMapReady() {
        onMapReady()
    }

    @JavascriptInterface
    fun onMapError(message: String?) {
        onMapError(message?.trim().orEmpty())
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
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <style>
                html, body, #map { height: 100%; margin: 0; padding: 0; }
            </style>
        </head>
        <body>
            <div id="map"></div>
            <script>
                var map = L.map('map').setView([$formattedLat, $formattedLon], $zoom);
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
                        window.$MapPickerBridgeName.onMapError('Map tiles could not be loaded.');
                    });
                    window.onerror = function(message) {
                        window.$MapPickerBridgeName.onMapError(String(message || 'Map failed to load.'));
                    };
                }

                function setMarker(lat, lon) {
                    if (marker) {
                        marker.setLatLng([lat, lon]);
                    } else {
                        marker = L.marker([lat, lon]).addTo(map);
                    }
                }

                if (${hasInitial.toString()}) {
                    setMarker($formattedLat, $formattedLon);
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
