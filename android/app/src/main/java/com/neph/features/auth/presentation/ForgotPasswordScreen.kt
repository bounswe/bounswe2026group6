package com.neph.features.auth.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import com.neph.core.network.ApiException
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.util.isValidEmail
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.inputs.AppTextField
import com.neph.ui.layout.AuthScaffold
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun ForgotPasswordScreen(
    onNavigateToResetPassword: () -> Unit,
    onNavigateBack: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()

    var email by rememberSaveable { mutableStateOf("") }
    var loading by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf("") }
    var info by rememberSaveable { mutableStateOf("") }

    fun handleSubmit() {
        error = ""
        info = ""

        if (email.trim().isEmpty()) {
            error = "Please enter your email address."
            return
        }

        if (!isValidEmail(email)) {
            error = "Please enter a valid email address."
            return
        }

        loading = true
        scope.launch {
            try {
                info = AuthRepository.forgotPassword(email.trim())
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (errorResponse: ApiException) {
                error = errorResponse.message.ifBlank {
                    "Could not start the password reset flow. Please try again."
                }
            } catch (_: Exception) {
                error = "Could not start the password reset flow. Please try again."
            } finally {
                loading = false
            }
        }
    }

    AuthScaffold(
        title = "Forgot Password",
        subtitle = "Enter your email address and we will send you a reset link.",
        logoContent = {
            Text(
                text = "NEPH",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.primary
            )
        }
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            AppTextField(
                value = email,
                onValueChange = { email = it },
                label = "Email",
                placeholder = "Enter your email",
                testTag = "forgot_password_email",
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email
                )
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
                text = "Send Reset Link",
                onClick = ::handleSubmit,
                loading = loading
            )

            TextActionButton(
                text = "I have a reset link",
                onClick = onNavigateToResetPassword
            )

            TextActionButton(
                text = "Back to Log In",
                onClick = onNavigateBack
            )
        }
    }
}
