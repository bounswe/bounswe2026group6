package com.neph

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import androidx.navigation.compose.rememberNavController
import com.neph.core.NephAppContext
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.features.availability.data.AvailabilityRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.navigation.AppNavGraph
import com.neph.navigation.Routes
import com.neph.ui.theme.NephTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NephAppContext.initialize(applicationContext)
        NephDatabaseProvider.initialize(applicationContext)
        AuthSessionStore.initialize(applicationContext)
        AvailabilityRepository.initialize(applicationContext)
        ProfileRepository.initialize(applicationContext)
        RequestHelpRepository.initialize(applicationContext)
        OfflineSyncScheduler.schedulePeriodicSync(applicationContext)
        OfflineSyncScheduler.enqueueSync(applicationContext, reason = "app-start")
        setContent {
            NephApp()
        }
    }
}

@Composable
fun NephApp() {
    NephTheme {
        val navController = rememberNavController()
        AppNavGraph(
            navController = navController,
            startDestination = if (AuthSessionStore.getAccessToken().isNullOrBlank()) {
                Routes.Welcome.route
            } else {
                Routes.Home.route
            }
        )
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
fun NephAppPreview() {
    NephApp()
}
