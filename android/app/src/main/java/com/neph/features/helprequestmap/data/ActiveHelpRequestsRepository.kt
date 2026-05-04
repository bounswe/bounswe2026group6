package com.neph.features.helprequestmap.data

import com.neph.core.network.JsonHttpClient
import com.neph.features.auth.data.AuthSessionStore
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

enum class CrisisRequestType {
    SHELTER,
    FIRST_AID,
    SEARCH_AND_RESCUE,
    FOOD_WATER,
    OTHER
}

data class ActiveHelpRequestMapItem(
    val requestId: String,
    val rawType: String,
    val type: CrisisRequestType,
    val typeLabel: String,
    val priorityLevel: String,
    val createdAt: String,
    val latitude: Double,
    val longitude: Double,
    val city: String,
    val district: String
)

data class ActiveHelpRequestsResult(
    val requests: List<ActiveHelpRequestMapItem>,
    val total: Int,
    val limit: Int,
    val offset: Int,
    val skippedCount: Int
)

object ActiveHelpRequestsRepository {
    private const val DefaultLimit = 300

    suspend fun fetchWaitingHelpRequests(
        limit: Int = DefaultLimit,
        offset: Int = 0,
        type: String? = null,
        bbox: String? = null
    ): ActiveHelpRequestsResult {
        val query = buildList {
            add("status=PENDING")
            add("limit=${limit.coerceIn(1, DefaultLimit)}")
            add("offset=${offset.coerceAtLeast(0)}")
            type?.trim()?.takeIf { it.isNotBlank() }?.let {
                add("type=${urlEncode(it)}")
            }
            bbox?.trim()?.takeIf { it.isNotBlank() }?.let {
                add("bbox=${urlEncode(it)}")
            }
        }.joinToString("&")

        val response = JsonHttpClient.request(
            path = "/help-requests/active?$query",
            token = AuthSessionStore.getAccessToken()
        )

        return parseActiveHelpRequestsResponse(response)
    }

    internal fun parseActiveHelpRequestsResponse(response: JSONObject): ActiveHelpRequestsResult {
        val rawRequests = response.optJSONArray("requests") ?: JSONArray()
        var skippedCount = 0
        val parsed = buildList {
            for (index in 0 until rawRequests.length()) {
                val item = rawRequests.optJSONObject(index)
                if (item == null) {
                    skippedCount += 1
                    continue
                }

                val mapped = parseActiveHelpRequest(item)
                if (mapped == null) {
                    skippedCount += 1
                    continue
                }

                add(mapped)
            }
        }

        val pagination = response.optJSONObject("pagination") ?: JSONObject()
        return ActiveHelpRequestsResult(
            requests = parsed,
            total = response.optInt("total", parsed.size),
            limit = pagination.optInt("limit", DefaultLimit),
            offset = pagination.optInt("offset", 0),
            skippedCount = skippedCount
        )
    }

    private fun parseActiveHelpRequest(item: JSONObject): ActiveHelpRequestMapItem? {
        val status = item.optString("status").trim().uppercase(Locale.ROOT)
        val assignmentState = item.optString("assignmentState").trim().uppercase(Locale.ROOT)
        if (status != "PENDING" || assignmentState == "ASSIGNED") {
            return null
        }

        val location = item.optJSONObject("location") ?: return null
        val latitude = location.optFiniteDouble("latitude") ?: return null
        val longitude = location.optFiniteDouble("longitude") ?: return null
        if (latitude !in -90.0..90.0 || longitude !in -180.0..180.0) {
            return null
        }

        val rawType = item.optString("type").trim().ifBlank { "unknown" }
        val type = normalizeRequestType(rawType)
        val priority = item.optString("urgencyLevel").trim().uppercase(Locale.ROOT).ifBlank { "MEDIUM" }

        return ActiveHelpRequestMapItem(
            requestId = item.optString("requestId").trim().ifBlank { return null },
            rawType = rawType,
            type = type,
            typeLabel = labelForType(type),
            priorityLevel = when (priority) {
                "LOW", "MEDIUM", "HIGH" -> priority
                else -> "MEDIUM"
            },
            createdAt = item.optString("createdAt").trim(),
            latitude = latitude,
            longitude = longitude,
            city = location.optString("city").trim().ifBlank { "unknown" },
            district = location.optString("district").trim().ifBlank { "unknown" }
        )
    }

    fun normalizeRequestType(rawType: String): CrisisRequestType {
        return when (rawType.trim().lowercase(Locale.ROOT)) {
            "shelter" -> CrisisRequestType.SHELTER
            "first_aid" -> CrisisRequestType.FIRST_AID
            "fire_brigade",
            "search_and_rescue" -> CrisisRequestType.SEARCH_AND_RESCUE
            "food",
            "water",
            "food_water" -> CrisisRequestType.FOOD_WATER
            else -> CrisisRequestType.OTHER
        }
    }

    fun labelForType(type: CrisisRequestType): String {
        return when (type) {
            CrisisRequestType.SHELTER -> "Shelter"
            CrisisRequestType.FIRST_AID -> "First Aid"
            CrisisRequestType.SEARCH_AND_RESCUE -> "Search and Rescue"
            CrisisRequestType.FOOD_WATER -> "Food / Water Supplies"
            CrisisRequestType.OTHER -> "Other / Unknown"
        }
    }

    fun formatPriority(priority: String): String {
        return priority.trim().lowercase(Locale.ROOT).replaceFirstChar { it.uppercase() }
    }

    fun formatOpenedAt(createdAt: String): String {
        val parsed = runCatching {
            IsoDateFormat.get().parse(createdAt)
        }.getOrNull() ?: return createdAt

        return DisplayDateFormat.get().format(parsed)
    }

    private fun urlEncode(value: String): String {
        return URLEncoder.encode(value, StandardCharsets.UTF_8.toString())
    }

    private val IsoDateFormat = object : ThreadLocal<SimpleDateFormat>() {
        override fun initialValue(): SimpleDateFormat {
            return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
        }
    }

    private val DisplayDateFormat = object : ThreadLocal<SimpleDateFormat>() {
        override fun initialValue(): SimpleDateFormat {
            return SimpleDateFormat("MMM d, yyyy, HH:mm", Locale.US).apply {
                timeZone = TimeZone.getDefault()
            }
        }
    }
}

private fun JSONObject.optFiniteDouble(key: String): Double? {
    if (!has(key) || isNull(key)) return null
    val value = optDouble(key)
    return value.takeIf { it.isFinite() }
}
