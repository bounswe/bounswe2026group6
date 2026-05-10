package com.neph.features.privacysecurity.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import com.neph.core.network.ApiException
import com.neph.features.profile.data.CurrentLocationShareWarning
import com.neph.features.profile.data.DeviceLocationProvider
import com.neph.features.profile.data.ProfileData
import com.neph.features.profile.data.ProfileRepository
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.components.selection.AppRadioGroup
import com.neph.ui.components.selection.AppToggleSwitch
import com.neph.ui.components.selection.RadioOption
import com.neph.ui.layout.AppScaffold
import com.neph.ui.location.rememberForegroundLocationPermissionRequester
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

private const val PrivateVisibility = "PRIVATE"
private const val EmergencyVisibility = "EMERGENCY_ONLY"
private const val PublicVisibility = "PUBLIC"

private val visibilityOptions = listOf(
    RadioOption("Private", PrivateVisibility),
    RadioOption("Emergency only", EmergencyVisibility),
    RadioOption("Public", PublicVisibility)
)

@Composable
fun PrivacySecurityScreen(
    onNavigateBack: () -> Unit,
    onResetPassword: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var profileVisibility by remember { mutableStateOf(ProfileRepository.DefaultProfileVisibility) }
    var healthInfoVisibility by remember { mutableStateOf(ProfileRepository.DefaultHealthInfoVisibility) }
    var locationVisibility by remember {
        mutableStateOf(ProfileRepository.defaultLocationVisibilityFromStoredPermission())
    }
    var shareLocation by remember { mutableStateOf(false) }
    var initialShareLocation by remember { mutableStateOf(false) }
    var hasSavedCoordinates by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var info by remember { mutableStateOf("") }
    var pendingSaveAfterPermissionRequest by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            val profile = ProfileRepository.fetchAndCacheRemoteProfile()
            profileVisibility = profile.profileVisibility ?: ProfileRepository.DefaultProfileVisibility
            healthInfoVisibility = profile.healthInfoVisibility ?: ProfileRepository.DefaultHealthInfoVisibility
            locationVisibility = profile.locationVisibility ?: ProfileRepository.defaultLocationVisibilityFromStoredPermission()
            shareLocation = profile.shareLocation == true
            initialShareLocation = profile.shareLocation == true
            hasSavedCoordinates = profile.sharedLatitude != null && profile.sharedLongitude != null
            error = ""
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (apiError: ApiException) {
            error = if (apiError.status == 401) {
                "Your session expired. Please log in again."
            } else {
                apiError.message.ifBlank { "Could not load privacy settings." }
            }
        } catch (_: Exception) {
            error = "Could not load privacy settings."
        } finally {
            loading = false
        }
    }

    fun applyProfileState(profile: ProfileData) {
        profileVisibility = profile.profileVisibility ?: ProfileRepository.DefaultProfileVisibility
        healthInfoVisibility = profile.healthInfoVisibility ?: ProfileRepository.DefaultHealthInfoVisibility
        locationVisibility = profile.locationVisibility ?: ProfileRepository.defaultLocationVisibilityFromStoredPermission()
        shareLocation = profile.shareLocation == true
        initialShareLocation = profile.shareLocation == true
        hasSavedCoordinates = profile.sharedLatitude != null && profile.sharedLongitude != null
    }

    fun locationCaptureFailureMessage(warning: CurrentLocationShareWarning?): String {
        return when (warning) {
            CurrentLocationShareWarning.PERMISSION_DENIED ->
                "Privacy settings saved. Share Current Location was not enabled because location permission was denied."

            CurrentLocationShareWarning.LOCATION_UNAVAILABLE,
            null -> "Privacy settings saved. Share Current Location was not enabled because current location is unavailable."
        }
    }

    fun savePrivacySettingsWithCurrentPermission() {
        if (saving) return

        scope.launch {
            try {
                saving = true
                error = ""
                info = ""

                val needsLocationInitialization = !initialShareLocation && shareLocation && !hasSavedCoordinates
                var locationSharingEnabled = shareLocation

                if (needsLocationInitialization) {
                    val attempt = DeviceLocationProvider.captureCurrentLocationForSharing(
                        context = context,
                        sharingEnabled = true
                    )
                    val currentLocation = attempt.location

                    if (currentLocation == null) {
                        locationSharingEnabled = false
                        shareLocation = false
                        error = locationCaptureFailureMessage(attempt.warning)
                    } else {
                        val locationProfile = ProfileRepository.syncSharedCurrentLocation(currentLocation)
                        hasSavedCoordinates = locationProfile.sharedLatitude != null &&
                            locationProfile.sharedLongitude != null
                    }
                }

                val profile = ProfileRepository.syncPrivacySettings(
                    profileVisibility = profileVisibility,
                    healthInfoVisibility = healthInfoVisibility,
                    locationVisibility = locationVisibility,
                    locationSharingEnabled = locationSharingEnabled
                )

                applyProfileState(profile)
                if (error.isBlank()) {
                    info = "Privacy settings updated successfully."
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (apiError: ApiException) {
                error = if (apiError.status == 401) {
                    "Your session expired. Please log in again."
                } else {
                    apiError.message.ifBlank { "Could not save privacy settings." }
                }
            } catch (_: Exception) {
                error = "Could not save privacy settings."
            } finally {
                saving = false
            }
        }
    }

    val locationPermissionRequester = rememberForegroundLocationPermissionRequester {
        if (!pendingSaveAfterPermissionRequest) {
            return@rememberForegroundLocationPermissionRequester
        }

        pendingSaveAfterPermissionRequest = false
        savePrivacySettingsWithCurrentPermission()
    }

    fun savePrivacySettings() {
        if (saving) return

        val needsLocationInitialization = !initialShareLocation && shareLocation && !hasSavedCoordinates
        if (needsLocationInitialization && !locationPermissionRequester.refreshPermissionState()) {
            pendingSaveAfterPermissionRequest = true
            locationPermissionRequester.requestPermission()
            return
        }

        savePrivacySettingsWithCurrentPermission()
    }

    AppScaffold(
        title = "Privacy & Security",
        onNavigateBack = onNavigateBack
    ) {
        if (loading) {
            HelperText(text = "Loading privacy settings...")
        } else {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(spacing.lg)
            ) {
                SectionCard {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(spacing.md)
                    ) {
                        Text(
                            text = "Choose who can see profile, health, and location details.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        AppRadioGroup(
                            value = profileVisibility,
                            onValueChange = { profileVisibility = it },
                            label = "Profile visibility",
                            options = visibilityOptions,
                            vertical = true
                        )

                        AppRadioGroup(
                            value = healthInfoVisibility,
                            onValueChange = { healthInfoVisibility = it },
                            label = "Health information visibility",
                            options = visibilityOptions,
                            vertical = true
                        )

                        AppRadioGroup(
                            value = locationVisibility,
                            onValueChange = { locationVisibility = it },
                            label = "Saved location visibility",
                            options = visibilityOptions,
                            vertical = true
                        )

                        AppToggleSwitch(
                            checked = shareLocation,
                            onCheckedChange = { shareLocation = it },
                            label = "Share Current Location",
                            description = "Allow emergency coordination flows to use your saved current-location status."
                        )
                    }
                }

                SectionCard {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(spacing.md)
                    ) {
                        SectionHeader(
                            title = "Security",
                            subtitle = "Password recovery and email verification use the existing account flows."
                        )

                        Text(
                            text = "Use Forgot Password from the login screen to reset your password securely.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        SecondaryButton(
                            text = "Reset your password",
                            onClick = onResetPassword,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
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
                    text = "Save Privacy Settings",
                    onClick = ::savePrivacySettings,
                    loading = saving,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun PrivacySecurityScreenPreview() {
    NephTheme {
        PrivacySecurityScreen(
            onNavigateBack = {},
            onResetPassword = {}
        )
    }
}
