package com.neph.features.auth.presentation.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.theme.LocalNephSpacing

enum class SocialAuthMode {
    LOGIN,
    SIGNUP
}

@Composable
fun SocialAuthButtons(
    mode: SocialAuthMode,
    onProviderClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalNephSpacing.current

    val googleText = if (mode == SocialAuthMode.LOGIN) {
        "Continue with Google"
    } else {
        "Sign up with Google"
    }

    val facebookText = if (mode == SocialAuthMode.LOGIN) {
        "Continue with Facebook"
    } else {
        "Sign up with Facebook"
    }

    val appleText = if (mode == SocialAuthMode.LOGIN) {
        "Continue with Apple"
    } else {
        "Sign up with Apple"
    }

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(spacing.sm)
    ) {
        SecondaryButton(
            text = googleText,
            onClick = { onProviderClick("Google") }
        )
        SecondaryButton(
            text = facebookText,
            onClick = { onProviderClick("Facebook") }
        )
        SecondaryButton(
            text = appleText,
            onClick = { onProviderClick("Apple") }
        )
    }
}