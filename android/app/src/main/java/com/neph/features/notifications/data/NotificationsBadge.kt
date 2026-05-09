package com.neph.features.notifications.data

import android.util.Log
import com.neph.features.auth.data.AuthSessionStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Process-wide holder for the unread notifications/alerts count.
 *
 * Updated by:
 * - [NotificationsRepository] callers after fetching a page (`set`).
 * - The FCM service when a new push arrives (`increment`).
 * - The notifications screen when items are marked as read (`decrement`/`clear`).
 * - [hydrateIfAuthenticated] on authenticated app start / resume / login.
 *
 * Observed by [com.neph.ui.layout.AppDrawerScaffold] to render the Alerts badge.
 */
object NotificationsBadge {
    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

    private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

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

    /**
     * Fetches the current unread count from the backend if the user is
     * authenticated and updates the badge. Safe to call from app start and
     * resume — failures are swallowed and logged so they never block UI.
     */
    fun hydrateIfAuthenticated() {
        val token = AuthSessionStore.getAccessToken()
        if (token.isNullOrBlank()) {
            return
        }
        ioScope.launch {
            try {
                val page = NotificationsRepository.fetchNotifications(
                    token = token,
                    limit = 1,
                    unreadOnly = true
                )
                set(page.unreadCount)
            } catch (error: Exception) {
                Log.w("NotificationsBadge", "Failed to hydrate unread count", error)
            }
        }
    }
}
