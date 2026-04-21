package com.neph.features.gatheringareas.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GatheringAreasRepositoryTest {
    @Test
    fun parseNearbyGatheringAreasResponse_mapsValidFeaturesAndSkipsMalformedOnes() {
        val response = JSONObject(
            """
            {
              "center": { "lat": 41.01, "lon": 29.01 },
              "radius": 1500,
              "source": "overpass",
              "meta": { "requestedLimit": 10, "returnedCount": 3 },
              "collection": {
                "type": "FeatureCollection",
                "features": [
                  {
                    "type": "Feature",
                    "geometry": { "type": "Point", "coordinates": [29.012, 41.011] },
                    "properties": {
                      "id": "node-1",
                      "osmType": "node",
                      "name": "Assembly Area A",
                      "category": "assembly_point",
                      "distanceMeters": 120,
                      "rawTags": { "addr:street": "Main Street" }
                    }
                  },
                  {
                    "type": "Feature",
                    "geometry": { "type": "Point", "coordinates": [29.02] },
                    "properties": {
                      "id": "broken"
                    }
                  },
                  {
                    "type": "Feature",
                    "geometry": { "type": "Point", "coordinates": [29.014, 41.013] },
                    "properties": {
                      "id": "node-2",
                      "osmType": "way",
                      "name": "",
                      "category": "shelter",
                      "distanceMeters": 250,
                      "rawTags": { "name": "Shelter B" }
                    }
                  }
                ]
              }
            }
            """.trimIndent()
        )

        val parsed = GatheringAreasRepository.parseNearbyGatheringAreasResponse(
            response = response,
            fallbackLatitude = 40.0,
            fallbackLongitude = 29.0
        )

        assertEquals(2, parsed.returnedCount)
        assertEquals(1, parsed.skippedCount)
        assertEquals(1500, parsed.radiusMeters)
        assertEquals("overpass", parsed.source)
        assertEquals(10, parsed.requestedLimit)

        assertEquals("node-1", parsed.areas[0].id)
        assertEquals("Main Street", parsed.areas[0].addressLine)
        assertEquals("shelter", parsed.areas[1].category)
        assertEquals("Shelter B", parsed.areas[1].name)
    }

    @Test
    fun parseNearbyGatheringAreasResponse_usesFallbackCenterAndDistanceWhenMissingInPayload() {
        val response = JSONObject(
            """
            {
              "collection": {
                "type": "FeatureCollection",
                "features": [
                  {
                    "type": "Feature",
                    "geometry": { "type": "Point", "coordinates": [32.851, 39.922] },
                    "properties": {
                      "id": "fallback-1",
                      "category": "assembly_point",
                      "rawTags": {}
                    }
                  }
                ]
              }
            }
            """.trimIndent()
        )

        val parsed = GatheringAreasRepository.parseNearbyGatheringAreasResponse(
            response = response,
            fallbackLatitude = 39.92,
            fallbackLongitude = 32.85,
            fallbackRadius = 2000,
            fallbackLimit = 20
        )

        assertEquals(39.92, parsed.centerLatitude, 0.0)
        assertEquals(32.85, parsed.centerLongitude, 0.0)
        assertEquals(2000, parsed.radiusMeters)
        assertEquals(20, parsed.requestedLimit)
        assertEquals(1, parsed.returnedCount)
        assertNotNull(parsed.areas.first().distanceMeters)
        assertTrue(parsed.areas.first().distanceMeters >= 0)
    }
}
