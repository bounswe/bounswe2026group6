package com.neph.features.auth.presentation.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

enum class AuthFooterMode {
    LOGIN,
    SIGNUP
}

@Composable
fun AuthFooterLinks(
    mode: AuthFooterMode,
    onSecondaryClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val leadingText = if (mode == AuthFooterMode.LOGIN) {
        "Don't have an account?"
    } else {
        "Already have an account?"
    }

    val actionText = if (mode == AuthFooterMode.LOGIN) {
        "Create one"
    } else {
        "Log in"
    }

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = leadingText,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Text(
            text = " $actionText",
            modifier = Modifier.clickable(onClick = onSecondaryClick),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.primary
        )
    }
}