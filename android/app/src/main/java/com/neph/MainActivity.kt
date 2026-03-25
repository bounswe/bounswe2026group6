package com.neph

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import androidx.navigation.compose.rememberNavController
import com.neph.navigation.AppNavGraph
import com.neph.navigation.Routes
import com.neph.ui.theme.NephTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
            startDestination = Routes.Welcome.route
        )
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
fun NephAppPreview() {
    NephApp()
}