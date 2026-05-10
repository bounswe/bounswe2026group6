package com.neph.features.settings.presentation

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.neph.core.theme.ThemePreferenceStore
import com.neph.features.auth.data.AuthRepository
import com.neph.features.onboarding.data.MobileOnboardingStepId
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.display.IconListRow
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.components.display.StatusBadgeTone
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
    onAccountDeleted: () -> Unit,
    onRestartMobileOnboarding: () -> Unit,
    mobileOnboardingStepId: MobileOnboardingStepId? = null,
    onMobileOnboardingStepCompleted: (String?) -> Unit = {}
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
        profileLabel = "Profile",
        mobileOnboardingStepId = mobileOnboardingStepId,
        onMobileOnboardingStepCompleted = onMobileOnboardingStepCompleted
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard {
                SectionHeader(
                    title = "Appearance",
                    subtitle = "Choose how NEPH looks on this device."
                )

                val themeMode by ThemePreferenceStore.themeModeFlow.collectAsState()
                val darkThemeEnabled = ThemePreferenceStore.resolveDarkTheme(
                    themeMode = themeMode,
                    systemDarkTheme = isSystemInDarkTheme()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(spacing.md)
                ) {
                    androidx.compose.material3.Icon(
                        imageVector = Icons.Filled.DarkMode,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Dark mode",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = if (darkThemeEnabled) "On" else "Off",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Switch(
                        checked = darkThemeEnabled,
                        onCheckedChange = { ThemePreferenceStore.setDarkThemeEnabled(it) }
                    )
                }
            }

            SectionCard {
                SectionHeader(
                    title = "App guide",
                    subtitle = "Replay the guided tour of NEPH's core concepts."
                )

                PrimaryButton(
                    text = "Restart App Guide",
                    onClick = onRestartMobileOnboarding,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            SectionCard {
                SectionHeader(
                    title = "Account",
                    subtitle = "Manage your privacy, security, and active session."
                )

                Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
                    IconListRow(
                        icon = Icons.Filled.Shield,
                        title = "Privacy & Security",
                        supportingText = "Profile visibility and password",
                        iconTone = StatusBadgeTone.INFO,
                        onClick = onNavigateToPrivacySecurity
                    )

                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

                    IconListRow(
                        icon = Icons.AutoMirrored.Filled.Logout,
                        title = "Log Out",
                        supportingText = "Sign out of this device",
                        iconTone = StatusBadgeTone.NEUTRAL,
                        onClick = onLogout
                    )
                }
            }

            SectionCard {
                SectionHeader(
                    title = "Danger Zone",
                    subtitle = "Permanently remove your account and all personal data from NEPH."
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
                    text = if (deletingAccount) "Deleting..." else "Delete Account",
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
            onAccountDeleted = {},
            onRestartMobileOnboarding = {}
        )
    }
}
