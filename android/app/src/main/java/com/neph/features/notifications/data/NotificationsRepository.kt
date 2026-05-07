package com.neph.features.notifications.data

import com.neph.core.network.JsonHttpClient
import org.json.JSONObject

data class NotificationUiModel(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val isRead: Boolean,
    val createdAt: String?,
    val readAt: String?,
    val data: Map<String, String>
)

data class NotificationsPage(
    val items: List<NotificationUiModel>,
    val unreadCount: Int,
    val nextCursor: String?
)

object NotificationsRepository {
    suspend fun fetchNotifications(
        token: String,
        limit: Int = 20,
        cursor: String? = null,
        unreadOnly: Boolean = false
    ): NotificationsPage {
        val query = buildString {
            append("/notifications?limit=")
            append(limit)
            append("&unreadOnly=")
            append(unreadOnly)
            if (!cursor.isNullOrBlank()) {
                append("&cursor=")
                append(java.net.URLEncoder.encode(cursor, "UTF-8"))
            }
        }

        val response = JsonHttpClient.request(
            path = query,
            method = "GET",
            token = token
        )

        val itemsJson = response.optJSONArray("items")
        val items = buildList {
            if (itemsJson != null) {
                for (index in 0 until itemsJson.length()) {
                    val item = itemsJson.optJSONObject(index) ?: continue
                    add(item.toNotificationUiModel())
                }
            }
        }

        return NotificationsPage(
            items = items,
            unreadCount = response.optInt("unreadCount", 0),
            nextCursor = response.optString("nextCursor").takeIf { it.isNotBlank() }
        )
    }

    suspend fun markAsRead(token: String, notificationId: String): NotificationUiModel? {
        val response = JsonHttpClient.request(
            path = "/notifications/$notificationId/read",
            method = "PATCH",
            body = JSONObject(),
            token = token
        )

        return response.optJSONObject("notification")?.toNotificationUiModel()
    }

    suspend fun markAllAsRead(token: String): Int {
        val response = JsonHttpClient.request(
            path = "/notifications/read-all",
            method = "PATCH",
            body = JSONObject(),
            token = token
        )

        return response.optInt("updatedCount", 0)
    }

    suspend fun registerDeviceToken(
        token: String,
        deviceToken: String,
        platform: String = "ANDROID",
        provider: String = "FCM"
    ) {
        JsonHttpClient.request(
            path = "/notifications/devices/register",
            method = "POST",
            body = JSONObject()
                .put("platform", platform)
                .put("provider", provider)
                .put("deviceToken", deviceToken),
            token = token
        )
    }

    suspend fun unregisterDeviceToken(
        token: String,
        deviceToken: String,
        provider: String = "FCM"
    ) {
        JsonHttpClient.request(
            path = "/notifications/devices/unregister",
            method = "POST",
            body = JSONObject()
                .put("provider", provider)
                .put("deviceToken", deviceToken),
            token = token
        )
    }
}

private fun JSONObject.toNotificationUiModel(): NotificationUiModel {
    val dataObject = optJSONObject("data")
    val data = mutableMapOf<String, String>()
    if (dataObject != null) {
        val iterator = dataObject.keys()
        while (iterator.hasNext()) {
            val key = iterator.next()
            data[key] = dataObject.optString(key)
        }
    }

    return NotificationUiModel(
        id = optString("id"),
        type = optString("type"),
        title = optString("title").ifBlank { "Notification" },
        body = optString("body"),
        isRead = optBoolean("isRead", false),
        createdAt = optString("createdAt").takeIf { it.isNotBlank() },
        readAt = optString("readAt").takeIf { it.isNotBlank() },
        data = data
    )
}
