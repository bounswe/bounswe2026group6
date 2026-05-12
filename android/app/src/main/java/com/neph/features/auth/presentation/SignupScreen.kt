package com.neph.features.auth.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.runtime.remember
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
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
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.neph.core.network.ApiException
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.LoginDestination
import com.neph.features.auth.presentation.components.AuthFooterLinks
import com.neph.features.auth.presentation.components.AuthFooterMode
import com.neph.features.auth.presentation.components.SocialAuthButtons
import com.neph.features.auth.presentation.components.SocialAuthMode
import com.neph.features.auth.util.isValidEmail
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.AuthHeaderAppLogo
import com.neph.ui.components.display.Divider
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.inputs.AppTextField
import com.neph.ui.components.inputs.PasswordField
import com.neph.ui.layout.AuthScaffold
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.launch

@Composable
fun SignupScreen(
    onNavigateToLogin: () -> Unit,
    onSignupSuccess: () -> Unit,
    onGoogleSignupSuccess: () -> Unit,
    onGoogleProfileCompletionRequired: () -> Unit,
    onNavigateToTerms: () -> Unit,
    onNavigateToPrivacy: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var showEmailForm by rememberSaveable { mutableStateOf(false) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var acceptedTerms by rememberSaveable { mutableStateOf(false) }
    var loading by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf("") }
    var info by rememberSaveable { mutableStateOf("") }

    fun handleSignup() {
        error = ""
        info = ""

        if (
            email.trim().isEmpty() ||
            password.trim().isEmpty() ||
            confirmPassword.trim().isEmpty()
        ) {
            error = "Please fill in all required fields."
            return
        }

        if (!isValidEmail(email)) {
            error = "Please enter a valid email address."
            return
        }

        if (password != confirmPassword) {
            error = "Passwords do not match."
            return
        }

        if (!acceptedTerms) {
            error = "You must accept the terms to continue."
            return
        }

        loading = true
        scope.launch {
            try {
                info = AuthRepository.signup(
                    email = email,
                    password = password,
                    acceptedTerms = acceptedTerms
                )
                onSignupSuccess()
            } catch (errorResponse: ApiException) {
                error = errorResponse.message
            } catch (_: IllegalStateException) {
                error = "Signup failed. Please try again."
            } finally {
                loading = false
            }
        }
    }

    fun handleGoogleSignup() {
        error = ""
        info = ""

        val serverClientId = com.neph.BuildConfig.GOOGLE_SERVER_CLIENT_ID.trim()
        if (serverClientId.isBlank()) {
            error = "Google sign-up is not configured for this build. Set GOOGLE_SERVER_CLIENT_ID in android/keystore.properties."
            return
        }

        loading = true
        scope.launch {
            try {
                val googleIdOption = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setAutoSelectEnabled(false)
                    .setServerClientId(serverClientId)
                    .build()
                val request = GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build()
                val credentialManager = CredentialManager.create(context)
                val result = credentialManager.getCredential(context, request)

                val credential = result.credential
                if (
                    credential !is CustomCredential ||
                    credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                ) {
                    error = "Could not read Google sign-up response. Please try again."
                    return@launch
                }

                val googleCredential = try {
                    GoogleIdTokenCredential.createFrom(credential.data)
                } catch (_: GoogleIdTokenParsingException) {
                    error = "Could not parse Google sign-up response. Please try again."
                    return@launch
                }

                if (googleCredential.idToken.isBlank()) {
                    error = "Google sign-up response did not include a valid token."
                    return@launch
                }

                when (
                    AuthRepository.loginWithGoogle(
                        googleCredential.idToken,
                        mode = "signup"
                    )
                ) {
                    LoginDestination.PROFILE -> onGoogleSignupSuccess()
                    LoginDestination.COMPLETE_PROFILE -> onGoogleProfileCompletionRequired()
                }
            } catch (cancellationException: kotlinx.coroutines.CancellationException) {
                throw cancellationException
            } catch (credentialException: GetCredentialException) {
                error = when (credentialException) {
                    is GetCredentialCancellationException -> "Google sign-up was cancelled."
                    is NoCredentialException -> "No Google account found on this device. Please add one and try again."
                    else -> credentialException.message?.ifBlank {
                        "Could not open Google sign-up. Please try again."
                    } ?: "Could not open Google sign-up. Please try again."
                }
            } catch (errorResponse: ApiException) {
                error = errorResponse.message.ifBlank { "Google sign-up failed. Please try again." }
            } catch (_: Exception) {
                error = "Google sign-up failed. Please try again."
            } finally {
                loading = false
            }
        }
    }

    @Composable
    fun TermsConsentRow() {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .border(
                    width = 1.dp,
                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.45f),
                    shape = RoundedCornerShape(12.dp)
                )
                .padding(horizontal = spacing.sm, vertical = spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(spacing.sm),
            verticalAlignment = Alignment.Top
        ) {
            androidx.compose.material3.Checkbox(
                checked = acceptedTerms,
                onCheckedChange = { acceptedTerms = it },
                modifier = Modifier.testTag("signup_terms_checkbox"),
                colors = androidx.compose.material3.CheckboxDefaults.colors(
                    checkedColor = MaterialTheme.colorScheme.primary,
                    uncheckedColor = MaterialTheme.colorScheme.outline,
                    checkmarkColor = MaterialTheme.colorScheme.onPrimary
                )
            )

            Column(
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    text = "I agree to the",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(spacing.xs)
                ) {
                    Text(
                        text = "Terms of Service",
                        modifier = Modifier.clickable(onClick = onNavigateToTerms),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary
                    )

                    Text(
                        text = "and",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    Text(
                        text = "Privacy Policy",
                        modifier = Modifier.clickable(onClick = onNavigateToPrivacy),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }

    AuthScaffold(
        title = "Create Account",
        subtitle = "Set up your account and get ready before emergencies happen.",
        logoContent = {
            AuthHeaderAppLogo(size = 64.dp)
        },
        footerContent = {
            AuthFooterLinks(
                mode = AuthFooterMode.SIGNUP,
                onSecondaryClick = onNavigateToLogin
            )
        }
    ) {
        SocialAuthButtons(
            mode = SocialAuthMode.SIGNUP,
            onGoogleClick = ::handleGoogleSignup,
            enabled = !loading
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(spacing.sm)
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

            if (error.isNotBlank()) {
                Text(
                    text = error,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        } else {
            Column(
                verticalArrangement = Arrangement.spacedBy(spacing.md)
            ) {
                AppTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = "Email",
                    placeholder = "Enter your email",
                    testTag = "signup_email",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )

                PasswordField(
                    value = password,
                    onValueChange = { password = it },
                    label = "Password",
                    placeholder = "Create a password",
                    testTag = "signup_password"
                )

                PasswordField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    label = "Confirm Password",
                    placeholder = "Re-enter your password",
                    testTag = "signup_confirm_password"
                )

                TermsConsentRow()

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
                    text = "Create Account",
                    onClick = ::handleSignup,
                    loading = loading
                )
            }
        }

        if (!showEmailForm && info.isNotBlank()) {
            HelperText(text = info)
        }
    }
}
