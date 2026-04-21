package com.neph.features.profile.data

import android.content.Context
import android.util.Log
import com.neph.core.network.ApiException
import com.neph.features.auth.data.AuthSessionStore
import kotlinx.coroutines.withTimeoutOrNull

private const val Tag = "NephLaunchLocation"
private const val LaunchLocationCaptureTimeoutMillis = 5_000L

enum class LaunchLocationSyncAction {
    SKIP,
    UPDATE_WITH_LOCATION,
    CLEAR_STALE_COORDINATES
}

object AppLaunchLocationUpdater {
    suspend fun updateOnAppLaunch(context: Context) {
        val appContext = context.applicationContext
        val hasAccessToken = !AuthSessionStore.getAccessToken().isNullOrBlank()
        val guestMode = AuthSessionStore.isGuestMode()

        if (!shouldRunLaunchLocationUpdate(hasAccessToken, guestMode)) {
            return
        }

        val profile = try {
            ProfileRepository.fetchAndCacheRemoteProfile()
        } catch (error: ApiException) {
            Log.w(Tag, "Skipping app-launch location update due to profile fetch API error.", error)
            return
        } catch (error: Exception) {
            Log.w(Tag, "Skipping app-launch location update due to profile fetch failure.", error)
            return
        }

        val permissionGranted = DeviceLocationProvider.hasLocationPermission(appContext)
        if (!shouldAttemptLocationCapture(profile.shareLocation == true, permissionGranted)) {
            return
        }

        val captureAttempt = try {
            withTimeoutOrNull(LaunchLocationCaptureTimeoutMillis) {
                DeviceLocationProvider.captureCurrentLocationForSharing(
                    context = appContext,
                    sharingEnabled = true
                )
            } ?: CurrentLocationShareAttempt(warning = CurrentLocationShareWarning.LOCATION_UNAVAILABLE)
        } catch (_: Exception) {
            CurrentLocationShareAttempt(warning = CurrentLocationShareWarning.LOCATION_UNAVAILABLE)
        }

        when (mapCaptureAttemptToSyncAction(captureAttempt)) {
            LaunchLocationSyncAction.UPDATE_WITH_LOCATION -> {
                runLocationSyncCatching(
                    profile = profile,
                    currentDeviceLocation = captureAttempt.location,
                    forceClearSharedCoordinates = false
                )
            }

            LaunchLocationSyncAction.CLEAR_STALE_COORDINATES -> {
                runLocationSyncCatching(
                    profile = profile,
                    currentDeviceLocation = null,
                    forceClearSharedCoordinates = true
                )
            }

            LaunchLocationSyncAction.SKIP -> {
                // No-op by design.
            }
        }
    }

    internal fun shouldRunLaunchLocationUpdate(hasAccessToken: Boolean, isGuestMode: Boolean): Boolean {
        return hasAccessToken && !isGuestMode
    }

    internal fun shouldAttemptLocationCapture(
        shareLocationEnabled: Boolean,
        permissionGranted: Boolean
    ): Boolean {
        return shareLocationEnabled && permissionGranted
    }

    internal fun mapCaptureAttemptToSyncAction(attempt: CurrentLocationShareAttempt): LaunchLocationSyncAction {
        if (attempt.location != null) {
            return LaunchLocationSyncAction.UPDATE_WITH_LOCATION
        }

        return when (attempt.warning) {
            CurrentLocationShareWarning.LOCATION_UNAVAILABLE -> LaunchLocationSyncAction.CLEAR_STALE_COORDINATES
            CurrentLocationShareWarning.PERMISSION_DENIED,
            null -> LaunchLocationSyncAction.SKIP
        }
    }

    private suspend fun runLocationSyncCatching(
        profile: ProfileData,
        currentDeviceLocation: CurrentDeviceLocation?,
        forceClearSharedCoordinates: Boolean
    ) {
        try {
            ProfileRepository.syncLocationOnLaunch(
                profile = profile,
                currentDeviceLocation = currentDeviceLocation,
                forceClearSharedCoordinates = forceClearSharedCoordinates
            )
        } catch (error: ApiException) {
            Log.w(Tag, "App-launch location sync API call failed.", error)
        } catch (error: Exception) {
            Log.w(Tag, "App-launch location sync failed.", error)
        }
    }
}
