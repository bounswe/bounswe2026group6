package com.neph.ui.map

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
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
import com.neph.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.net.URI
import java.util.Locale
import java.util.UUID

data class LeafletMapMarker(
    val id: String,
    val latitude: Double,
    val longitude: Double,
    val title: String,
    val subtitle: String = "",
    val strokeColorHex: String = "#B91C1C",
    val fillColorHex: String = "#DC2626"
)

private const val LeafletMarkerMapBridgeName = "AndroidLeafletMarkerMap"
private const val LeafletMapBaseUrl = "https://neph.app/android-map/"
internal const val LeafletMapWebViewLogTag = "NephMapWebView"
internal const val LeafletMapInitializationTimeoutMillis = 15_000L
internal const val LeafletMapInitializationTimeoutMessage =
    "Map failed to initialize. Please check WebView and network access."
internal const val LeafletCssUrl = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
internal const val LeafletJsUrl = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
private const val LeafletAssetOrigin = "https://unpkg.com"
private const val LeafletAssetHost = "unpkg.com"
private const val LeafletAssetPathPrefix = "/leaflet@1.9.4/dist/"
private val AllowedOpenStreetMapTileHosts = setOf(
    "tile.openstreetmap.org",
    "a.tile.openstreetmap.org",
    "b.tile.openstreetmap.org",
    "c.tile.openstreetmap.org"
)
private val OpenStreetMapTilePathPattern = Regex("""^/\d+/\d+/\d+\.png$""")

internal fun newLeafletMapInstanceId(): String = "map-${UUID.randomUUID()}"

@SuppressLint("SetJavaScriptEnabled")
@Composable
internal fun LeafletMapWebView(
    mapInstanceId: String,
    html: String,
    bridgeName: String,
    bridge: Any,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    key(mapInstanceId) {
        AndroidView(
            factory = {
                WebView(context).apply {
                    Log.d(LeafletMapWebViewLogTag, "native WebView created instance=$mapInstanceId")
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = false
                    settings.useWideViewPort = true
                    settings.loadWithOverviewMode = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    settings.javaScriptCanOpenWindowsAutomatically = false
                    settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                    webViewClient = LeafletMapWebViewClient()
                    webChromeClient = LeafletMapWebChromeClient()
                    addJavascriptInterface(bridge, bridgeName)
                    loadDataWithBaseURL(LeafletMapBaseUrl, html, "text/html", "utf-8", null)
                }
            },
            onRelease = { webView ->
                Log.d(LeafletMapWebViewLogTag, "native WebView released instance=$mapInstanceId")
                runCatching { webView.stopLoading() }
                runCatching { webView.removeJavascriptInterface(bridgeName) }
                webView.webChromeClient = null
                webView.webViewClient = WebViewClient()
                runCatching { webView.destroy() }
            },
            modifier = modifier
        )
    }
}

