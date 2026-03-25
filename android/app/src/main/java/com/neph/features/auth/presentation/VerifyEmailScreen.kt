package com.neph.features.auth.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.inputs.VerificationCodeField
import com.neph.ui.layout.AuthScaffold
import com.neph.ui.theme.LocalNephSpacing
import androidx.compose.ui.Alignment
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.ui.Modifier

@Composable
fun VerifyEmailScreen(
    onVerificationSuccess: () -> Unit,
    onNavigateBack: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()

    var code by rememberSaveable { mutableStateOf("") }
    var loading by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf("") }
    var info by rememberSaveable { mutableStateOf("") }

    fun handleVerify() {
        error = ""
        info = ""

        if (code.length != 6) {
            error = "Please enter the 6-digit verification code."
            return
        }

        loading = true
        scope.launch {
            delay(600)
            loading = false
            onVerificationSuccess()
        }
    }

    AuthScaffold(
        title = "Verify Email",
        subtitle = "Enter the verification code sent to your email.",
        logoContent = {
            Text(
                text = "NEPH",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.primary
            )
        }
    ) {
        Text(
            text = "We sent a 6-digit code to your email address. Please enter it below to continue.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        VerificationCodeField(
            value = code,
            onValueChange = { input ->
                code = input.filter { it.isDigit() }.take(6)
            },
            length = 6
        )

        if (error.isNotBlank()) {
            Text(
                text = error,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.error
            )
        }

        if (info.isNotBlank()) {
            HelperText(text = info)
        }

        PrimaryButton(
            text = "Verify Email",
            onClick = ::handleVerify,
            loading = loading
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextActionButton(
                text = "Resend code",
                onClick = {
                    error = ""
                    info = "A new verification code has been sent."
                }
            )

            TextActionButton(
                text = "Back",
                onClick = onNavigateBack
            )
        }
    }
}