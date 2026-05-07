package com.neph.features.auth.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import com.neph.core.network.ApiException
import com.neph.features.auth.data.AuthRepository
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.inputs.AppTextField
import com.neph.ui.components.inputs.PasswordField
import com.neph.ui.layout.AuthScaffold
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun ResetPasswordScreen(
    onResetSuccess: () -> Unit,
    onNavigateBack: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()

    var tokenOrLink by rememberSaveable { mutableStateOf("") }
    var newPassword by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }
    var loading by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf("") }
    var info by rememberSaveable { mutableStateOf("") }

    fun handleResetPassword() {
        if (loading) return

        error = ""
        info = ""

        if (tokenOrLink.trim().isEmpty()) {
            error = "Paste the reset link or token from your email."
            return
        }

        if (newPassword.isBlank() || confirmPassword.isBlank()) {
            error = "Please fill in both password fields."
            return
        }

        if (newPassword.length < 8) {
            error = "New password must be at least 8 characters."
            return
        }

        if (newPassword != confirmPassword) {
            error = "Passwords do not match."
            return
        }

        loading = true
        scope.launch {
            try {
                info = AuthRepository.resetPassword(tokenOrLink, newPassword)
                onResetSuccess()
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (errorResponse: ApiException) {
                error = errorResponse.message.ifBlank { "Password reset failed. Please try again." }
            } catch (_: Exception) {
                error = "Something went wrong while resetting your password. Please try again."
            } finally {
                loading = false
            }
        }
    }

    AuthScaffold(
        title = "Reset Password",
        subtitle = "Paste the reset link from your email and choose a new password.",
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
            Text(
                text = "Open the reset email you received, then paste the full link or the token value here to finish resetting your password in the app.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            AppTextField(
                value = tokenOrLink,
                onValueChange = { tokenOrLink = it },
                label = "Reset Link or Token",
                placeholder = "Paste the link or token from your email",
                testTag = "reset_password_token",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri)
            )

            PasswordField(
                value = newPassword,
                onValueChange = { newPassword = it },
                label = "New Password",
                placeholder = "Enter your new password",
                testTag = "reset_password_new"
            )

            PasswordField(
                value = confirmPassword,
                onValueChange = { confirmPassword = it },
                label = "Confirm Password",
                placeholder = "Confirm your new password",
                testTag = "reset_password_confirm"
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
                text = "Reset Password",
                onClick = ::handleResetPassword,
                loading = loading
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextActionButton(
                    text = "Back",
                    onClick = onNavigateBack
                )

                TextActionButton(
                    text = "Go to Log In",
                    onClick = onResetSuccess
                )
            }
        }
    }
}
