package com.neph.ui.map

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LeafletMapWebViewTest {
    @Test
    fun buildLeafletDocumentHead_allowsLeafletOriginWithoutQuotedUrlSources() {
        val head = buildLeafletDocumentHead()

        assertTrue(head.contains("script-src https://unpkg.com 'unsafe-inline'"))
        assertTrue(head.contains("style-src 'self' https://unpkg.com 'unsafe-inline'"))
        assertFalse(head.contains("script-src 'https://unpkg.com"))
        assertFalse(head.contains("style-src 'self' 'https://unpkg.com"))
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
        assertTrue(html.contains("var selectedMarkerId = \"area-1\";"))
        assertTrue(html.contains("window.AndroidLeafletMarkerMap.onMarkerSelected(marker.id);"))
        assertTrue(html.contains("map.fitBounds(bounds"))
        assertTrue(html.contains("scheduleMapInvalidateSize(map);"))
    }
}
