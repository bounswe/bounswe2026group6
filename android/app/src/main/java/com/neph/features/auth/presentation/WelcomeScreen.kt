package com.neph.features.auth.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.AuthCard
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
        title = "Welcome",
        subtitle = "Prepare, connect, and stay ready with your neighborhood emergency hub."
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

            Text(
                text = "Guest mode is currently a placeholder in this MVP.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}