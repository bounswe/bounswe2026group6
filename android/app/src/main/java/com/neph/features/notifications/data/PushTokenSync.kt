package com.neph.features.notifications.data

import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import com.neph.features.auth.data.AuthSessionStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private const val PushTag = "PushTokenSync"

object PushTokenSync {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun syncCurrentToken() {
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                syncProvidedToken(token)
            }
            .addOnFailureListener { error ->
                Log.w(PushTag, "Failed to fetch FCM token", error)
            }
    }

    fun syncProvidedToken(deviceToken: String) {
        if (deviceToken.isBlank()) {
            return
        }

        val accessToken = AuthSessionStore.getAccessToken()
        if (accessToken.isNullOrBlank()) {
            return
        }

        scope.launch {
            try {
                NotificationsRepository.registerDeviceToken(
                    token = accessToken,
                    deviceToken = deviceToken,
                    platform = "ANDROID",
                    provider = "FCM"
                )
            } catch (error: Exception) {
                Log.w(PushTag, "Failed to sync FCM token with backend", error)
            }
        }
    }
}
