package com.neph.ui.map

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.util.Locale

data class LeafletMapMarker(
    val id: String,
    val latitude: Double,
    val longitude: Double,
    val title: String,
    val subtitle: String = ""
)

private const val LeafletMarkerMapBridgeName = "AndroidLeafletMarkerMap"
private const val LeafletMapBaseUrl = "https://neph.app/android-map/"
internal const val LeafletCssUrl = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
internal const val LeafletJsUrl = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
private const val LeafletAssetOrigin = "https://unpkg.com"
private val AllowedOpenStreetMapTileHosts = setOf(
    "tile.openstreetmap.org",
    "a.tile.openstreetmap.org",
    "b.tile.openstreetmap.org",
    "c.tile.openstreetmap.org"
)
private val OpenStreetMapTilePathPattern = Regex("""^/\d+/\d+/\d+\.png$""")

@SuppressLint("SetJavaScriptEnabled")
@Composable
internal fun LeafletMapWebView(
    html: String,
    bridgeName: String,
    bridge: Any,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    key(html) {
        AndroidView(
            factory = {
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = false
                    settings.useWideViewPort = true
                    settings.loadWithOverviewMode = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    settings.javaScriptCanOpenWindowsAutomatically = false
                    settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                    webViewClient = LeafletMapWebViewClient()
                    addJavascriptInterface(bridge, bridgeName)
                    loadDataWithBaseURL(LeafletMapBaseUrl, html, "text/html", "utf-8", null)
                }
            },
            modifier = modifier
        )
    }
}

@Composable
fun LeafletMarkerMap(
    centerLatitude: Double,
    centerLongitude: Double,
    markers: List<LeafletMapMarker>,
    selectedMarkerId: String?,
    onMarkerSelected: (String) -> Unit,
    onMapReady: () -> Unit,
    onMapError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val latestOnMarkerSelected by rememberUpdatedState(onMarkerSelected)
    val latestOnMapReady by rememberUpdatedState(onMapReady)
    val latestOnMapError by rememberUpdatedState(onMapError)
    val html = remember(centerLatitude, centerLongitude, markers, selectedMarkerId) {
        buildLeafletMarkerMapHtml(
            centerLatitude = centerLatitude,
            centerLongitude = centerLongitude,
            markers = markers,
            selectedMarkerId = selectedMarkerId,
            bridgeName = LeafletMarkerMapBridgeName
        )
    }
    val bridge = remember {
        LeafletMarkerMapBridge(
            onMarkerSelected = { latestOnMarkerSelected(it) },
            onMapReady = { latestOnMapReady() },
            onMapError = { latestOnMapError(it) }
        )
    }

    LeafletMapWebView(
        html = html,
        bridgeName = LeafletMarkerMapBridgeName,
        bridge = bridge,
        modifier = modifier
    )
}

internal fun buildLeafletDocumentHead(): String {
    return """
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <!-- Keep embedded maps limited to Leaflet assets, OSM tiles, and inline map scripts. -->
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; style-src 'self' $LeafletAssetOrigin 'unsafe-inline'; script-src $LeafletAssetOrigin 'unsafe-inline'; img-src https://tile.openstreetmap.org https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org; connect-src 'none'; font-src 'none'; media-src 'none'; navigate-to 'none'" />
        <link rel="stylesheet" href="$LeafletCssUrl" />
        <script src="$LeafletJsUrl"></script>
        <style>
            html, body, #map { height: 100%; margin: 0; padding: 0; }
        </style>
    """.trimIndent()
}

internal fun buildLeafletErrorScript(bridgeName: String): String {
    return """
        function notifyMapError(message) {
            if (window.$bridgeName && window.$bridgeName.onMapError) {
                window.$bridgeName.onMapError(String(message || 'Map failed to load.'));
            }
        }

        window.onerror = function(message) {
            notifyMapError(message);
        };

        if (!window.L) {
            notifyMapError('Map library could not be loaded.');
            throw new Error('Leaflet failed to load.');
        }
    """.trimIndent()
}

