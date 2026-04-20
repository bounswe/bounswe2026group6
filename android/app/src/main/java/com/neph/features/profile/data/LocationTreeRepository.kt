package com.neph.features.profile.data

import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
import org.json.JSONArray
import org.json.JSONObject

object LocationTreeRepository {
    private const val DefaultCountryCode = "TR"
    private const val CacheTtlMs = 30 * 60 * 1000L

    @Volatile
    private var lastSyncedCountryCode: String? = null

    @Volatile
    private var lastSyncedAtMs: Long = 0L

    internal fun resetCacheMetadataForTesting() {
        lastSyncedCountryCode = null
        lastSyncedAtMs = 0L
    }

    suspend fun ensureLocationData(
        countryCode: String = DefaultCountryCode,
        forceRefresh: Boolean = false
    ): LocationData {
        val normalizedCountryCode = countryCode.trim().uppercase().ifBlank { DefaultCountryCode }
        val now = System.currentTimeMillis()

        val hasFreshCache = !forceRefresh &&
            lastSyncedCountryCode == normalizedCountryCode &&
            now - lastSyncedAtMs < CacheTtlMs &&
            locationData.isNotEmpty()

        if (hasFreshCache) {
            return locationData
        }

        val response = JsonHttpClient.request(
            path = "/location/tree?countryCode=$normalizedCountryCode"
        )

        val parsed = parseLocationTreeResponse(response)
        if (parsed.isEmpty()) {
            throw ApiException(
                message = "Location options are unavailable right now.",
                status = 0,
                code = "LOCATION_TREE_EMPTY"
            )
        }

        updateLocationData(parsed)
        lastSyncedCountryCode = normalizedCountryCode
        lastSyncedAtMs = now
        return parsed
    }

    internal fun parseLocationTreeResponse(response: JSONObject): LocationData {
        val tree = response.optJSONObject("tree") ?: JSONObject()
        if (tree.length() == 0) {
            return emptyMap()
        }

        val countries = linkedMapOf<String, Country>()

        for (countryKey in jsonKeys(tree)) {
            val countryJson = tree.optJSONObject(countryKey) ?: continue
            val normalizedCountryKey = countryKey.trim().lowercase()
            if (normalizedCountryKey.isBlank()) {
                continue
            }

            val citiesJson = countryJson.optJSONObject("cities") ?: JSONObject()
            val cities = linkedMapOf<String, City>()

            for (cityKey in jsonKeys(citiesJson)) {
                val cityJson = citiesJson.optJSONObject(cityKey) ?: continue
                val normalizedCityKey = cityKey.trim().lowercase()
                if (normalizedCityKey.isBlank()) {
                    continue
                }

                val districtsJson = cityJson.optJSONObject("districts") ?: JSONObject()
                val districts = linkedMapOf<String, District>()

                for (districtKey in jsonKeys(districtsJson)) {
                    val districtJson = districtsJson.optJSONObject(districtKey) ?: continue
                    val normalizedDistrictKey = districtKey.trim().lowercase()
                    if (normalizedDistrictKey.isBlank()) {
                        continue
                    }

                    val neighborhoods = parseNeighborhoods(
                        districtJson.optJSONArray("neighborhoods") ?: JSONArray()
                    )

                    districts[normalizedDistrictKey] = District(
                        label = districtJson.optString("label").trim().ifBlank { districtKey },
                        neighborhoods = neighborhoods
                    )
                }

                cities[normalizedCityKey] = City(
                    label = cityJson.optString("label").trim().ifBlank { cityKey },
                    districts = districts
                )
            }

            countries[normalizedCountryKey] = Country(
                label = countryJson.optString("label").trim().ifBlank { countryKey },
                cities = cities
            )
        }

        return countries
    }

    private fun parseNeighborhoods(array: JSONArray): List<Neighborhood> {
        return buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                val label = item.optString("label").trim()
                val value = item.optString("value").trim()
                if (label.isBlank() || value.isBlank()) {
                    continue
                }

                add(Neighborhood(label = label, value = value))
            }
        }
    }

    private fun jsonKeys(json: JSONObject): List<String> {
        val iterator = json.keys()
        val keys = mutableListOf<String>()
        while (iterator.hasNext()) {
            keys.add(iterator.next())
        }
        return keys
    }
}
