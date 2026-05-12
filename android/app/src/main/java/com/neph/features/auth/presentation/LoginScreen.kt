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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.credentials.CustomCredential
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
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
import com.neph.ui.components.display.AuthHeaderAppLogo
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
    val context = LocalContext.current

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

    fun handleGoogleLogin() {
        error = ""
        info = ""

        val serverClientId = com.neph.BuildConfig.GOOGLE_SERVER_CLIENT_ID.trim()
        if (serverClientId.isBlank()) {
            error = "Google sign-in is not configured for this build. Set GOOGLE_SERVER_CLIENT_ID in android/keystore.properties."
            return
        }

        loading = true
        scope.launch {
            try {
                val credentialManager = CredentialManager.create(context)

                // Primary flow for explicit login button: Sign In with Google option.
                // If unavailable on device, fallback to the generic Google ID option.
                val signInWithGoogleOption = GetSignInWithGoogleOption.Builder(serverClientId)
                    .build()
                val signInRequest = GetCredentialRequest.Builder()
                    .addCredentialOption(signInWithGoogleOption)
                    .build()

                val result = try {
                    credentialManager.getCredential(context, signInRequest)
                } catch (noCredential: NoCredentialException) {
                    val googleIdOption = GetGoogleIdOption.Builder()
                        .setFilterByAuthorizedAccounts(false)
                        .setAutoSelectEnabled(false)
                        .setServerClientId(serverClientId)
                        .build()
                    val fallbackRequest = GetCredentialRequest.Builder()
                        .addCredentialOption(googleIdOption)
                        .build()
                    credentialManager.getCredential(context, fallbackRequest)
                }

                val credential = result.credential
                if (
                    credential !is CustomCredential ||
                    (
                        credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL &&
                            credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_SIWG_CREDENTIAL
                        )
                ) {
                    error = "Could not read Google sign-in response. Please try again."
                    return@launch
                }

                val googleCredential = try {
                    GoogleIdTokenCredential.createFrom(credential.data)
                } catch (_: GoogleIdTokenParsingException) {
                    error = "Could not parse Google sign-in response. Please try again."
                    return@launch
                }

                if (googleCredential.idToken.isBlank()) {
                    error = "Google sign-in response did not include a valid token."
                    return@launch
                }

                when (AuthRepository.loginWithGoogle(googleCredential.idToken, mode = "login")) {
                    LoginDestination.PROFILE -> onLoginSuccess()
                    LoginDestination.COMPLETE_PROFILE -> onProfileCompletionRequired()
                }
            } catch (cancellationException: kotlinx.coroutines.CancellationException) {
                throw cancellationException
            } catch (credentialException: GetCredentialException) {
                error = when (credentialException) {
                    is GetCredentialCancellationException -> "Google sign-in was cancelled."
                    is NoCredentialException -> "No usable Google credential found. Ensure the account is added under device Accounts and Google Play Services is available."
                    else -> credentialException.message?.ifBlank {
                        "Could not open Google sign-in. Please try again."
                    } ?: "Could not open Google sign-in. Please try again."
                }
            } catch (errorResponse: ApiException) {
                error = errorResponse.message.ifBlank { "Google sign-in failed. Please try again." }
            } catch (_: Exception) {
                error = "Google sign-in failed. Please try again."
            } finally {
                loading = false
            }
        }
    }

    AuthScaffold(
        title = "Welcome back",
        subtitle = "Log in to manage your emergency information and stay ready.",
        logoContent = {
            AuthHeaderAppLogo(size = 64.dp)
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
            onGoogleClick = ::handleGoogleLogin,
            enabled = !loading
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
                    testTag = "login_email",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )

                PasswordField(
                    value = password,
                    onValueChange = { password = it },
                    label = "Password",
                    placeholder = "Enter your password",
                    testTag = "login_password"
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
                            modifier = Modifier.testTag("login_remember_me"),
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

        if (!showEmailForm && error.isNotBlank()) {
            Text(
                text = error,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}