internal fun buildLeafletMarkerMapHtml(
    centerLatitude: Double,
    centerLongitude: Double,
    markers: List<LeafletMapMarker>,
    selectedMarkerId: String?,
    bridgeName: String,
    zoom: Int = 13
): String {
    val formattedLat = String.format(Locale.US, "%.6f", centerLatitude)
    val formattedLon = String.format(Locale.US, "%.6f", centerLongitude)
    val markersJson = JSONArray(
        markers.map { marker ->
            JSONObject()
                .put("id", marker.id)
                .put("latitude", marker.latitude)
                .put("longitude", marker.longitude)
                .put("title", marker.title)
                .put("subtitle", marker.subtitle)
        }
    ).toString()
    val selectedMarkerJson = selectedMarkerId?.let(JSONObject::quote) ?: "null"

    return """
        <!DOCTYPE html>
        <html>
        <head>
            ${buildLeafletDocumentHead()}
        </head>
        <body>
            <div id="map"></div>
            <script>
                ${buildLeafletErrorScript(bridgeName)}

                var center = [$formattedLat, $formattedLon];
                var markerData = $markersJson;
                var selectedMarkerId = $selectedMarkerJson;
                var map = L.map('map').setView(center, $zoom);
                var tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '(c) OpenStreetMap'
                }).addTo(map);

                tiles.on('tileerror', function() {
                    notifyMapError('Map tiles could not be loaded.');
                });

                L.circleMarker(center, {
                    radius: 7,
                    color: '#2563EB',
                    weight: 2,
                    fillColor: '#3B82F6',
                    fillOpacity: 0.50
                }).addTo(map).bindTooltip('Search center', { direction: 'top' });

                function escapeHtml(value) {
                    return String(value || '').replace(/[&<>"']/g, function(character) {
                        return {
                            '&': '&amp;',
                            '<': '&lt;',
                            '>': '&gt;',
                            '"': '&quot;',
                            "'": '&#39;'
                        }[character];
                    });
                }

                var bounds = [center];
                markerData.forEach(function(marker) {
                    var selected = marker.id === selectedMarkerId;
                    var areaMarker = L.circleMarker([marker.latitude, marker.longitude], {
                        radius: selected ? 11 : 8,
                        color: selected ? '#7F1D1D' : '#B91C1C',
                        weight: selected ? 3 : 2,
                        fillColor: selected ? '#B91C1C' : '#DC2626',
                        fillOpacity: selected ? 0.95 : 0.82
                    }).addTo(map);
                    var label = marker.subtitle
                        ? escapeHtml(marker.title) + '<br />' + escapeHtml(marker.subtitle)
                        : escapeHtml(marker.title);
                    areaMarker.bindTooltip(label, { direction: 'top' });
                    areaMarker.on('click', function() {
                        if (window.$bridgeName && window.$bridgeName.onMarkerSelected) {
                            window.$bridgeName.onMarkerSelected(marker.id);
                        }
                    });
                    bounds.push([marker.latitude, marker.longitude]);
                });

                if (bounds.length > 1) {
                    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
                }

                if (window.$bridgeName && window.$bridgeName.onMapReady) {
                    map.whenReady(function() {
                        window.$bridgeName.onMapReady();
                    });
                }
            </script>
        </body>
        </html>
    """.trimIndent()
}

private class LeafletMarkerMapBridge(
    private val onMarkerSelected: (String) -> Unit,
    private val onMapReady: () -> Unit,
    private val onMapError: (String) -> Unit
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun onMarkerSelected(id: String?) {
        val trimmed = id?.trim().orEmpty()
        if (trimmed.isBlank()) return
        mainHandler.post {
            onMarkerSelected(trimmed)
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

private class LeafletMapWebViewClient : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val uri = request?.url ?: return true
        return !request.isForMainFrame || !isAllowedLeafletMapNavigation(uri)
    }

    @Suppress("DEPRECATION")
    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        val uri = url?.let(Uri::parse) ?: return true
        return !isAllowedLeafletMapNavigation(uri)
    }

    override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
        val uri = request?.url ?: return emptyBlockedResponse()
        return if (isAllowedLeafletMapResource(uri)) {
            null
        } else {
            emptyBlockedResponse()
        }
    }

    @Suppress("DEPRECATION")
    override fun shouldInterceptRequest(view: WebView?, url: String?): WebResourceResponse? {
        val uri = url?.let(Uri::parse) ?: return emptyBlockedResponse()
        return if (isAllowedLeafletMapResource(uri)) {
            null
        } else {
            emptyBlockedResponse()
        }
    }

    private fun emptyBlockedResponse(): WebResourceResponse {
        return WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
    }
}

private fun isAllowedLeafletMapNavigation(uri: Uri): Boolean {
    return uri.toString() == LeafletMapBaseUrl
}

private fun isAllowedLeafletMapResource(uri: Uri): Boolean {
    val url = uri.toString()
    if (url == LeafletMapBaseUrl || url == LeafletCssUrl || url == LeafletJsUrl) {
        return true
    }

    return uri.scheme == "https" &&
        uri.host in AllowedOpenStreetMapTileHosts &&
        OpenStreetMapTilePathPattern.matches(uri.path.orEmpty())
}
