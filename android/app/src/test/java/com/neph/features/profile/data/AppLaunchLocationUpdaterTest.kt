package com.neph.features.profile.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppLaunchLocationUpdaterTest {
    @Test
    fun shouldRunLaunchLocationUpdate_requiresAuthenticatedNonGuestUser() {
        assertTrue(
            AppLaunchLocationUpdater.shouldRunLaunchLocationUpdate(
                hasAccessToken = true,
                isGuestMode = false
            )
        )

        assertFalse(
            AppLaunchLocationUpdater.shouldRunLaunchLocationUpdate(
                hasAccessToken = false,
                isGuestMode = false
            )
        )

        assertFalse(
            AppLaunchLocationUpdater.shouldRunLaunchLocationUpdate(
                hasAccessToken = true,
                isGuestMode = true
            )
        )
    }

    @Test
    fun shouldAttemptLocationCapture_requiresSharingEnabledAndPermissionGranted() {
        assertTrue(
            AppLaunchLocationUpdater.shouldAttemptLocationCapture(
                shareLocationEnabled = true,
                permissionGranted = true
            )
        )

        assertFalse(
            AppLaunchLocationUpdater.shouldAttemptLocationCapture(
                shareLocationEnabled = false,
                permissionGranted = true
            )
        )

        assertFalse(
            AppLaunchLocationUpdater.shouldAttemptLocationCapture(
                shareLocationEnabled = true,
                permissionGranted = false
            )
        )
    }

    @Test
    fun mapCaptureAttemptToSyncAction_returnsUpdateWhenLocationExists() {
        val action = AppLaunchLocationUpdater.mapCaptureAttemptToSyncAction(
            CurrentLocationShareAttempt(
                location = CurrentDeviceLocation(
                    latitude = 41.1,
                    longitude = 29.0,
                    accuracyMeters = 8.0,
                    capturedAt = "2026-04-21T08:00:00.000Z"
                )
            )
        )

        assertEquals(LaunchLocationSyncAction.UPDATE_WITH_LOCATION, action)
    }

    @Test
    fun mapCaptureAttemptToSyncAction_skipsOnLocationUnavailable() {
        val action = AppLaunchLocationUpdater.mapCaptureAttemptToSyncAction(
            CurrentLocationShareAttempt(warning = CurrentLocationShareWarning.LOCATION_UNAVAILABLE)
        )

        assertEquals(LaunchLocationSyncAction.SKIP, action)
    }

    @Test
    fun mapCaptureAttemptToSyncAction_skipsOnPermissionDeniedOrEmptyAttempt() {
        val deniedAction = AppLaunchLocationUpdater.mapCaptureAttemptToSyncAction(
            CurrentLocationShareAttempt(warning = CurrentLocationShareWarning.PERMISSION_DENIED)
        )
        val emptyAction = AppLaunchLocationUpdater.mapCaptureAttemptToSyncAction(CurrentLocationShareAttempt())

        assertEquals(LaunchLocationSyncAction.SKIP, deniedAction)
        assertEquals(LaunchLocationSyncAction.SKIP, emptyAction)
    }
}
