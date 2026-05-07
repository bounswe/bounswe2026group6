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
    }
}
