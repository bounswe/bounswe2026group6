package com.neph.ui.map

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.MotionEvent
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
import androidx.compose.runtime.DisposableEffect
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

data class LeafletMapViewport(
    val centerLatitude: Double,
    val centerLongitude: Double,
    val north: Double,
    val south: Double,
    val east: Double,
    val west: Double,
    val zoom: Int,
    val widthKm: Double,
    val heightKm: Double,
    val widestVisibleDimensionKm: Double
)

private const val LeafletMarkerMapBridgeName = "AndroidLeafletMarkerMap"
private const val LeafletMapBaseUrl = "https://neph.app/android-map/"
const val DISCOVERY_VIEWPORT_MAX_KM = 50.0
internal const val LeafletMapWebViewLogTag = "NephMapWebView"
internal const val LeafletMapInitializationTimeoutMillis = 15_000L
internal const val LeafletMapInitializationTimeoutMessage =
    "Map failed to initialize. Please check WebView and network access."
internal const val LeafletMapTileLoadErrorMessage =
    "Map tiles could not be loaded. Please check your connection and try again."
internal const val LeafletMapFallbackHeightCssPx = 260
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

internal fun coerceLeafletMapHeightCssPx(cssPx: Int): Int {
    return cssPx.coerceAtLeast(LeafletMapFallbackHeightCssPx)
}

internal fun isLeafletMapInitializedForInstance(
    activeInstanceId: String,
    initializedInstanceId: String?
): Boolean {
    return activeInstanceId == initializedInstanceId
}

internal fun isLeafletMapTilesLoadedForInstance(
    activeInstanceId: String,
    tileLoadedInstanceId: String?
): Boolean {
    return activeInstanceId == tileLoadedInstanceId
}

internal fun leafletMapErrorForInstance(
    activeInstanceId: String,
    tileLoadedInstanceId: String?,
    errorInstanceId: String?,
    errorMessage: String
): String {
    if (activeInstanceId != errorInstanceId) return ""
    if (
        errorMessage == LeafletMapTileLoadErrorMessage &&
        isLeafletMapTilesLoadedForInstance(activeInstanceId, tileLoadedInstanceId)
    ) {
        return ""
    }
    return errorMessage
}

internal fun shouldApplyLeafletMapTimeout(
    activeInstanceId: String,
    currentInstanceId: String,
    initializedInstanceId: String?,
    errorInstanceId: String?
): Boolean {
    return activeInstanceId == currentInstanceId &&
        !isLeafletMapInitializedForInstance(activeInstanceId, initializedInstanceId) &&
        activeInstanceId != errorInstanceId
}

internal fun shouldApplyLeafletMapError(
    activeInstanceId: String,
    currentInstanceId: String,
    tileLoadedInstanceId: String?,
    errorMessage: String
): Boolean {
    if (activeInstanceId != currentInstanceId) return false
    return errorMessage != LeafletMapTileLoadErrorMessage ||
        !isLeafletMapTilesLoadedForInstance(activeInstanceId, tileLoadedInstanceId)
}

internal fun isLeafletTileLoadedSignal(source: String): Boolean {
    return source == "tileload"
}

internal fun shouldClearLeafletMapErrorForSignal(source: String, errorMessage: String): Boolean {
    return isLeafletTileLoadedSignal(source) ||
        source == "selection" ||
        source == "marker-selected" ||
        errorMessage == LeafletMapInitializationTimeoutMessage
}

internal fun logMapDebug(message: String) {
    if (BuildConfig.DEBUG) {
        Log.d(LeafletMapWebViewLogTag, message)
    }
}

internal fun logMapWarning(message: String) {
    if (BuildConfig.DEBUG) {
        Log.w(LeafletMapWebViewLogTag, message)
    }
}

