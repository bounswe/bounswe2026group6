package com.neph.features.settings.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.neph.features.auth.data.AuthRepository
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    onNavigateToRoute: (String) -> Unit,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    onNavigateToPrivacySecurity: () -> Unit,
    onLogout: () -> Unit,
    onAccountDeleted: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val coroutineScope = rememberCoroutineScope()
    var showDeleteDialog by remember { mutableStateOf(false) }
    var deletingAccount by remember { mutableStateOf(false) }
    var deleteError by remember { mutableStateOf<String?>(null) }

    fun deleteAccount() {
        deletingAccount = true
        deleteError = null

        coroutineScope.launch {
            try {
                AuthRepository.deleteAccount()
                showDeleteDialog = false
                onAccountDeleted()
            } catch (error: Exception) {
                deleteError = error.message ?: "Could not delete your account. Please try again."
                showDeleteDialog = false
            } finally {
                deletingAccount = false
            }
        }
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = {
                if (!deletingAccount) {
                    showDeleteDialog = false
                }
            },
            title = {
                Text(text = "Delete account?")
            },
            text = {
                Text(
                    text = "This removes your personal profile data, cancels active help requests and assignments, turns off volunteer availability, and disables login. This cannot be undone."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = ::deleteAccount,
                    enabled = !deletingAccount
                ) {
                    Text(if (deletingAccount) "Deleting..." else "Delete Account")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showDeleteDialog = false },
                    enabled = !deletingAccount
                ) {
                    Text("Keep Account")
                }
            }
        )
    }

    AppDrawerScaffold(
        title = "Settings",
        currentRoute = Routes.Settings.route,
        onNavigateToRoute = onNavigateToRoute,
        drawerItems = Routes.authenticatedDrawerItems,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = "Profile"
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard {
                SectionHeader(
                    title = "Account",
                    subtitle = "Manage app and account preferences."
                )

                Text(
                    text = "Privacy, security, and session controls are available below.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            SecondaryButton(
                text = "Privacy & Security",
                onClick = onNavigateToPrivacySecurity,
                modifier = Modifier.fillMaxWidth()
            )

            SecondaryButton(
                text = "Log Out",
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth()
            )

            SectionCard {
                SectionHeader(
                    title = "Delete Account",
                    subtitle = "Remove your account and personal data from NEPH."
                )

                Text(
                    text = "Active assignments and volunteer availability will be cancelled before your account is disabled.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                deleteError?.let { message ->
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }

                PrimaryButton(
                    text = "Delete Account",
                    onClick = { showDeleteDialog = true },
                    loading = deletingAccount,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun SettingsScreenPreview() {
    NephTheme {
        SettingsScreen(
            onNavigateToRoute = {},
            onProfileClick = {},
            profileBadgeText = "PP",
            onNavigateToPrivacySecurity = {},
            onLogout = {},
            onAccountDeleted = {}
        )
    }
}
