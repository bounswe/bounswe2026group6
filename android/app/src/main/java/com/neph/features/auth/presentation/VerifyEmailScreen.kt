package com.neph.features.auth.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import com.neph.core.network.ApiException
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.inputs.AppTextField
import com.neph.ui.layout.AuthScaffold
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun VerifyEmailScreen(
    initialToken: String? = null,
    onVerificationSuccess: () -> Unit,
    onContinueToLogin: () -> Unit,
    onNavigateBack: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()

    val pendingEmail = remember { AuthSessionStore.getPendingVerificationEmail() }

    var tokenOrLink by rememberSaveable { mutableStateOf("") }
    var loading by rememberSaveable { mutableStateOf(false) }
    var resending by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf("") }
    var info by rememberSaveable { mutableStateOf("") }

    fun handleVerify(input: String = tokenOrLink) {
        if (loading || resending) return

        error = ""
        info = ""

        if (input.trim().isEmpty()) {
            error = "Paste the verification link or token from your email, or open the link in your browser and continue to log in."
            return
        }

        loading = true
        scope.launch {
            try {
                info = AuthRepository.verifyEmail(input)
                onVerificationSuccess()
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (errorResponse: ApiException) {
                error = errorResponse.message.ifBlank { "Verification failed. Please try again." }
            } catch (_: Exception) {
                error = "Something went wrong while verifying your email. Please try again."
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(initialToken) {
        val token = initialToken?.trim().orEmpty()
        if (token.isBlank() || loading || resending) {
            return@LaunchedEffect
        }

        tokenOrLink = token
        handleVerify(token)
    }

    fun handleResend() {
        if (resending || loading) return

        error = ""
        info = ""

        resending = true
        scope.launch {
            try {
                info = AuthRepository.resendVerification()
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (errorResponse: ApiException) {
                error = errorResponse.message.ifBlank { "Could not resend the verification email. Please try again." }
            } catch (_: Exception) {
                error = "Something went wrong while resending the verification email. Please try again."
            } finally {
                resending = false
            }
        }
    }

    AuthScaffold(
        title = "Verify Email",
        subtitle = "Use the verification link sent to your email. You can paste the full link or token below.",
        logoContent = {
            Text(
                text = "NEPH",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.primary
            )
        }
    ) {
        Text(
            text = pendingEmail?.let {
                "We sent a verification link to $it. Open that link, or paste the full link or token below to verify here."
            } ?: "Open the verification email you received, or paste the full link or token below.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        AppTextField(
            value = tokenOrLink,
            onValueChange = { tokenOrLink = it },
            label = "Verification Link or Token",
            placeholder = "Paste the link or token from your email",
            testTag = "verify_email_token",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri)
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

        PrimaryButton(
            text = "Continue to Log In",
            onClick = onContinueToLogin
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextActionButton(
                text = if (resending) "Sending..." else "Resend email",
                onClick = ::handleResend
            )

            TextActionButton(
                text = "Back",
                onClick = onNavigateBack
            )
        }
    }
}
