package com.neph.features.profile.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.suspendCancellableCoroutine
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class CurrentDeviceLocation(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Double? = null,
    val capturedAt: String,
    val source: String = DeviceLocationProvider.DeviceLocationSource
)

enum class CurrentLocationShareWarning {
    PERMISSION_DENIED,
    LOCATION_UNAVAILABLE
}

data class CurrentLocationShareAttempt(
    val location: CurrentDeviceLocation? = null,
    val warning: CurrentLocationShareWarning? = null
)

object DeviceLocationProvider {
    const val DeviceLocationSource = "DEVICE_GPS"

    val RequiredLocationPermissions = arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION
    )

    fun hasLocationPermission(context: Context): Boolean {
        val appContext = context.applicationContext
        return isPermissionGranted(appContext, Manifest.permission.ACCESS_FINE_LOCATION) ||
            isPermissionGranted(appContext, Manifest.permission.ACCESS_COARSE_LOCATION)
    }

    suspend fun captureCurrentLocationForSharing(
        context: Context,
        sharingEnabled: Boolean
    ): CurrentLocationShareAttempt {
        if (!sharingEnabled) {
            return CurrentLocationShareAttempt()
        }

        if (!hasLocationPermission(context)) {
            return CurrentLocationShareAttempt(warning = CurrentLocationShareWarning.PERMISSION_DENIED)
        }

        return try {
            val location = getCurrentLocation(context)
            if (location == null) {
                CurrentLocationShareAttempt(warning = CurrentLocationShareWarning.LOCATION_UNAVAILABLE)
            } else {
                CurrentLocationShareAttempt(location = location)
            }
        } catch (_: SecurityException) {
            CurrentLocationShareAttempt(warning = CurrentLocationShareWarning.PERMISSION_DENIED)
        } catch (_: Exception) {
            CurrentLocationShareAttempt(warning = CurrentLocationShareWarning.LOCATION_UNAVAILABLE)
        }
    }

    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(context: Context): CurrentDeviceLocation? {
        if (!hasLocationPermission(context)) {
            return null
        }

        val appContext = context.applicationContext
        val fusedClient = LocationServices.getFusedLocationProviderClient(appContext)

        return suspendCancellableCoroutine { continuation ->
            val cancellationTokenSource = CancellationTokenSource()

            fun resumeWithLocation(location: Location?) {
                if (!continuation.isActive) {
                    return
                }

                continuation.resume(location?.toCurrentDeviceLocation())
            }

            fusedClient
                .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellationTokenSource.token)
                .addOnSuccessListener { current ->
                    if (current != null) {
                        resumeWithLocation(current)
                    } else {
                        fusedClient.lastLocation
                            .addOnSuccessListener { lastKnown ->
                                resumeWithLocation(lastKnown)
                            }
                            .addOnFailureListener { error ->
                                if (continuation.isActive) {
                                    continuation.resumeWithException(error)
                                }
                            }
                    }
                }
                .addOnFailureListener { error ->
                    if (continuation.isActive) {
                        continuation.resumeWithException(error)
                    }
                }

            continuation.invokeOnCancellation {
                cancellationTokenSource.cancel()
            }
        }
    }

    private fun isPermissionGranted(context: Context, permission: String): Boolean {
        return ActivityCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }

    private fun Location.toCurrentDeviceLocation(): CurrentDeviceLocation {
        val capturedAtMillis = if (time > 0L) time else System.currentTimeMillis()
        return CurrentDeviceLocation(
            latitude = latitude,
            longitude = longitude,
            accuracyMeters = if (hasAccuracy()) accuracy.toDouble() else null,
            capturedAt = toIsoUtc(capturedAtMillis)
        )
    }

    private fun toIsoUtc(timestampMillis: Long): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        formatter.timeZone = TimeZone.getTimeZone("UTC")
        return formatter.format(Date(timestampMillis))
    }
}
