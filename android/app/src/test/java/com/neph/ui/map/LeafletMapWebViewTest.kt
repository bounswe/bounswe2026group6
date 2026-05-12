package com.neph.ui.map

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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
    fun leafletViewportDiscovery_usesWidestVisibleDimension() {
        val discoverable = viewport(widthKm = 20.0, heightKm = 50.0)
        val tooWide = viewport(widthKm = 20.0, heightKm = 50.1)

        assertTrue(isLeafletViewportDiscoverable(discoverable))
        assertFalse(isLeafletViewportDiscoverable(tooWide))
    }

    @Test
    fun leafletViewportDiscovery_rejectsInvalidBounds() {
        assertFalse(isLeafletViewportDiscoverable(viewport(widthKm = 10.0, heightKm = 10.0, north = 91.0)))
        assertFalse(isLeafletViewportDiscoverable(viewport(widthKm = Double.NaN, heightKm = 10.0)))
        assertFalse(isLeafletViewportDiscoverable(viewport(widthKm = 10.0, heightKm = 10.0, west = 30.0, east = 29.0)))
    }

    @Test
    fun effectiveLeafletViewportKey_roundsBoundsForDuplicateSuppression() {
        val first = viewport(widthKm = 20.0, heightKm = 20.0, west = 29.00044, east = 29.10044)
        val sameEffectiveViewport = viewport(widthKm = 20.0, heightKm = 20.0, west = 29.000449, east = 29.100449)

        assertEquals(effectiveLeafletViewportKey(first), effectiveLeafletViewportKey(sameEffectiveViewport))
        assertEquals("29.0004,40.9000,29.1004,41.1000,z12", effectiveLeafletViewportKey(first))
    }

    @Test
    fun shouldFetchLeafletViewport_skipsSameViewportUnlessManualRefresh() {
        assertFalse(
            shouldFetchLeafletViewport(
                viewportKey = "29.0004,40.9000,29.1004,41.1000,z12",
                lastFetchedViewportKey = "29.0004,40.9000,29.1004,41.1000,z12",
                manualRefresh = false
            )
        )
        assertTrue(
            shouldFetchLeafletViewport(
                viewportKey = "29.0004,40.9000,29.1004,41.1000,z12",
                lastFetchedViewportKey = "29.0004,40.9000,29.1004,41.1000,z12",
                manualRefresh = true
            )
        )
        assertTrue(
            shouldFetchLeafletViewport(
                viewportKey = "29.0010,40.9000,29.1010,41.1000,z12",
                lastFetchedViewportKey = "29.0004,40.9000,29.1004,41.1000,z12",
                manualRefresh = false
            )
        )
    }

    @Test
    fun leafletMapStatusOverlayMessage_prefersMapInitializationBeforeResourceStates() {
        assertEquals(
            "Loading map...",
            leafletMapStatusOverlayMessage(
                mapInitialized = false,
                mapError = "",
                loadingResources = true,
                updatingResources = true
            )
        )
        assertNull(
            leafletMapStatusOverlayMessage(
                mapInitialized = false,
                mapError = LeafletMapInitializationTimeoutMessage,
                loadingResources = false,
                updatingResources = false
            )
        )
    }

    @Test
    fun leafletMapStatusOverlayMessage_distinguishesLoadingAndUpdatingResources() {
        assertEquals(
            "Loading resources in this area...",
            leafletMapStatusOverlayMessage(
                mapInitialized = true,
                mapError = "",
                loadingResources = true,
                updatingResources = true
            )
        )
        assertEquals(
            "Updating visible area...",
            leafletMapStatusOverlayMessage(
                mapInitialized = true,
                mapError = "",
                loadingResources = false,
                updatingResources = true
            )
        )
        assertNull(
            leafletMapStatusOverlayMessage(
                mapInitialized = true,
                mapError = "",
                loadingResources = false,
                updatingResources = false
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
        assertTrue(head.contains("touch-action: none;"))
        assertTrue(head.contains("overscroll-behavior: contain;"))
        assertTrue(head.contains("user-select: none;"))
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
            currentLocationLatitude = null,
            currentLocationLongitude = null,
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
            currentLocationLatitude = null,
            currentLocationLongitude = null,
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
            currentLocationLatitude = null,
            currentLocationLongitude = null,
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
        assertTrue(html.contains("function notifyViewportChanged()"))
        assertTrue(html.contains("window.AndroidLeafletMarkerMap.onViewportChanged("))
        assertTrue(html.contains("map.on('moveend zoomend', notifyViewportChanged);"))
    }

    @Test
    fun buildLeafletMarkerMapHtml_canDisableMarkerFitBoundsForViewportDiscovery() {
        val html = buildLeafletMarkerMapHtml(
            mapInstanceId = "test-map-discovery",
            centerLatitude = 39.0,
            centerLongitude = 35.0,
            currentLocationLatitude = null,
            currentLocationLongitude = null,
            markers = emptyList(),
            selectedMarkerId = null,
            bridgeName = "AndroidLeafletMarkerMap",
            fitBoundsToMarkers = false
        )

        assertTrue(html.contains("var fitBoundsToMarkers = false;"))
        assertTrue(html.contains("if (fitBoundsToMarkers && bounds.length > 1)"))
    }

    private fun viewport(
        widthKm: Double,
        heightKm: Double,
        north: Double = 41.1,
        south: Double = 40.9,
        east: Double = 29.1,
        west: Double = 29.0
    ): LeafletMapViewport {
        return LeafletMapViewport(
            centerLatitude = (north + south) / 2,
            centerLongitude = (east + west) / 2,
            north = north,
            south = south,
            east = east,
            west = west,
            zoom = 12,
            widthKm = widthKm,
            heightKm = heightKm,
            widestVisibleDimensionKm = maxOf(widthKm, heightKm)
        )
    }
}