@Composable
fun LeafletMarkerMap(
    mapInstanceId: String,
    currentMapInstanceId: () -> String,
    centerLatitude: Double,
    centerLongitude: Double,
    markers: List<LeafletMapMarker>,
    selectedMarkerId: String?,
    onMarkerSelected: (String, String) -> Unit,
    onMapReady: (String) -> Unit,
    onMapError: (String, String) -> Unit,
    modifier: Modifier = Modifier
) {
    val latestOnMarkerSelected by rememberUpdatedState(onMarkerSelected)
    val latestOnMapReady by rememberUpdatedState(onMapReady)
    val latestOnMapError by rememberUpdatedState(onMapError)
    val latestCurrentMapInstanceId by rememberUpdatedState(currentMapInstanceId)
    val html = remember(mapInstanceId, centerLatitude, centerLongitude, markers, selectedMarkerId) {
        buildLeafletMarkerMapHtml(
            mapInstanceId = mapInstanceId,
            centerLatitude = centerLatitude,
            centerLongitude = centerLongitude,
            markers = markers,
            selectedMarkerId = selectedMarkerId,
            bridgeName = LeafletMarkerMapBridgeName
        )
    }
    val bridge = remember {
        LeafletMarkerMapBridge(
            currentMapInstanceId = { latestCurrentMapInstanceId() },
            onMarkerSelected = { instanceId, markerId -> latestOnMarkerSelected(instanceId, markerId) },
            onMapReady = { latestOnMapReady(it) },
            onMapError = { instanceId, message -> latestOnMapError(instanceId, message) }
        )
    }

    LeafletMapWebView(
        mapInstanceId = mapInstanceId,
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; style-src 'self' $LeafletAssetOrigin 'unsafe-inline'; script-src $LeafletAssetOrigin 'unsafe-inline'; img-src https://tile.openstreetmap.org https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org; connect-src 'none'; font-src 'none'; media-src 'none'" />
        <link rel="stylesheet" href="$LeafletCssUrl" />
        <script src="$LeafletJsUrl" onerror="window.__leafletScriptLoadFailed = true;"></script>
        <style>
            html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
        </style>
    """.trimIndent()
}

internal fun buildLeafletErrorScript(bridgeName: String, mapInstanceId: String): String {
    val quotedMapInstanceId = JSONObject.quote(mapInstanceId)
    return """
        var nephMapInstanceId = $quotedMapInstanceId;
        var nephMapReadyNotified = false;
        console.log('NEPH_MAP: script started instance=' + nephMapInstanceId);

        function logNephMapBreadcrumb(message) {
            if (window.console && window.console.log) {
                window.console.log(message + ' instance=' + nephMapInstanceId);
            }
        }

        function logNephMapSize(label, element) {
            if (!element) {
                logNephMapBreadcrumb('NEPH_MAP: map size ' + label + ' width=missing height=missing');
                return;
            }
            var rect = element.getBoundingClientRect();
            logNephMapBreadcrumb(
                'NEPH_MAP: map size ' + label + ' width=' + Math.round(rect.width) +
                    ' height=' + Math.round(rect.height)
            );
        }

        function notifyMapError(message) {
            var errorMessage = String(message || 'Map failed to load.');
            if (window.__lastMapErrorMessage === errorMessage) {
                return;
            }
            window.__lastMapErrorMessage = errorMessage;
            if (window.console && window.console.error) {
                window.console.error(errorMessage);
            }
            if (window.$bridgeName && window.$bridgeName.onMapError) {
                window.$bridgeName.onMapError(nephMapInstanceId, errorMessage);
            }
        }

        function failMap(message) {
            window.__ignoreNextMapRuntimeError = true;
            notifyMapError(message);
            throw new Error(message);
        }

        window.onerror = function(message) {
            if (window.__ignoreNextMapRuntimeError) {
                window.__ignoreNextMapRuntimeError = false;
                return;
            }
            notifyMapError(message);
        };

        if (window.__leafletScriptLoadFailed || !window.L) {
            failMap('Map library could not be loaded.');
        }
        logNephMapBreadcrumb('NEPH_MAP: Leaflet available');

        function notifyMapReadyOnce() {
            if (nephMapReadyNotified) {
                logNephMapBreadcrumb('NEPH_MAP: ready already notified');
                return;
            }
            nephMapReadyNotified = true;
            logNephMapBreadcrumb('NEPH_MAP: notifying Android ready');
            if (window.$bridgeName && window.$bridgeName.onMapReady) {
                window.$bridgeName.onMapReady(nephMapInstanceId);
            }
        }

        function scheduleMapInvalidateSize(map, mapElement) {
            function invalidateMapSize() {
                if (map && map.invalidateSize) {
                    map.invalidateSize();
                }
                logNephMapSize('after invalidateSize', mapElement);
            }

            window.addEventListener('resize', invalidateMapSize);
            setTimeout(invalidateMapSize, 100);
            setTimeout(invalidateMapSize, 500);
        }
    """.trimIndent()
}

internal fun buildLeafletMarkerMapHtml(
    mapInstanceId: String,
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
                .put("strokeColorHex", marker.strokeColorHex)
                .put("fillColorHex", marker.fillColorHex)
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
                ${buildLeafletErrorScript(bridgeName, mapInstanceId)}

                var center = [$formattedLat, $formattedLon];
                var markerData = $markersJson;
                var selectedMarkerId = $selectedMarkerJson;
                var mapElement = document.getElementById('map');
                if (!mapElement) {
                    failMap('Map failed to load.');
                }
                logNephMapBreadcrumb('NEPH_MAP: map element found');
                logNephMapSize('before L.map', mapElement);
                var map = L.map('map').setView(center, $zoom);
                logNephMapBreadcrumb('NEPH_MAP: map created');
                logNephMapSize('after L.map', mapElement);
                scheduleMapInvalidateSize(map, mapElement);
                var tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '(c) OpenStreetMap'
                }).addTo(map);
                logNephMapBreadcrumb('NEPH_MAP: tile layer added');

                tiles.on('tileloadstart', function() {
                    logNephMapBreadcrumb('NEPH_MAP: tileloadstart');
                });

                tiles.on('tileload', function() {
                    logNephMapBreadcrumb('NEPH_MAP: tileload');
                });

                tiles.on('tileerror', function() {
                    logNephMapBreadcrumb('NEPH_MAP: tile error');
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
                        color: selected ? '#111827' : marker.strokeColorHex,
                        weight: selected ? 3 : 2,
                        fillColor: marker.fillColorHex,
                        fillOpacity: selected ? 0.95 : 0.82
                    }).addTo(map);
                    var label = marker.subtitle
                        ? escapeHtml(marker.title) + '<br />' + escapeHtml(marker.subtitle)
                        : escapeHtml(marker.title);
                    areaMarker.bindTooltip(label, { direction: 'top' });
                    areaMarker.on('click', function() {
                        if (window.$bridgeName && window.$bridgeName.onMarkerSelected) {
                            window.$bridgeName.onMarkerSelected(nephMapInstanceId, marker.id);
                        }
                    });
                    bounds.push([marker.latitude, marker.longitude]);
                });

                if (bounds.length > 1) {
                    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
                }

                map.whenReady(function() {
                    logNephMapBreadcrumb('NEPH_MAP: whenReady fired');
                    notifyMapReadyOnce();
                });
                setTimeout(notifyMapReadyOnce, 1000);
            </script>
        </body>
        </html>
    """.trimIndent()
}

private class LeafletMarkerMapBridge(
    private val currentMapInstanceId: () -> String,
    private val onMarkerSelected: (String, String) -> Unit,
    private val onMapReady: (String) -> Unit,
    private val onMapError: (String, String) -> Unit
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var readyDeliveredInstanceId: String? = null

    @JavascriptInterface
    fun onMarkerSelected(instanceId: String?, id: String?) {
        val incomingInstanceId = instanceId.orEmpty()
        val currentInstanceId = currentMapInstanceId()
        if (incomingInstanceId != currentInstanceId) {
            Log.d(
                LeafletMapWebViewLogTag,
                "native onMarkerSelected ignored stale instance=$incomingInstanceId current=$currentInstanceId"
            )
            return
        }
        val trimmed = id?.trim().orEmpty()
        if (trimmed.isBlank()) return
        mainHandler.post {
            if (incomingInstanceId != currentMapInstanceId()) {
                Log.d(
                    LeafletMapWebViewLogTag,
                    "native onMarkerSelected ignored stale instance=$incomingInstanceId current=${currentMapInstanceId()}"
                )
                return@post
            }
            onMarkerSelected(incomingInstanceId, trimmed)
        }
    }

    @JavascriptInterface
    fun onMapReady(instanceId: String?) {
        val incomingInstanceId = instanceId.orEmpty()
        val currentInstanceId = currentMapInstanceId()
        Log.d(
            LeafletMapWebViewLogTag,
            "native LeafletMarkerMapBridge.onMapReady received instance=$incomingInstanceId current=$currentInstanceId"
        )
        if (incomingInstanceId != currentInstanceId) {
            Log.d(
                LeafletMapWebViewLogTag,
                "native onMapReady ignored stale instance=$incomingInstanceId current=$currentInstanceId"
            )
            return
        }
        synchronized(this) {
            if (readyDeliveredInstanceId == incomingInstanceId) {
                Log.d(
                    LeafletMapWebViewLogTag,
                    "native onMapReady ignored duplicate instance=$incomingInstanceId current=$currentInstanceId"
                )
                return
            }
            readyDeliveredInstanceId = incomingInstanceId
        }
        mainHandler.post {
            val postedCurrentInstanceId = currentMapInstanceId()
            if (incomingInstanceId != postedCurrentInstanceId) {
                Log.d(
                    LeafletMapWebViewLogTag,
                    "native onMapReady ignored stale instance=$incomingInstanceId current=$postedCurrentInstanceId"
                )
                return@post
            }
            Log.d(
                LeafletMapWebViewLogTag,
                "native LeafletMarkerMapBridge.onMapReady dispatched instance=$incomingInstanceId"
            )
            onMapReady(incomingInstanceId)
        }
    }

    @JavascriptInterface
    fun onMapError(instanceId: String?, message: String?) {
        val incomingInstanceId = instanceId.orEmpty()
        val currentInstanceId = currentMapInstanceId()
        if (incomingInstanceId != currentInstanceId) {
            Log.d(
                LeafletMapWebViewLogTag,
                "native onMapError ignored stale instance=$incomingInstanceId current=$currentInstanceId"
            )
            return
        }
        val trimmed = message?.trim().orEmpty()
        mainHandler.post {
            if (incomingInstanceId != currentMapInstanceId()) {
                Log.d(
                    LeafletMapWebViewLogTag,
                    "native onMapError ignored stale instance=$incomingInstanceId current=${currentMapInstanceId()}"
                )
                return@post
            }
            onMapError(incomingInstanceId, trimmed)
        }
    }
}

private class LeafletMapWebViewClient : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val uri = request?.url ?: return true
        return !request.isForMainFrame || !isAllowedLeafletMapNavigation(uri)
    }

    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        val uri = url?.let(Uri::parse) ?: return true
        return !isAllowedLeafletMapNavigation(uri)
    }

    override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
        if (request?.isForMainFrame == true) {
            return null
        }
        val uri = request?.url ?: return emptyBlockedResponse()
        return if (isAllowedLeafletMapResource(uri)) {
            null
        } else {
            logBlockedUrl(uri)
            emptyBlockedResponse()
        }
    }

    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun shouldInterceptRequest(view: WebView?, url: String?): WebResourceResponse? {
        val uri = url?.let(Uri::parse) ?: return emptyBlockedResponse()
        return if (isAllowedLeafletMapResource(uri)) {
            null
        } else {
            logBlockedUrl(uri)
            emptyBlockedResponse()
        }
    }

    override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?
    ) {
        super.onReceivedError(view, request, error)
        Log.e(
            LeafletMapWebViewLogTag,
            "WebView resource error url=${request?.url} mainFrame=${request?.isForMainFrame} " +
                "code=${error?.errorCode} description=${error?.description}"
        )
    }

    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun onReceivedError(
        view: WebView?,
        errorCode: Int,
        description: String?,
        failingUrl: String?
    ) {
        super.onReceivedError(view, errorCode, description, failingUrl)
        Log.e(
            LeafletMapWebViewLogTag,
            "WebView resource error url=$failingUrl code=$errorCode description=$description"
        )
    }

    override fun onReceivedHttpError(
        view: WebView?,
        request: WebResourceRequest?,
        errorResponse: WebResourceResponse?
    ) {
        super.onReceivedHttpError(view, request, errorResponse)
        Log.e(
            LeafletMapWebViewLogTag,
            "WebView HTTP error url=${request?.url} mainFrame=${request?.isForMainFrame} " +
                "status=${errorResponse?.statusCode} reason=${errorResponse?.reasonPhrase}"
        )
    }

    private fun emptyBlockedResponse(): WebResourceResponse {
        return WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
    }

    private fun logBlockedUrl(uri: Uri) {
        if (BuildConfig.DEBUG) {
            Log.w(LeafletMapWebViewLogTag, "Blocked map WebView URL: $uri")
        }
    }
}

