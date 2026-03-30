package com.neph

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import androidx.navigation.compose.rememberNavController
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.profile.data.ProfileRepository
import com.neph.navigation.AppNavGraph
import com.neph.navigation.Routes
import com.neph.ui.theme.NephTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AuthSessionStore.initialize(applicationContext)
        ProfileRepository.initialize(applicationContext)
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
                Routes.Profile.route
            }
        )
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
fun NephAppPreview() {
    NephApp()
}