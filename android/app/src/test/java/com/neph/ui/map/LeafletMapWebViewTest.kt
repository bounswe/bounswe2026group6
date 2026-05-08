package com.neph.ui.map

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LeafletMapWebViewTest {
    @Test
    fun leafletMapInitializationTimeout_usesSlowEmulatorFallbackWindow() {
        assertEquals(15_000L, LeafletMapInitializationTimeoutMillis)
    }

    @Test
    fun coerceLeafletMapHeightCssPx_enforcesNonZeroSharedFallback() {
        assertEquals(LeafletMapFallbackHeightCssPx, coerceLeafletMapHeightCssPx(0))
        assertEquals(LeafletMapFallbackHeightCssPx, coerceLeafletMapHeightCssPx(220))
        assertEquals(280, coerceLeafletMapHeightCssPx(280))
    }

    @Test
    fun leafletMapInstanceState_initializationSuppressesTimeoutButNotTileError() {
        assertTrue(isLeafletMapInitializedForInstance("map-current", "map-current"))
        assertFalse(isLeafletMapTilesLoadedForInstance("map-current", null))
        assertTrue(
            shouldApplyLeafletMapError(
                activeInstanceId = "map-current",
                currentInstanceId = "map-current",
                tileLoadedInstanceId = null,
                errorMessage = LeafletMapTileLoadErrorMessage
            )
        )
        assertEquals(
            LeafletMapTileLoadErrorMessage,
            leafletMapErrorForInstance(
                activeInstanceId = "map-current",
                tileLoadedInstanceId = null,
                errorInstanceId = "map-current",
                errorMessage = LeafletMapTileLoadErrorMessage
            )
        )
        assertFalse(
            shouldApplyLeafletMapTimeout(
                activeInstanceId = "map-current",
                currentInstanceId = "map-current",
                initializedInstanceId = "map-current",
                errorInstanceId = null
            )
        )
    }

    @Test
    fun leafletMapInstanceState_tileLoadedInstanceIgnoresLaterTileErrors() {
        assertTrue(isLeafletMapTilesLoadedForInstance("map-current", "map-current"))
        assertFalse(
            shouldApplyLeafletMapError(
                activeInstanceId = "map-current",
                currentInstanceId = "map-current",
                tileLoadedInstanceId = "map-current",
                errorMessage = LeafletMapTileLoadErrorMessage
            )
        )
        assertEquals(
            "",
            leafletMapErrorForInstance(
                activeInstanceId = "map-current",
                tileLoadedInstanceId = "map-current",
                errorInstanceId = "map-current",
                errorMessage = LeafletMapTileLoadErrorMessage
            )
        )
    }

    @Test
    fun leafletMapInstanceState_sourcesSeparateInitializationFromTileLoaded() {
        assertFalse(isLeafletTileLoadedSignal("map-created"))
        assertFalse(isLeafletTileLoadedSignal("whenReady"))
        assertTrue(isLeafletTileLoadedSignal("tileload"))
        assertTrue(shouldClearLeafletMapErrorForSignal("tileload", LeafletMapTileLoadErrorMessage))
        assertTrue(shouldClearLeafletMapErrorForSignal("selection", LeafletMapTileLoadErrorMessage))
        assertFalse(shouldClearLeafletMapErrorForSignal("whenReady", LeafletMapTileLoadErrorMessage))
    }

    @Test
    fun leafletMapInstanceState_staleTimeoutAndErrorDoNotAffectActiveInstance() {
        assertEquals(
            "",
            leafletMapErrorForInstance(
                activeInstanceId = "map-current",
                tileLoadedInstanceId = null,
                errorInstanceId = "map-stale",
                errorMessage = LeafletMapInitializationTimeoutMessage
            )
        )
        assertFalse(
            shouldApplyLeafletMapTimeout(
                activeInstanceId = "map-stale",
                currentInstanceId = "map-current",
                initializedInstanceId = null,
                errorInstanceId = null
            )
        )
        assertFalse(
            shouldApplyLeafletMapError(
                activeInstanceId = "map-stale",
                currentInstanceId = "map-current",
                tileLoadedInstanceId = null,
                errorMessage = LeafletMapTileLoadErrorMessage
            )
        )
    }

    @Test
    fun leafletMapInstanceState_activeUnreadyInstanceCanTimeout() {
        assertEquals(
            LeafletMapInitializationTimeoutMessage,
            leafletMapErrorForInstance(
                activeInstanceId = "map-current",
                tileLoadedInstanceId = null,
                errorInstanceId = "map-current",
                errorMessage = LeafletMapInitializationTimeoutMessage
            )
        )
        assertTrue(
            shouldApplyLeafletMapTimeout(
                activeInstanceId = "map-current",
                currentInstanceId = "map-current",
                initializedInstanceId = null,
                errorInstanceId = null
            )
        )
    }

    @Test
    fun buildLeafletDocumentHead_allowsLeafletOriginWithoutQuotedUrlSources() {
        val head = buildLeafletDocumentHead()

        assertTrue(head.contains("script-src https://unpkg.com 'unsafe-inline'"))
        assertTrue(head.contains("style-src 'self' https://unpkg.com 'unsafe-inline'"))
        assertFalse(head.contains("script-src 'https://unpkg.com"))
        assertFalse(head.contains("style-src 'self' 'https://unpkg.com"))
        assertFalse(head.contains("navigate-to"))
        assertTrue(head.contains("min-height: ${LeafletMapFallbackHeightCssPx}px"))
        assertTrue(head.contains("height: ${LeafletMapFallbackHeightCssPx}px"))
    }

    @Test
    fun isAllowedLeafletMapResourceUrl_allowsLeafletAssetsUnderDist() {
        assertTrue(isAllowedLeafletMapResourceUrl(LeafletCssUrl))
        assertTrue(isAllowedLeafletMapResourceUrl(LeafletJsUrl))
        assertTrue(
            isAllowedLeafletMapResourceUrl(
                "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"
            )
        )
    }

    @Test
    fun isAllowedLeafletMapResourceUrl_allowsGeneratedHtmlDataDocument() {
        assertTrue(
            isAllowedLeafletMapResourceUrl(
                "data:text/html;charset=utf-8;base64,PCFET0NUWVBFIGh0bWw+"
            )
        )
    }

    @Test
    fun isAllowedLeafletMapResourceUrl_allowsOnlyOpenStreetMapTileHosts() {
        assertTrue(isAllowedLeafletMapResourceUrl("https://tile.openstreetmap.org/13/4776/3078.png"))
        assertTrue(isAllowedLeafletMapResourceUrl("https://a.tile.openstreetmap.org/13/4776/3078.png"))
        assertTrue(isAllowedLeafletMapResourceUrl("https://b.tile.openstreetmap.org/13/4776/3078.png"))
        assertTrue(isAllowedLeafletMapResourceUrl("https://c.tile.openstreetmap.org/13/4776/3078.png"))

        assertFalse(isAllowedLeafletMapResourceUrl("https://d.tile.openstreetmap.org/13/4776/3078.png"))
        assertFalse(isAllowedLeafletMapResourceUrl("http://tile.openstreetmap.org/13/4776/3078.png"))
    }

    @Test
    fun isAllowedLeafletMapResourceUrl_blocksUnrelatedHosts() {
        assertFalse(isAllowedLeafletMapResourceUrl("https://example.com/leaflet@1.9.4/dist/leaflet.js"))
        assertFalse(isAllowedLeafletMapResourceUrl("https://unpkg.com/other-package/dist/file.js"))
        assertFalse(isAllowedLeafletMapResourceUrl("https://evil.example/13/4776/3078.png"))
        assertFalse(isAllowedLeafletMapResourceUrl("data:image/png;base64,iVBORw0KGgo="))
    }

    @Test
    fun buildLeafletMarkerMapHtml_serializesMarkersAndSelection() {
        val html = buildLeafletMarkerMapHtml(
            mapInstanceId = "test-map-1",
            centerLatitude = 41.0,
            centerLongitude = 29.0,
            markers = listOf(
                LeafletMapMarker(
                    id = "area-1",
                    latitude = 41.01,
                    longitude = 29.02,
                    title = "Assembly Area",
                    subtitle = "Assembly Point"
                )
            ),
            selectedMarkerId = "area-1",
            bridgeName = "AndroidLeafletMarkerMap"
        )

        assertTrue(html.contains("\"id\":\"area-1\""))
        assertTrue(html.contains("var nephMapInstanceId = \"test-map-1\";"))
        assertTrue(html.contains("var selectedMarkerId = \"area-1\";"))
        assertTrue(html.contains("window.nephSelectMarker = function(markerId)"))
        assertTrue(html.contains("window.nephSelectMarker(marker.id);"))
        assertTrue(html.contains("window.AndroidLeafletMarkerMap.onMarkerSelected(nephMapInstanceId, marker.id);"))
        assertTrue(html.contains("map.fitBounds(bounds"))
        assertTrue(html.contains("scheduleMapInvalidateSize(map, mapElement);"))
        assertTrue(html.contains("ensureNephMapHeight(mapElement);"))
        assertTrue(html.contains("L.circleMarker(center"))
        assertTrue(html.contains("Search center"))
    }

    @Test
    fun buildLeafletMarkerMapHtml_canDisableSearchCenterMarker() {
        val html = buildLeafletMarkerMapHtml(
            mapInstanceId = "test-map-no-center",
            centerLatitude = 39.0,
            centerLongitude = 35.0,
            markers = emptyList(),
            selectedMarkerId = null,
            bridgeName = "AndroidLeafletMarkerMap",
            showCenterMarker = false
        )

        assertFalse(html.contains("L.circleMarker(center"))
        assertFalse(html.contains("Search center"))
    }

    @Test
    fun buildLeafletMarkerMapHtml_includesReadyBreadcrumbsAndFallback() {
        val html = buildLeafletMarkerMapHtml(
            mapInstanceId = "test-map-2",
            centerLatitude = 41.0,
            centerLongitude = 29.0,
            markers = emptyList(),
            selectedMarkerId = null,
            bridgeName = "AndroidLeafletMarkerMap",
            mapHeightCssPx = 280
        )

        assertTrue(html.contains("NEPH_MAP: script started"))
        assertTrue(html.contains("var nephMapDebugLogsEnabled = "))
        assertTrue(html.contains("NEPH_MAP: Leaflet available"))
        assertTrue(html.contains("NEPH_MAP: map element found"))
        assertTrue(html.contains("NEPH_MAP: map created"))
        assertTrue(html.contains("NEPH_MAP: tile layer added"))
        assertTrue(html.contains("NEPH_MAP: whenReady fired"))
        assertTrue(html.contains("NEPH_MAP: notifying Android ready"))
        assertTrue(html.contains("window.AndroidLeafletMarkerMap.onMapReady(nephMapInstanceId);"))
        assertTrue(html.contains("window.AndroidLeafletMarkerMap.onMapError(nephMapInstanceId, errorMessage);"))
        assertTrue(html.contains(LeafletMapTileLoadErrorMessage))
        assertTrue(html.contains("var nephMapFallbackHeightCssPx = 280;"))
        assertTrue(html.contains("NEPH_MAP: applied fallback map height height="))
        assertTrue(html.contains("NEPH_MAP: map size "))
        assertTrue(html.contains("before L.map"))
        assertTrue(html.contains("after L.map"))
        assertTrue(html.contains("after invalidateSize"))
        assertTrue(html.contains("NEPH_MAP: tileloadstart"))
        assertTrue(html.contains("NEPH_MAP: tileload"))
        assertTrue(html.contains("NEPH_MAP: tile error"))
        assertTrue(html.contains("function notifyMapAlive(source)"))
        assertTrue(html.contains("notifyMapAlive('map-created');"))
        assertTrue(html.contains("notifyMapAlive('tileloadstart');"))
        assertTrue(html.contains("notifyMapAlive('tileload');"))
        assertTrue(html.contains("function notifyMapReadyOnce()"))
        assertTrue(html.contains("setTimeout(notifyMapReadyOnce, 1000);"))
    }
}
