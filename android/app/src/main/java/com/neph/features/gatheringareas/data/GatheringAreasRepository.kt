package com.neph.features.gatheringareas.data

import android.util.Log
import com.neph.BuildConfig
import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
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
    val categoryLabel: String,
    val latitude: Double,
    val longitude: Double,
    val distanceMeters: Int,
    val addressLine: String?
)

data class GatheringAreaCategoryMeta(
    val key: String,
    val label: String
)

data class NearbyGatheringAreasResult(
    val centerLatitude: Double,
    val centerLongitude: Double,
    val radiusMeters: Int,
    val source: String,
    val requestedLimit: Int,
    val returnedCount: Int,
    val skippedCount: Int,
    val providerErrorCode: String?,
    val stale: Boolean,
    val fallbackReason: String?,
    val categories: List<GatheringAreaCategoryMeta>,
    val areas: List<GatheringAreaItem>
)

object GatheringAreasRepository {
    internal const val DefaultRadiusMeters = 10000
    internal const val DefaultLimit = 50
    private const val MaxRadiusMeters = 10000
    private const val MaxLimit = 50
    private const val NearbyRequestTimeoutMillis = 12_000L
    private const val NearbyRequestHttpTimeoutMillis = 12_000
    private const val NearbyRequestTimeoutMessage = "Gathering areas request timed out."
    private const val NearbyRequestTimeoutCode = "OVERPASS_TIMEOUT"
    private const val DebugLogTag = "GatheringAreasRepo"

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
                ),
                connectTimeoutMillis = NearbyRequestHttpTimeoutMillis,
                readTimeoutMillis = NearbyRequestHttpTimeoutMillis,
                timeoutMessage = NearbyRequestTimeoutMessage,
                timeoutStatus = 504,
                timeoutCode = NearbyRequestTimeoutCode
            )
        } ?: throw ApiException(
            message = NearbyRequestTimeoutMessage,
            status = 504,
            code = NearbyRequestTimeoutCode
        )

        return parseNearbyGatheringAreasResponse(
            response = response,
            fallbackLatitude = latitude,
            fallbackLongitude = longitude,
            fallbackRadius = normalizedRadius,
            fallbackLimit = normalizedLimit
        )
    }

    suspend fun fetchViewportGatheringAreas(
        bbox: String,
        centerLatitude: Double,
        centerLongitude: Double,
        widestVisibleDimensionKm: Double,
        limit: Int = DefaultLimit
    ): NearbyGatheringAreasResult {
        val normalizedLimit = limit.coerceIn(1, MaxLimit)
        val normalizedRadiusMeters = (widestVisibleDimensionKm * 1000.0)
            .roundToInt()
            .coerceAtLeast(1)

        val response = withTimeoutOrNull(NearbyRequestTimeoutMillis) {
            JsonHttpClient.request(
                path = "/gathering-areas/viewport?bbox=${urlEncode(bbox)}&limit=$normalizedLimit",
                connectTimeoutMillis = NearbyRequestHttpTimeoutMillis,
                readTimeoutMillis = NearbyRequestHttpTimeoutMillis,
                timeoutMessage = NearbyRequestTimeoutMessage,
                timeoutStatus = 504,
                timeoutCode = NearbyRequestTimeoutCode
            )
        } ?: throw ApiException(
            message = NearbyRequestTimeoutMessage,
            status = 504,
            code = NearbyRequestTimeoutCode
        )

        val parsed = parseNearbyGatheringAreasResponse(
            response = response,
            fallbackLatitude = centerLatitude,
            fallbackLongitude = centerLongitude,
            fallbackRadius = normalizedRadiusMeters,
            fallbackLimit = normalizedLimit
        )
        logViewportFetchResult(bbox = bbox, result = parsed)
        return parsed
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
        val providerErrorCode = metaJson.optNullableString("providerErrorCode")
        val stale = metaJson.optBoolean("stale", false) || source == "stale_cache"
        val fallbackReason = metaJson.optNullableString("fallbackReason")
        val categories = parseCategoryMetadata(metaJson.optJSONArray("categories"))

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
            providerErrorCode = providerErrorCode,
            stale = stale,
            fallbackReason = fallbackReason,
            categories = categories,
            areas = sortedAreas
        )
    }

    private fun logViewportFetchResult(bbox: String, result: NearbyGatheringAreasResult) {
        if (!BuildConfig.DEBUG) return
        val providerCode = result.providerErrorCode?.let { " providerErrorCode=$it" }.orEmpty()
        Log.d(
            DebugLogTag,
            "viewport bbox=$bbox source=${result.source} returned=${result.returnedCount}$providerCode"
        )
    }

    private fun parseCategoryMetadata(raw: JSONArray?): List<GatheringAreaCategoryMeta> {
        if (raw == null) return emptyList()

        return buildList {
            for (index in 0 until raw.length()) {
                val item = raw.optJSONObject(index) ?: continue
                val key = item.optString("key").trim().lowercase()
                if (key.isBlank()) continue
                val label = item.optString("label").trim()
                add(
                    GatheringAreaCategoryMeta(
                        key = key,
                        label = if (label.isBlank()) formatCategoryLabel(key) else label
                    )
                )
            }
        }
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
        }.lowercase()
        val categoryLabel = properties.optString("categoryLabel").trim().ifBlank {
            formatCategoryLabel(category)
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
            categoryLabel = categoryLabel,
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

private fun urlEncode(value: String): String {
    return URLEncoder.encode(value, StandardCharsets.UTF_8.toString())
}

private fun formatCategoryLabel(category: String): String {
    val normalized = category.trim().lowercase()
    if (normalized.isBlank() || normalized == "unknown") return "Gathering Area"
    if (normalized == "assembly_point") return "Assembly Point"
    if (normalized == "fire_station") return "Fire Station"
    return normalized.split('_').joinToString(" ") { part ->
        part.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
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

private fun JSONObject.optNullableString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key).trim().ifBlank { null }
}