fun isLeafletViewportDiscoverable(viewport: LeafletMapViewport?): Boolean {
    val current = viewport ?: return false
    return current.centerLatitude.isFinite() &&
        current.centerLongitude.isFinite() &&
        current.north.isFinite() &&
        current.south.isFinite() &&
        current.east.isFinite() &&
        current.west.isFinite() &&
        current.widthKm.isFinite() &&
        current.heightKm.isFinite() &&
        current.widestVisibleDimensionKm.isFinite() &&
        current.centerLatitude in -90.0..90.0 &&
        current.centerLongitude in -180.0..180.0 &&
        current.south in -90.0..90.0 &&
        current.north in -90.0..90.0 &&
        current.west in -180.0..180.0 &&
        current.east in -180.0..180.0 &&
        current.south <= current.north &&
        current.west <= current.east &&
        current.widthKm >= 0.0 &&
        current.heightKm >= 0.0 &&
        current.widestVisibleDimensionKm <= DISCOVERY_VIEWPORT_MAX_KM
}

fun effectiveLeafletViewportKey(viewport: LeafletMapViewport?): String? {
    if (!isLeafletViewportDiscoverable(viewport)) return null
    val current = viewport ?: return null
    return String.format(
        Locale.US,
        "%.3f,%.3f,%.3f,%.3f",
        current.west,
        current.south,
        current.east,
        current.north
    )
}

fun shouldFetchLeafletViewport(
    viewportKey: String,
    lastFetchedViewportKey: String?,
    manualRefresh: Boolean
): Boolean {
    return manualRefresh || viewportKey != lastFetchedViewportKey
}

fun leafletViewportBboxString(viewport: LeafletMapViewport): String {
    return String.format(
        Locale.US,
        "%.6f,%.6f,%.6f,%.6f",
        viewport.west,
        viewport.south,
        viewport.east,
        viewport.north
    )
}

@SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
@Composable
internal fun LeafletMapWebView(
    mapInstanceId: String,
    html: String,
    bridgeName: String,
    bridge: Any,
    javaScriptUpdate: String? = null,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    key(mapInstanceId) {
        AndroidView(
            factory = {
                WebView(context).apply {
                    logMapDebug("native WebView created instance=$mapInstanceId")
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
                    setOnTouchListener { view, event ->
                        when (event.actionMasked) {
                            MotionEvent.ACTION_DOWN,
                            MotionEvent.ACTION_MOVE,
                            MotionEvent.ACTION_POINTER_DOWN,
                            MotionEvent.ACTION_POINTER_UP -> {
                                view.parent?.requestDisallowInterceptTouchEvent(true)
                            }

                            MotionEvent.ACTION_UP,
                            MotionEvent.ACTION_CANCEL -> {
                                view.parent?.requestDisallowInterceptTouchEvent(false)
                            }
                        }
                        false
                    }
                    addJavascriptInterface(bridge, bridgeName)
                    loadDataWithBaseURL(LeafletMapBaseUrl, html, "text/html", "utf-8", null)
                }
            },
            update = { webView ->
                javaScriptUpdate?.let { script ->
                    webView.evaluateJavascript(script, null)
                }
            },
            onRelease = { webView ->
                logMapDebug("native WebView released instance=$mapInstanceId")
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
    mapHeightCssPx: Int = LeafletMapFallbackHeightCssPx,
    zoom: Int = 13,
    showCenterMarker: Boolean = true,
    fitBoundsToMarkers: Boolean = true,
    onMarkerSelected: (String, String) -> Unit,
    onMapReady: (String, String) -> Unit,
    onMapError: (String, String) -> Unit,
    onViewportChanged: ((String, LeafletMapViewport) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val latestOnMarkerSelected by rememberUpdatedState(onMarkerSelected)
    val latestOnMapReady by rememberUpdatedState(onMapReady)
    val latestOnMapError by rememberUpdatedState(onMapError)
    val latestOnViewportChanged by rememberUpdatedState(onViewportChanged)
    val latestCurrentMapInstanceId by rememberUpdatedState(currentMapInstanceId)
    val html = remember(
        mapInstanceId,
        centerLatitude,
        centerLongitude,
        zoom,
        showCenterMarker,
        fitBoundsToMarkers
    ) {
        buildLeafletMarkerMapHtml(
            mapInstanceId = mapInstanceId,
            centerLatitude = centerLatitude,
            centerLongitude = centerLongitude,
            markers = markers,
            selectedMarkerId = selectedMarkerId,
            bridgeName = LeafletMarkerMapBridgeName,
            zoom = zoom,
            showCenterMarker = showCenterMarker,
            fitBoundsToMarkers = fitBoundsToMarkers,
            mapHeightCssPx = mapHeightCssPx
        )
    }
    val bridge = remember(mapInstanceId) {
        LeafletMarkerMapBridge(
            currentMapInstanceId = { latestCurrentMapInstanceId() },
            onMarkerSelected = { instanceId, markerId -> latestOnMarkerSelected(instanceId, markerId) },
            onMapReady = { instanceId, source -> latestOnMapReady(instanceId, source) },
            onMapError = { instanceId, message -> latestOnMapError(instanceId, message) },
            onViewportChanged = { instanceId, viewport ->
                latestOnViewportChanged?.invoke(instanceId, viewport)
            }
        )
    }

    DisposableEffect(bridge) {
        onDispose { bridge.dispose() }
    }

    LeafletMapWebView(
        mapInstanceId = mapInstanceId,
        html = html,
        bridgeName = LeafletMarkerMapBridgeName,
        bridge = bridge,
        javaScriptUpdate = buildMarkerMapUpdateScript(markers, selectedMarkerId),
        modifier = modifier
    )
}

private fun buildMarkerMapUpdateScript(markers: List<LeafletMapMarker>, selectedMarkerId: String?): String {
    val markersJson = leafletMarkersJson(markers)
    val selectedMarkerJson = selectedMarkerId?.let(JSONObject::quote) ?: "null"
    return """
        if (window.nephSetMarkers) {
            window.nephSetMarkers($markersJson, $selectedMarkerJson);
        } else if (window.nephSelectMarker) {
            window.nephSelectMarker($selectedMarkerJson);
        }
    """.trimIndent()
}

private fun leafletMarkersJson(markers: List<LeafletMapMarker>): String {
    return JSONArray(
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
}

internal fun buildLeafletDocumentHead(mapHeightCssPx: Int = LeafletMapFallbackHeightCssPx): String {
    val coercedMapHeightCssPx = coerceLeafletMapHeightCssPx(mapHeightCssPx)
    return """
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <!-- Keep embedded maps limited to Leaflet assets, OSM tiles, and inline map scripts. -->
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; style-src 'self' $LeafletAssetOrigin 'unsafe-inline'; script-src $LeafletAssetOrigin 'unsafe-inline'; img-src https://tile.openstreetmap.org https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org; connect-src 'none'; font-src 'none'; media-src 'none'" />
        <link rel="stylesheet" href="$LeafletCssUrl" />
        <script src="$LeafletJsUrl" onerror="window.__leafletScriptLoadFailed = true;"></script>
        <style>
            html, body {
                width: 100%;
                height: 100%;
                min-height: ${coercedMapHeightCssPx}px;
                margin: 0;
                padding: 0;
                overflow: hidden;
                overscroll-behavior: contain;
                touch-action: none;
                -webkit-user-select: none;
                user-select: none;
            }
            #map {
                width: 100%;
                height: ${coercedMapHeightCssPx}px;
                min-height: ${coercedMapHeightCssPx}px;
                margin: 0;
                padding: 0;
                overscroll-behavior: contain;
                touch-action: none;
                -webkit-user-select: none;
                user-select: none;
            }
        </style>
    """.trimIndent()
}

internal fun buildLeafletErrorScript(
    bridgeName: String,
    mapInstanceId: String,
    mapHeightCssPx: Int = LeafletMapFallbackHeightCssPx
): String {
    val quotedMapInstanceId = JSONObject.quote(mapInstanceId)
    val coercedMapHeightCssPx = coerceLeafletMapHeightCssPx(mapHeightCssPx)
    val debugLogsEnabled = if (BuildConfig.DEBUG) "true" else "false"
    return """
        var nephMapInstanceId = $quotedMapInstanceId;
        var nephMapReadyNotified = false;
        var nephMapFallbackHeightCssPx = $coercedMapHeightCssPx;
        var nephMapDebugLogsEnabled = $debugLogsEnabled;
        logNephMapBreadcrumb('NEPH_MAP: script started');

        function logNephMapBreadcrumb(message) {
            if (nephMapDebugLogsEnabled && window.console && window.console.log) {
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

        function ensureNephMapHeight(element) {
            if (!element) {
                return;
            }
            var rect = element.getBoundingClientRect();
            if (rect.height > 0) {
                return;
            }
            var fallbackHeight = nephMapFallbackHeightCssPx + 'px';
            document.documentElement.style.minHeight = fallbackHeight;
            document.body.style.minHeight = fallbackHeight;
            element.style.height = fallbackHeight;
            element.style.minHeight = fallbackHeight;
            logNephMapBreadcrumb('NEPH_MAP: applied fallback map height height=' + nephMapFallbackHeightCssPx);
        }

        function notifyMapError(message) {
            var errorMessage = String(message || 'Map failed to load.');
            if (window.__lastMapErrorMessage === errorMessage) {
                return;
            }
            window.__lastMapErrorMessage = errorMessage;
            if (nephMapDebugLogsEnabled && window.console && window.console.error) {
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

        function notifyMapAlive(source) {
            var readySource = String(source || 'alive');
            logNephMapBreadcrumb('NEPH_MAP: alive source=' + readySource);
            if (window.$bridgeName && window.$bridgeName.onMapAlive) {
                window.$bridgeName.onMapAlive(nephMapInstanceId, readySource);
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
    zoom: Int = 13,
    showCenterMarker: Boolean = true,
    fitBoundsToMarkers: Boolean = true,
    mapHeightCssPx: Int = LeafletMapFallbackHeightCssPx
): String {
    val formattedLat = String.format(Locale.US, "%.6f", centerLatitude)
    val formattedLon = String.format(Locale.US, "%.6f", centerLongitude)
    val markersJson = leafletMarkersJson(markers)
    val selectedMarkerJson = selectedMarkerId?.let(JSONObject::quote) ?: "null"
    val fitBoundsToMarkersJson = if (fitBoundsToMarkers) "true" else "false"
    val centerMarkerScript = if (showCenterMarker) {
        """
                L.circleMarker(center, {
                    radius: 7,
                    color: '#2563EB',
                    weight: 2,
                    fillColor: '#3B82F6',
                    fillOpacity: 0.50
                }).addTo(map).bindTooltip('Search center', { direction: 'top' });
        """.trimIndent()
    } else {
        ""
    }

    return """
        <!DOCTYPE html>
        <html>
        <head>
            ${buildLeafletDocumentHead(mapHeightCssPx)}
        </head>
        <body>
            <div id="map"></div>
            <script>
                ${buildLeafletErrorScript(bridgeName, mapInstanceId, mapHeightCssPx)}

                var center = [$formattedLat, $formattedLon];
                var markerData = $markersJson;
                var selectedMarkerId = $selectedMarkerJson;
                var fitBoundsToMarkers = $fitBoundsToMarkersJson;
                var mapElement = document.getElementById('map');
                if (!mapElement) {
                    failMap('Map failed to load.');
                }
                logNephMapBreadcrumb('NEPH_MAP: map element found');
                ensureNephMapHeight(mapElement);
                logNephMapSize('before L.map', mapElement);
                var map = L.map('map').setView(center, $zoom);
                logNephMapBreadcrumb('NEPH_MAP: map created');
                notifyMapAlive('map-created');
                logNephMapSize('after L.map', mapElement);
                scheduleMapInvalidateSize(map, mapElement);
                var tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '(c) OpenStreetMap'
                }).addTo(map);
                logNephMapBreadcrumb('NEPH_MAP: tile layer added');

                tiles.on('tileloadstart', function() {
                    logNephMapBreadcrumb('NEPH_MAP: tileloadstart');
                    notifyMapAlive('tileloadstart');
                });

                tiles.on('tileload', function() {
                    logNephMapBreadcrumb('NEPH_MAP: tileload');
                    notifyMapAlive('tileload');
                });

                tiles.on('tileerror', function() {
                    logNephMapBreadcrumb('NEPH_MAP: tile error');
                    notifyMapError('$LeafletMapTileLoadErrorMessage');
                });

                $centerMarkerScript

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
                var areaMarkersById = {};

                function markerOptions(marker, selected) {
                    return {
                        radius: selected ? 11 : 8,
                        color: selected ? '#111827' : marker.strokeColorHex,
                        weight: selected ? 3 : 2,
                        fillColor: marker.fillColorHex,
                        fillOpacity: selected ? 0.95 : 0.82
                    };
                }

                window.nephSelectMarker = function(markerId) {
                    selectedMarkerId = markerId || null;
                    Object.keys(areaMarkersById).forEach(function(id) {
                        var entry = areaMarkersById[id];
                        entry.marker.setStyle(markerOptions(entry.data, id === selectedMarkerId));
                    });
                };

                window.nephSetMarkers = function(nextMarkers, nextSelectedMarkerId) {
                    markerData = Array.isArray(nextMarkers) ? nextMarkers : [];
                    selectedMarkerId = nextSelectedMarkerId || null;
                    Object.keys(areaMarkersById).forEach(function(id) {
                        map.removeLayer(areaMarkersById[id].marker);
                    });
                    areaMarkersById = {};
                    bounds = [center];

                    markerData.forEach(function(marker) {
                        var selected = marker.id === selectedMarkerId;
                        var areaMarker = L.circleMarker(
                            [marker.latitude, marker.longitude],
                            markerOptions(marker, selected)
                        ).addTo(map);
                        var label = marker.subtitle
                            ? escapeHtml(marker.title) + '<br />' + escapeHtml(marker.subtitle)
                            : escapeHtml(marker.title);
                        areaMarker.bindTooltip(label, { direction: 'top' });
                        areaMarker.on('click', function() {
                            window.nephSelectMarker(marker.id);
                            if (window.$bridgeName && window.$bridgeName.onMarkerSelected) {
                                window.$bridgeName.onMarkerSelected(nephMapInstanceId, marker.id);
                            }
                        });
                        areaMarkersById[marker.id] = {
                            marker: areaMarker,
                            data: marker
                        };
                        bounds.push([marker.latitude, marker.longitude]);
                    });
                };

                window.nephSetMarkers(markerData, selectedMarkerId);

                if (fitBoundsToMarkers && bounds.length > 1) {
                    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
                }

                function distanceKm(lat1, lon1, lat2, lon2) {
                    var earthRadiusKm = 6371;
                    var dLat = (lat2 - lat1) * Math.PI / 180;
                    var dLon = (lon2 - lon1) * Math.PI / 180;
                    var a =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
                    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                }

                function notifyViewportChanged() {
                    if (!window.$bridgeName || !window.$bridgeName.onViewportChanged) {
                        return;
                    }
                    var currentCenter = map.getCenter();
                    var currentBounds = map.getBounds();
                    var north = currentBounds.getNorth();
                    var south = currentBounds.getSouth();
                    var east = currentBounds.getEast();
                    var west = currentBounds.getWest();
                    var centerLat = currentCenter.lat;
                    var centerLon = currentCenter.lng;
                    var midLat = (north + south) / 2;
                    var midLon = (east + west) / 2;
                    var widthKm = distanceKm(midLat, west, midLat, east);
                    var heightKm = distanceKm(south, midLon, north, midLon);
                    var widestKm = Math.max(widthKm, heightKm);
                    window.$bridgeName.onViewportChanged(
                        nephMapInstanceId,
                        centerLat,
                        centerLon,
                        north,
                        south,
                        east,
                        west,
                        map.getZoom(),
                        widthKm,
                        heightKm,
                        widestKm
                    );
                }

                map.on('moveend zoomend', notifyViewportChanged);

                map.whenReady(function() {
                    logNephMapBreadcrumb('NEPH_MAP: whenReady fired');
                    notifyMapReadyOnce();
                    notifyViewportChanged();
                });
                setTimeout(notifyMapReadyOnce, 1000);
                setTimeout(notifyViewportChanged, 1000);
            </script>
        </body>
        </html>
    """.trimIndent()
}

private class LeafletMarkerMapBridge(
    private val currentMapInstanceId: () -> String,
    private val onMarkerSelected: (String, String) -> Unit,
    private val onMapReady: (String, String) -> Unit,
    private val onMapError: (String, String) -> Unit,
    private val onViewportChanged: (String, LeafletMapViewport) -> Unit
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    @Volatile
    private var disposed = false
    private var readyDeliveredInstanceId: String? = null
    private val aliveDeliveredSignals = mutableSetOf<String>()

    @JavascriptInterface
    fun onMarkerSelected(instanceId: String?, id: String?) {
        if (disposed) return
        val incomingInstanceId = instanceId.orEmpty()
        val currentInstanceId = currentMapInstanceId()
        if (incomingInstanceId != currentInstanceId) {
            logMapDebug(
                "native onMarkerSelected ignored stale instance=$incomingInstanceId current=$currentInstanceId"
            )
            return
        }
        val trimmed = id?.trim().orEmpty()
        if (trimmed.isBlank()) return
        mainHandler.post {
            if (disposed) return@post
            if (incomingInstanceId != currentMapInstanceId()) {
                logMapDebug(
                    "native onMarkerSelected ignored stale instance=$incomingInstanceId current=${currentMapInstanceId()}"
                )
                return@post
            }
            if (markAliveSignalForDelivery(incomingInstanceId, "marker-selected")) {
                dispatchMapAliveFromMain(incomingInstanceId, "marker-selected")
            }
            onMarkerSelected(incomingInstanceId, trimmed)
        }
    }

    @JavascriptInterface
    fun onMapReady(instanceId: String?) {
        if (disposed) return
        val incomingInstanceId = instanceId.orEmpty()
        val currentInstanceId = currentMapInstanceId()
        logMapDebug(
            "native LeafletMarkerMapBridge.onMapReady received instance=$incomingInstanceId current=$currentInstanceId"
        )
        if (incomingInstanceId != currentInstanceId) {
            logMapDebug(
                "native onMapReady ignored stale instance=$incomingInstanceId current=$currentInstanceId"
            )
            return
        }
        synchronized(this) {
            if (readyDeliveredInstanceId == incomingInstanceId) {
                logMapDebug(
                    "native onMapReady ignored duplicate instance=$incomingInstanceId current=$currentInstanceId"
                )
                return
            }
            readyDeliveredInstanceId = incomingInstanceId
        }
        mainHandler.post {
            if (disposed) return@post
            val postedCurrentInstanceId = currentMapInstanceId()
            if (incomingInstanceId != postedCurrentInstanceId) {
                logMapDebug(
                    "native onMapReady ignored stale instance=$incomingInstanceId current=$postedCurrentInstanceId"
                )
                return@post
            }
            logMapDebug(
                "native LeafletMarkerMapBridge.onMapReady dispatched source=whenReady instance=$incomingInstanceId"
            )
            onMapReady(incomingInstanceId, "whenReady")
        }
    }

    @JavascriptInterface
    fun onMapAlive(instanceId: String?, source: String?) {
        if (disposed) return
        val incomingInstanceId = instanceId.orEmpty()
        val currentInstanceId = currentMapInstanceId()
        val readySource = source?.trim().orEmpty().ifBlank { "alive" }
        if (incomingInstanceId != currentInstanceId) {
            logMapDebug(
                "native onMapAlive ignored stale source=$readySource instance=$incomingInstanceId current=$currentInstanceId"
            )
            return
        }
        if (!markAliveSignalForDelivery(incomingInstanceId, readySource)) {
            logMapDebug(
                "native onMapAlive ignored duplicate source=$readySource instance=$incomingInstanceId"
            )
            return
        }
        mainHandler.post {
            if (disposed) return@post
            dispatchMapAliveFromMain(incomingInstanceId, readySource)
        }
    }

    @JavascriptInterface
    fun onMapError(instanceId: String?, message: String?) {
        if (disposed) return
        val incomingInstanceId = instanceId.orEmpty()
        val currentInstanceId = currentMapInstanceId()
        if (incomingInstanceId != currentInstanceId) {
            logMapDebug(
                "native onMapError ignored stale instance=$incomingInstanceId current=$currentInstanceId"
            )
            return
        }
        val trimmed = message?.trim().orEmpty()
        mainHandler.post {
            if (disposed) return@post
            if (incomingInstanceId != currentMapInstanceId()) {
                logMapDebug(
                    "native onMapError ignored stale instance=$incomingInstanceId current=${currentMapInstanceId()}"
                )
                return@post
            }
            onMapError(incomingInstanceId, trimmed)
        }
    }

    @JavascriptInterface
    fun onViewportChanged(
        instanceId: String?,
        centerLatitude: Double,
        centerLongitude: Double,
        north: Double,
        south: Double,
        east: Double,
        west: Double,
        zoom: Int,
        widthKm: Double,
        heightKm: Double,
        widestVisibleDimensionKm: Double
    ) {
        if (disposed) return
        val incomingInstanceId = instanceId.orEmpty()
        val currentInstanceId = currentMapInstanceId()
        if (incomingInstanceId != currentInstanceId) {
            logMapDebug(
                "native onViewportChanged ignored stale instance=$incomingInstanceId current=$currentInstanceId"
            )
            return
        }
        val viewport = LeafletMapViewport(
            centerLatitude = centerLatitude,
            centerLongitude = centerLongitude,
            north = north,
            south = south,
            east = east,
            west = west,
            zoom = zoom,
            widthKm = widthKm,
            heightKm = heightKm,
            widestVisibleDimensionKm = widestVisibleDimensionKm
        )
        mainHandler.post {
            if (disposed) return@post
            if (incomingInstanceId != currentMapInstanceId()) {
                logMapDebug(
                    "native onViewportChanged ignored stale instance=$incomingInstanceId current=${currentMapInstanceId()}"
                )
                return@post
            }
            onViewportChanged(incomingInstanceId, viewport)
        }
    }

    fun dispose() {
        disposed = true
        mainHandler.removeCallbacksAndMessages(null)
    }

    private fun dispatchMapAliveFromMain(instanceId: String, source: String) {
        if (disposed) return
        val currentInstanceId = currentMapInstanceId()
        if (instanceId != currentInstanceId) {
            logMapDebug(
                "native onMapAlive ignored stale source=$source instance=$instanceId current=$currentInstanceId"
            )
            return
        }
        logMapDebug(
            "native LeafletMarkerMapBridge.onMapAlive dispatched source=$source instance=$instanceId"
        )
        onMapReady(instanceId, source)
    }

    private fun markAliveSignalForDelivery(instanceId: String, source: String): Boolean {
        if (disposed) return false
        return synchronized(this) {
            aliveDeliveredSignals.add("$instanceId:$source")
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
        val message = "WebView resource error url=${request?.url} mainFrame=${request?.isForMainFrame} " +
            "code=${error?.errorCode} description=${error?.description}"
        if (request?.isForMainFrame == true) {
            Log.e(LeafletMapWebViewLogTag, message)
        } else {
            logMapWarning(message)
        }
    }

    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun onReceivedError(
        view: WebView?,
        errorCode: Int,
        description: String?,
        failingUrl: String?
    ) {
        super.onReceivedError(view, errorCode, description, failingUrl)
        logMapWarning("WebView resource error url=$failingUrl code=$errorCode description=$description")
    }

    override fun onReceivedHttpError(
        view: WebView?,
        request: WebResourceRequest?,
        errorResponse: WebResourceResponse?
    ) {
        super.onReceivedHttpError(view, request, errorResponse)
        val message = "WebView HTTP error url=${request?.url} mainFrame=${request?.isForMainFrame} " +
            "status=${errorResponse?.statusCode} reason=${errorResponse?.reasonPhrase}"
        if (request?.isForMainFrame == true) {
            Log.e(LeafletMapWebViewLogTag, message)
        } else {
            logMapWarning(message)
        }
    }

    private fun emptyBlockedResponse(): WebResourceResponse {
        return WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
    }

    private fun logBlockedUrl(uri: Uri) {
        logMapWarning("Blocked map WebView URL: $uri")
    }
}

private class LeafletMapWebChromeClient : WebChromeClient() {
    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
        val message = consoleMessage ?: return false
        logMapDebug(
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
