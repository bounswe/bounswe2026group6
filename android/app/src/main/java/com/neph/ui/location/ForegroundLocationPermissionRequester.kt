package com.neph.ui.location

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.neph.features.profile.data.DeviceLocationProvider

data class ForegroundLocationPermissionResult(
    val granted: Boolean
)

@Stable
class ForegroundLocationPermissionRequester internal constructor(
    val isGranted: Boolean,
    private val onRequest: () -> Unit,
    private val onRefresh: () -> Boolean
) {
    fun requestPermission() {
        onRequest()
    }

    fun refreshPermissionState(): Boolean {
        return onRefresh()
    }
}

@Composable
fun rememberForegroundLocationPermissionRequester(
    onPermissionResult: (ForegroundLocationPermissionResult) -> Unit
): ForegroundLocationPermissionRequester {
    val context = LocalContext.current
    val latestOnPermissionResult by rememberUpdatedState(onPermissionResult)
    var isGranted by remember {
        mutableStateOf(DeviceLocationProvider.hasLocationPermission(context))
    }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = DeviceLocationProvider.hasLocationPermission(context) || grants.values.any { it }
        isGranted = granted
        latestOnPermissionResult(ForegroundLocationPermissionResult(granted = granted))
    }

    return ForegroundLocationPermissionRequester(
        isGranted = isGranted,
        onRequest = {
            val alreadyGranted = DeviceLocationProvider.hasLocationPermission(context)
            isGranted = alreadyGranted
            if (alreadyGranted) {
                latestOnPermissionResult(ForegroundLocationPermissionResult(granted = true))
            } else {
                launcher.launch(DeviceLocationProvider.RequiredLocationPermissions)
            }
        },
        onRefresh = {
            val granted = DeviceLocationProvider.hasLocationPermission(context)
            isGranted = granted
            granted
        }
    )
}
