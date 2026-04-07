package com.neph.features.profile.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.neph.core.network.ApiException
import com.neph.features.auth.data.AuthRepository
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.profile.data.locationData
import com.neph.features.profile.data.toEditableString
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException

@Composable
fun ProfileScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: () -> Unit,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    onNavigateToCompleteProfile: () -> Unit,
    onNavigateToEditProfile: () -> Unit,
    onLogout: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    var profile by remember { mutableStateOf(ProfileRepository.getProfile()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        try {
            profile = ProfileRepository.fetchAndCacheRemoteProfile()
            error = ""
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (errorResponse: ApiException) {
            when (errorResponse.status) {
                401 -> {
                    AuthRepository.logout()
                    onLogout()
                }
                404 -> onNavigateToCompleteProfile()
                else -> error = errorResponse.message.ifBlank { "Could not load your profile." }
            }
        } catch (_: Exception) {
            error = "Something went wrong while loading your profile. Please try again."
        } finally {
            loading = false
        }
    }

    AppDrawerScaffold(
        title = "Profile",
        currentRoute = Routes.Profile.route,
        onNavigateToRoute = onNavigateToRoute,
        drawerItems = Routes.authenticatedDrawerItems,
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = "Profile"
    ) {
        if (loading) {
            HelperText(text = "Loading your profile...")
        } else {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(spacing.lg)
            ) {
                val countryLabel = profile.country?.let { locationData[it]?.label ?: it }
                val cityLabel = profile.city?.let { cityKey ->
                    val countryKey = profile.country.orEmpty()
                    locationData[countryKey]?.cities?.get(cityKey)?.label ?: cityKey
                }

                if (error.isNotBlank()) {
                    HelperText(text = error)
                }

                SectionCard {
                    SectionHeader(
                        title = profile.fullName ?: "User",
                        subtitle = profile.email ?: "No email"
                    )

                    ProfileField(label = "Phone", value = profile.phone)
                    ProfileField(label = "Profession", value = profile.profession)
                    ProfileField(
                        label = "Expertise",
                        value = profile.expertise.takeIf { it.isNotEmpty() }?.joinToString(", ")
                    )
                }

                SectionCard {
                    SectionHeader(
                        title = "Physical Information"
                    )

                    ProfileField(
                        label = "Height",
                        value = profile.height?.toEditableString()?.takeIf { it.isNotBlank() }?.let { "$it cm" }
                    )
                    ProfileField(
                        label = "Weight",
                        value = profile.weight?.toEditableString()?.takeIf { it.isNotBlank() }?.let { "$it kg" }
                    )
                    ProfileField(label = "Gender", value = profile.gender)
                    ProfileField(label = "Blood Type", value = profile.bloodType)
                }

                SectionCard {
                    SectionHeader(
                        title = "Medical Information"
                    )

                    ProfileField(label = "Medical History", value = profile.medicalHistory)
                    ProfileField(label = "Chronic Diseases", value = profile.chronicDiseases)
                    ProfileField(label = "Allergies", value = profile.allergies)
                }

                SectionCard {
                    SectionHeader(
                        title = "Location"
                    )

                    ProfileField(label = "Country", value = countryLabel)
                    ProfileField(label = "City", value = cityLabel)
                    ProfileField(label = "District", value = profile.district)
                    ProfileField(label = "Neighborhood", value = profile.neighborhood)
                    ProfileField(label = "Extra Address", value = profile.extraAddress)
                    ProfileField(
                        label = "Share Current Location",
                        value = profile.shareLocation?.let { if (it) "Enabled" else "Disabled" }
                    )
                }

                SecondaryButton(
                    text = "Edit Profile",
                    onClick = onNavigateToEditProfile,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun ProfileField(label: String, value: String?) {
    Text(
        text = "$label: ${value ?: "-"}",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}