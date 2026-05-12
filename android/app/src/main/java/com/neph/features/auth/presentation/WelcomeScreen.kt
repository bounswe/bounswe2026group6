package com.neph.features.auth.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.AuthHeaderAppLogo
import com.neph.ui.layout.AuthScaffold
import com.neph.ui.theme.LocalNephSpacing

@Composable
fun WelcomeScreen(
    onNavigateToLogin: () -> Unit,
    onNavigateToSignup: () -> Unit,
    onContinueAsGuest: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    AuthScaffold(
        title = "Welcome to NEPH",
        subtitle = "Prepare, connect, and stay ready with your neighborhood emergency hub.",
        logoContent = {
            AuthHeaderAppLogo(size = 72.dp)
        }
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            PrimaryButton(
                text = "Log In",
                onClick = onNavigateToLogin
            )

            SecondaryButton(
                text = "Create Account",
                onClick = onNavigateToSignup
            )

            TextActionButton(
                text = "Continue as Guest",
                onClick = onContinueAsGuest
            )
        }
    }
}