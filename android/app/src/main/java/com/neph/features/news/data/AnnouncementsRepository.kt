package com.neph.features.news.data

import com.neph.core.network.JsonHttpClient
import org.json.JSONObject

data class Announcement(
    val id: String,
    val adminId: String?,
    val title: String,
    val content: String,
    val createdAt: String?
)

object AnnouncementsRepository {
    private const val DefaultLimit = 100

    suspend fun fetchAnnouncements(limit: Int = DefaultLimit): List<Announcement> {
        val normalizedLimit = limit.coerceIn(1, 200)
        val response = JsonHttpClient.request(
            path = "/announcements?limit=$normalizedLimit"
        )

        val rawList = response.optJSONArray("announcements") ?: return emptyList()
        val items = mutableListOf<Announcement>()
        for (i in 0 until rawList.length()) {
            val obj = rawList.optJSONObject(i) ?: continue
            items.add(parseAnnouncement(obj))
        }
        return items
    }

    suspend fun fetchAnnouncement(announcementId: String): Announcement {
        val response = JsonHttpClient.request(
            path = "/announcements/${java.net.URLEncoder.encode(announcementId, Charsets.UTF_8.name())}"
        )
        val obj = response.optJSONObject("announcement")
            ?: throw IllegalStateException("Announcement response did not include an announcement object.")
        return parseAnnouncement(obj)
    }

    private fun parseAnnouncement(json: JSONObject): Announcement {
        return Announcement(
            id = json.optString("id"),
            adminId = json.optString("adminId").takeIf { it.isNotBlank() },
            title = json.optString("title"),
            content = json.optString("content"),
            createdAt = json.optString("createdAt").takeIf { it.isNotBlank() }
        )
    }
}
