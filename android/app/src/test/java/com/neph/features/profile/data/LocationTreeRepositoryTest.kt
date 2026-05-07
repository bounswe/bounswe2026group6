package com.neph.features.profile.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LocationTreeRepositoryTest {
    @Test
    fun parseLocationTreeResponse_mapsCountrySpecificBackendTreeToRequestedCountry() {
        val response = JSONObject(
            """
            {
              "countryCode": "TR",
              "tree": {
                "label": "Turkey",
                "cities": {
                  "ankara": {
                    "label": "Ankara",
                    "districts": {
                      "cankaya": {
                        "label": "Çankaya",
                        "neighborhoods": [
                          { "label": "Anıttepe", "value": "AnitTepeCode" }
                        ]
                      }
                    }
                  }
                }
              }
            }
            """.trimIndent()
        )

        val parsed = LocationTreeRepository.parseLocationTreeResponse(
            response = response,
            requestedCountryCode = "TR"
        )

        assertEquals(setOf("tr"), parsed.keys)
        assertEquals("Turkey", parsed["tr"]?.label)
        assertTrue(parsed["tr"]?.cities?.containsKey("ankara") == true)
        assertEquals("Ankara", parsed["tr"]?.cities?.get("ankara")?.label)
        assertTrue(parsed["tr"]?.cities?.get("ankara")?.districts?.containsKey("cankaya") == true)

        val neighborhoods = parsed["tr"]
            ?.cities
            ?.get("ankara")
            ?.districts
            ?.get("cankaya")
            ?.neighborhoods
            .orEmpty()
        assertEquals(1, neighborhoods.size)
        assertEquals("Anıttepe", neighborhoods.first().label)
        assertEquals("AnitTepeCode", neighborhoods.first().value)
    }

    @Test
    fun parseLocationTreeResponse_keepsCountryKeyedBackendTreeBehavior() {
        val response = JSONObject(
            """
            {
              "countryCode": "TR",
              "tree": {
                "TR": {
                  "label": "Turkey",
                  "cities": {
                    "ankara": {
                      "label": "Ankara",
                      "districts": {
                        "cankaya": {
                          "label": "Çankaya",
                          "neighborhoods": [
                            { "label": "Anıttepe", "value": "AnitTepeCode" }
                          ]
                        }
                      }
                    }
                  }
                }
              }
            }
            """.trimIndent()
        )

        val parsed = LocationTreeRepository.parseLocationTreeResponse(response)

        assertTrue(parsed.containsKey("tr"))
        assertEquals("Turkey", parsed["tr"]?.label)
        assertTrue(parsed["tr"]?.cities?.containsKey("ankara") == true)
        assertEquals("Ankara", parsed["tr"]?.cities?.get("ankara")?.label)
        assertTrue(parsed["tr"]?.cities?.get("ankara")?.districts?.containsKey("cankaya") == true)

        val neighborhoods = parsed["tr"]
            ?.cities
            ?.get("ankara")
            ?.districts
            ?.get("cankaya")
            ?.neighborhoods
            .orEmpty()
        assertEquals(1, neighborhoods.size)
        assertEquals("Anıttepe", neighborhoods.first().label)
        assertEquals("AnitTepeCode", neighborhoods.first().value)
    }

    @Test
    fun parseLocationTreeResponse_returnsEmptyMapForEmptyOrMalformedTree() {
        assertTrue(
            LocationTreeRepository.parseLocationTreeResponse(
                JSONObject("""{ "tree": {} }""")
            ).isEmpty()
        )

        assertTrue(
            LocationTreeRepository.parseLocationTreeResponse(
                JSONObject(
                    """
                    {
                      "tree": {
                        "TR": "Turkey",
                        "cities": "not-a-city-map"
                      }
                    }
                    """.trimIndent()
                )
            ).isEmpty()
        )
    }
}
