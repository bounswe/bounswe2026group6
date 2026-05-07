package com.neph.features.operationallocation.data

import android.content.Context
import android.util.Log
import com.neph.features.profile.data.DeviceLocationProvider
import kotlinx.coroutines.withTimeoutOrNull

private const val Tag = "OperationalLocationUpdater"
private const val OperationalLocationCaptureTimeoutMillis = 5_000L

object OperationalLocationUpdater {
    @Volatile private var refreshInProgress = false

    suspend fun refreshIfAllowed(context: Context) {
        if (refreshInProgress) {
            return
        }

        refreshInProgress = true
        val appContext = context.applicationContext

        try {
            runCatching {
                OperationalLocationRepository.syncPendingIfAuthenticated()
            }.onFailure { error ->
                Log.w(Tag, "Pending operational location sync failed.", error)
            }

            if (!DeviceLocationProvider.hasLocationPermission(appContext)) {
                return
            }

            val shouldRefresh = runCatching {
                OperationalLocationRepository.shouldRefresh()
            }.getOrDefault(false)

            if (!shouldRefresh) {
                return
            }

            val location = runCatching {
                withTimeoutOrNull(OperationalLocationCaptureTimeoutMillis) {
                    DeviceLocationProvider.getCurrentLocation(appContext)
                }
            }.getOrNull() ?: return

            runCatching {
                OperationalLocationRepository.saveAndSyncIfAuthenticated(location)
            }.onFailure { error ->
                Log.w(Tag, "Operational location refresh failed.", error)
            }
        } finally {
            refreshInProgress = false
        }
    }
}
