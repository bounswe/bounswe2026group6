package com.neph.features.notifications.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Process-wide holder for the unread notifications/alerts count.
 *
 * Updated by:
 * - [NotificationsRepository] callers after fetching a page (`set`).
 * - The FCM service when a new push arrives (`increment`).
 * - The notifications screen when items are marked as read (`decrement`/`clear`).
 *
 * Observed by [com.neph.ui.layout.AppDrawerScaffold] to render the Alerts badge.
 */
object NotificationsBadge {
    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

    fun set(count: Int) {
        _unreadCount.value = count.coerceAtLeast(0)
    }

    fun increment(by: Int = 1) {
        _unreadCount.value = (_unreadCount.value + by).coerceAtLeast(0)
    }

    fun decrement(by: Int = 1) {
        _unreadCount.value = (_unreadCount.value - by).coerceAtLeast(0)
    }

    fun clear() {
        _unreadCount.value = 0
    }
}
