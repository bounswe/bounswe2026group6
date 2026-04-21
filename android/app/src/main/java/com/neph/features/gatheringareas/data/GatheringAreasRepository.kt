package com.neph.features.gatheringareas.data

import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

data class GatheringAreaItem(
    val id: String,
    val osmType: String,
    val name: String,
    val category: String,
    val latitude: Double,
    val longitude: Double,
    val distanceMeters: Int,
    val addressLine: String?
)

data class NearbyGatheringAreasResult(
    val centerLatitude: Double,
    val centerLongitude: Double,
    val radiusMeters: Int,
    val source: String,
    val requestedLimit: Int,
    val returnedCount: Int,
    val skippedCount: Int,
    val areas: List<GatheringAreaItem>
)

object GatheringAreasRepository {
    private const val DefaultRadiusMeters = 2000
    private const val DefaultLimit = 20
    private const val MaxRadiusMeters = 10000
    private const val MaxLimit = 50
    private const val NearbyRequestTimeoutMillis = 8000L

    suspend fun fetchNearbyGatheringAreas(
        latitude: Double,
        longitude: Double,
        radiusMeters: Int = DefaultRadiusMeters,
        limit: Int = DefaultLimit
    ): NearbyGatheringAreasResult {
        val normalizedRadius = radiusMeters.coerceIn(1, MaxRadiusMeters)
        val normalizedLimit = limit.coerceIn(1, MaxLimit)

        val response = withTimeoutOrNull(NearbyRequestTimeoutMillis) {
            JsonHttpClient.request(
                path = String.format(
                    Locale.US,
                    "/gathering-areas/nearby?lat=%.6f&lon=%.6f&radius=%d&limit=%d",
                    latitude,
                    longitude,
                    normalizedRadius,
                    normalizedLimit
                )
            )
        } ?: throw ApiException(
            message = "Gathering areas request timed out.",
            status = 504,
            code = "OVERPASS_TIMEOUT"
        )

        return parseNearbyGatheringAreasResponse(
            response = response,
            fallbackLatitude = latitude,
            fallbackLongitude = longitude,
            fallbackRadius = normalizedRadius,
            fallbackLimit = normalizedLimit
        )
    }

    internal fun parseNearbyGatheringAreasResponse(
        response: JSONObject,
        fallbackLatitude: Double,
        fallbackLongitude: Double,
        fallbackRadius: Int = DefaultRadiusMeters,
        fallbackLimit: Int = DefaultLimit
    ): NearbyGatheringAreasResult {
        val centerJson = response.optJSONObject("center") ?: JSONObject()
        val centerLatitude = centerJson.optFiniteDouble("lat") ?: fallbackLatitude
        val centerLongitude = centerJson.optFiniteDouble("lon") ?: fallbackLongitude

        val radiusMeters = response.optPositiveInt("radius") ?: fallbackRadius
        val source = response.optString("source").trim().ifBlank { "overpass" }

        val metaJson = response.optJSONObject("meta") ?: JSONObject()
        val requestedLimit = metaJson.optPositiveInt("requestedLimit") ?: fallbackLimit

        val features = response
            .optJSONObject("collection")
            ?.optJSONArray("features")
            ?: JSONArray()

        var skippedCount = 0
        val parsedAreas = buildList {
            for (index in 0 until features.length()) {
                val feature = features.optJSONObject(index)
                if (feature == null) {
                    skippedCount += 1
                    continue
                }

                val parsed = parseFeature(
                    feature = feature,
                    index = index,
                    centerLatitude = centerLatitude,
                    centerLongitude = centerLongitude
                )
                if (parsed == null) {
                    skippedCount += 1
                    continue
                }

                add(parsed)
            }
        }

        val sortedAreas = parsedAreas.sortedBy { it.distanceMeters }

        return NearbyGatheringAreasResult(
            centerLatitude = centerLatitude,
            centerLongitude = centerLongitude,
            radiusMeters = radiusMeters,
            source = source,
            requestedLimit = requestedLimit,
            returnedCount = sortedAreas.size,
            skippedCount = skippedCount,
            areas = sortedAreas
        )
    }

    private fun parseFeature(
        feature: JSONObject,
        index: Int,
        centerLatitude: Double,
        centerLongitude: Double
    ): GatheringAreaItem? {
        val geometry = feature.optJSONObject("geometry") ?: return null
        val coordinates = geometry.optJSONArray("coordinates") ?: return null

        val longitude = coordinates.optFiniteDouble(0) ?: return null
        val latitude = coordinates.optFiniteDouble(1) ?: return null

        if (latitude !in -90.0..90.0 || longitude !in -180.0..180.0) {
            return null
        }

        val properties = feature.optJSONObject("properties") ?: JSONObject()
        val rawTags = properties.optJSONObject("rawTags") ?: JSONObject()

        val id = properties.optString("id").trim().ifBlank { "feature-$index" }
        val osmType = properties.optString("osmType").trim()

        val resolvedName = properties.optString("name").trim().ifBlank {
            rawTags.optString("name").trim().ifBlank {
                rawTags.optString("name:tr").trim()
            }
        }

        val category = properties.optString("category").trim().ifBlank {
            rawTags.optString("emergency").trim().ifBlank {
                rawTags.optString("amenity").trim().ifBlank { "unknown" }
            }
        }

        val payloadDistance = properties.optNonNegativeInt("distanceMeters")
        val distanceMeters = payloadDistance ?: calculateDistanceMeters(
            fromLatitude = centerLatitude,
            fromLongitude = centerLongitude,
            toLatitude = latitude,
            toLongitude = longitude
        )

        val addressLine = listOf(
            rawTags.optString("addr:full").trim(),
            rawTags.optString("addr:street").trim(),
            rawTags.optString("description").trim()
        ).firstOrNull { it.isNotBlank() }

        return GatheringAreaItem(
            id = id,
            osmType = osmType,
            name = resolvedName,
            category = category,
            latitude = latitude,
            longitude = longitude,
            distanceMeters = distanceMeters,
            addressLine = addressLine
        )
    }

    private fun calculateDistanceMeters(
        fromLatitude: Double,
        fromLongitude: Double,
        toLatitude: Double,
        toLongitude: Double
    ): Int {
        val earthRadiusMeters = 6_371_000.0
        val dLat = Math.toRadians(toLatitude - fromLatitude)
        val dLon = Math.toRadians(toLongitude - fromLongitude)

        val a =
            sin(dLat / 2) * sin(dLat / 2) +
                cos(Math.toRadians(fromLatitude)) * cos(Math.toRadians(toLatitude)) *
                sin(dLon / 2) * sin(dLon / 2)

        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return (earthRadiusMeters * c).roundToInt()
    }
}

private fun JSONObject.optFiniteDouble(key: String): Double? {
    if (!has(key)) return null
    val value = optDouble(key)
    return if (value.isFinite()) value else null
}

private fun JSONArray.optFiniteDouble(index: Int): Double? {
    if (index < 0 || index >= length()) return null
    val value = optDouble(index)
    return if (value.isFinite()) value else null
}

private fun JSONObject.optPositiveInt(key: String): Int? {
    if (!has(key)) return null
    val value = optInt(key)
    return value.takeIf { it > 0 }
}

private fun JSONObject.optNonNegativeInt(key: String): Int? {
    if (!has(key)) return null
    val value = optInt(key)
    return value.takeIf { it >= 0 }
}