private class LeafletMapWebChromeClient : WebChromeClient() {
    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
        val message = consoleMessage ?: return false
        Log.d(
            LeafletMapWebViewLogTag,
            "JS console ${message.messageLevel()} ${message.sourceId()}:${message.lineNumber()} ${message.message()}"
        )
        return true
    }
}

private fun isAllowedLeafletMapNavigation(uri: Uri): Boolean {
    return uri.toString() == LeafletMapBaseUrl
}

internal fun isAllowedLeafletMapResource(uri: Uri): Boolean {
    return isAllowedLeafletMapResource(
        url = uri.toString(),
        scheme = uri.scheme,
        host = uri.host,
        path = uri.path.orEmpty()
    )
}

internal fun isAllowedLeafletMapResourceUrl(url: String): Boolean {
    return try {
        val uri = URI(url)
        isAllowedLeafletMapResource(
            url = url,
            scheme = uri.scheme,
            host = uri.host,
            path = uri.path.orEmpty()
        )
    } catch (_: Exception) {
        false
    }
}

private fun isAllowedLeafletMapResource(
    url: String,
    scheme: String?,
    host: String?,
    path: String
): Boolean {
    if (
        url == LeafletMapBaseUrl ||
        isAllowedLeafletMapDataDocument(url, scheme) ||
        isAllowedLeafletAsset(scheme, host, path)
    ) {
        return true
    }

    return scheme == "https" &&
        host in AllowedOpenStreetMapTileHosts &&
        OpenStreetMapTilePathPattern.matches(path)
}

private fun isAllowedLeafletMapDataDocument(url: String, scheme: String?): Boolean {
    return scheme == "data" && url.startsWith("data:text/html", ignoreCase = true)
}

private fun isAllowedLeafletAsset(scheme: String?, host: String?, path: String): Boolean {
    return scheme == "https" &&
        host == LeafletAssetHost &&
        path.startsWith(LeafletAssetPathPrefix)
}
