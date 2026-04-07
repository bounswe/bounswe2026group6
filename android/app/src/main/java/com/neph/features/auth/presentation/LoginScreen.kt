package com.neph.features.auth.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import com.neph.core.network.ApiException
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.auth.data.LoginDestination
import com.neph.features.auth.presentation.components.AuthFooterLinks
import com.neph.features.auth.presentation.components.AuthFooterMode
import com.neph.features.auth.presentation.components.SocialAuthButtons
import com.neph.features.auth.presentation.components.SocialAuthMode
import com.neph.features.auth.util.isValidEmail
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.Divider
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.inputs.AppTextField
import com.neph.ui.components.inputs.PasswordField
import com.neph.ui.layout.AuthScaffold
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    onNavigateToSignup: () -> Unit,
    onLoginSuccess: () -> Unit,
    onProfileCompletionRequired: () -> Unit,
    onEmailVerificationRequired: () -> Unit,
    onNavigateToForgotPassword: () -> Unit,
    onContinueAsGuest: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()

    var showEmailForm by rememberSaveable { mutableStateOf(false) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var rememberMe by rememberSaveable { mutableStateOf(false) }
    var loading by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf("") }
    var info by rememberSaveable { mutableStateOf("") }

    fun handleLogin() {
        error = ""
        info = ""

        val normalizedEmail = email.trim()
        val normalizedPassword = password.trim()

        if (normalizedEmail.isEmpty() || normalizedPassword.isEmpty()) {
            error = "Please fill in both email and password."
            return
        }

        if (!isValidEmail(normalizedEmail)) {
            error = "Please enter a valid email address."
            return
        }

        loading = true
        scope.launch {
            try {
                when (
                    AuthRepository.login(
                        email = normalizedEmail,
                        password = password,
                        rememberMe = rememberMe
                    )
                ) {
                    LoginDestination.PROFILE -> onLoginSuccess()
                    LoginDestination.COMPLETE_PROFILE -> onProfileCompletionRequired()
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (errorResponse: ApiException) {
                if (errorResponse.code == "EMAIL_NOT_VERIFIED") {
                    AuthSessionStore.setPendingVerificationEmail(normalizedEmail)
                    onEmailVerificationRequired()
                } else {
                    error = errorResponse.message.ifBlank { "Could not complete login. Please try again." }
                }
            } catch (_: IllegalStateException) {
                error = "Could not complete login. Please try again."
            } catch (_: Exception) {
                error = "Something went wrong while logging in. Please try again."
            } finally {
                loading = false
            }
        }
    }

    fun handleSocialAuth(provider: String) {
        error = ""
        info =
            "$provider sign-in UI is ready. Real OAuth login will be connected after provider credentials and backend callback setup are completed."
    }

    AuthScaffold(
        title = "Log In",
        subtitle = "Access your NEPH account to manage your emergency information.",
        logoContent = {
            Text(
                text = "NEPH",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.primary
            )
        },
        footerContent = {
            AuthFooterLinks(
                mode = AuthFooterMode.LOGIN,
                onSecondaryClick = onNavigateToSignup
            )
        }
    ) {
        SocialAuthButtons(
            mode = SocialAuthMode.LOGIN,
            onProviderClick = ::handleSocialAuth
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(spacing.sm),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Divider(modifier = Modifier.weight(1f))
            Text(
                text = "OR",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Divider(modifier = Modifier.weight(1f))
        }

        if (!showEmailForm) {
            SecondaryButton(
                text = "Continue with Email",
                onClick = {
                    info = ""
                    error = ""
                    showEmailForm = true
                }
            )

            TextActionButton(
                text = "Continue as Guest",
                onClick = onContinueAsGuest
            )
        } else {
            Column(
                verticalArrangement = Arrangement.spacedBy(spacing.md)
            ) {
                AppTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = "Email",
                    placeholder = "Enter your email",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )

                PasswordField(
                    value = password,
                    onValueChange = { password = it },
                    label = "Password",
                    placeholder = "Enter your password"
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(spacing.xs),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = rememberMe,
                            onCheckedChange = { rememberMe = it },
                            colors = CheckboxDefaults.colors(
                                checkedColor = MaterialTheme.colorScheme.primary,
                                uncheckedColor = MaterialTheme.colorScheme.outline,
                                checkmarkColor = MaterialTheme.colorScheme.onPrimary
                            )
                        )

                        Text(
                            text = "Remember me",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }

                    TextActionButton(
                        text = "Forgot password?",
                        onClick = onNavigateToForgotPassword
                    )
                }

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
                    text = "Log In",
                    onClick = ::handleLogin,
                    loading = loading
                )
            }
        }

        if (!showEmailForm && info.isNotBlank()) {
            HelperText(text = info)
        }
    }
}