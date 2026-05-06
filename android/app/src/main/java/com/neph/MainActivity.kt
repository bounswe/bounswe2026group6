package com.neph

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.tooling.preview.Preview
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import com.neph.core.NephAppContext
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.core.theme.ThemePreferenceStore
import com.neph.features.availability.data.AvailabilityRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.operationallocation.data.OperationalLocationRepository
import com.neph.features.operationallocation.data.OperationalLocationUpdater
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.notifications.data.PushTokenSync
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.features.safetystatus.data.SafetyStatusRepository
import com.neph.navigation.AppNavGraph
import com.neph.navigation.Routes
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NephAppContext.initialize(applicationContext)
        NephDatabaseProvider.initialize(applicationContext)
        AuthSessionStore.initialize(applicationContext)
        ThemePreferenceStore.initialize(applicationContext)
        AvailabilityRepository.initialize(applicationContext)
        OperationalLocationRepository.initialize(applicationContext)
        ProfileRepository.initialize(applicationContext)
        RequestHelpRepository.initialize(applicationContext)
        SafetyStatusRepository.initialize(applicationContext)
        requestNotificationPermissionIfNeeded()
        PushTokenSync.syncCurrentToken()
        OfflineSyncScheduler.schedulePeriodicSync(applicationContext)
        OfflineSyncScheduler.enqueueSync(applicationContext, reason = "app-start")
        setContent {
            NephApp()
        }
        refreshOperationalLocationSilently()
    }

    override fun onResume() {
        super.onResume()
        refreshOperationalLocationSilently()
    }

    private fun refreshOperationalLocationSilently() {
        lifecycleScope.launch {
            OperationalLocationUpdater.refreshIfAllowed(applicationContext)
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return
        }

        if (
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            REQUEST_POST_NOTIFICATIONS
        )
    }

    companion object {
        private const val REQUEST_POST_NOTIFICATIONS = 1001
    }
}

@Composable
fun NephApp() {
    val themeMode by ThemePreferenceStore.themeModeFlow.collectAsState()
    val darkThemeEnabled = ThemePreferenceStore.resolveDarkTheme(
        themeMode = themeMode,
        systemDarkTheme = isSystemInDarkTheme()
    )

    NephTheme(darkTheme = darkThemeEnabled) {
        val navController = rememberNavController()
        AppNavGraph(
            navController = navController,
            startDestination = when {
                !AuthSessionStore.getAccessToken().isNullOrBlank() -> Routes.Home.route
                AuthSessionStore.isGuestMode() && RequestHelpRepository.shouldOpenGuestRequestsOnStart() -> {
                    Routes.MyHelpRequests.route
                }
                AuthSessionStore.isGuestMode() -> Routes.Home.route
                else -> Routes.Welcome.route
            },
            darkThemeEnabled = darkThemeEnabled,
            onDarkThemeChange = ThemePreferenceStore::setDarkThemeEnabled
        )
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
fun NephAppPreview() {
    NephApp()
}
