package com.neph.features.profile.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.neph.core.network.ApiException
import com.neph.features.auth.data.AuthRepository
import com.neph.features.profile.data.LocationData
import com.neph.features.profile.data.LocationTreeRepository
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.profile.data.composeFullName
import com.neph.features.profile.data.locationData
import com.neph.features.profile.data.toEditableString
import com.neph.navigation.Routes
import com.neph.ui.components.display.HelperText
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
    var availableLocationData by remember { mutableStateOf<LocationData>(locationData) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        try {
            availableLocationData = LocationTreeRepository.ensureLocationData()
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
        profileLabel = "Profile",
        contentMaxWidth = 480.dp
    ) {
        if (loading) {
            HelperText(text = "Loading your profile...")
        } else {
            val countryLabel = profile.country?.let { availableLocationData[it]?.label ?: it }
            val cityLabel = profile.city?.let { cityKey ->
                val countryKey = profile.country.orEmpty()
                availableLocationData[countryKey]?.cities?.get(cityKey)?.label ?: cityKey
            }
            val displayName = composeFullName(profile.firstName, profile.lastName) ?: profile.fullName

            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(spacing.xl)
            ) {
                ProfileHero(
                    displayName = displayName ?: "User",
                    email = profile.email,
                    initial = (displayName ?: "U").trim().firstOrNull()?.uppercase().orEmpty(),
                    onEditProfile = onNavigateToEditProfile
                )

                if (error.isNotBlank()) {
                    HelperText(text = error)
                }

                ProfileSection(title = "Contact") {
                    ProfileFieldRow(label = "Phone", value = profile.phone)
                    ProfileFieldRow(label = "Profession", value = profile.profession)
                    ProfileFieldRow(
                        label = "Expertise",
                        value = profile.expertise.takeIf { it.isNotEmpty() }?.joinToString(", ")
                    )
                }

                ProfileSection(title = "Physical") {
                    ProfileFieldRow(label = "Date of birth", value = profile.dateOfBirth)
                    ProfileFieldRow(
                        label = "Height",
                        value = profile.height?.toEditableString()?.takeIf { it.isNotBlank() }?.let { "$it cm" }
                    )
                    ProfileFieldRow(
                        label = "Weight",
                        value = profile.weight?.toEditableString()?.takeIf { it.isNotBlank() }?.let { "$it kg" }
                    )
                    ProfileFieldRow(label = "Gender", value = profile.gender)
                    ProfileFieldRow(label = "Blood type", value = profile.bloodType)
                }

                ProfileSection(title = "Medical") {
                    ProfileFieldRow(label = "Medical history", value = profile.medicalHistory)
                    ProfileFieldRow(label = "Chronic diseases", value = profile.chronicDiseases)
                    ProfileFieldRow(label = "Allergies", value = profile.allergies)
                }

                ProfileSection(title = "Location") {
                    ProfileFieldRow(label = "Country", value = countryLabel)
                    ProfileFieldRow(label = "City", value = cityLabel)
                    ProfileFieldRow(label = "District", value = profile.district)
                    ProfileFieldRow(label = "Neighborhood", value = profile.neighborhood)
                    ProfileFieldRow(label = "Extra address", value = profile.extraAddress)
                    ProfileFieldRow(
                        label = "Share current location",
                        value = profile.shareLocation?.let { if (it) "Enabled" else "Disabled" }
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileHero(
    displayName: String,
    email: String?,
    initial: String,
    onEditProfile: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(
                        MaterialTheme.colorScheme.primary,
                        MaterialTheme.colorScheme.secondary
                    )
                ),
                shape = RoundedCornerShape(28.dp)
            )
            .padding(horizontal = spacing.xl, vertical = spacing.xl)
    ) {
        IconButton(
            onClick = onEditProfile,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .size(40.dp)
                .background(
                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.18f),
                    shape = CircleShape
                )
        ) {
            Icon(
                imageVector = Icons.Filled.Edit,
                contentDescription = "Edit profile",
                tint = MaterialTheme.colorScheme.onPrimary
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            Box(
                modifier = Modifier
                    .size(76.dp)
                    .background(
                        color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.18f),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (initial.isNotEmpty()) {
                    Text(
                        text = initial,
                        style = MaterialTheme.typography.headlineMedium,
                        color = MaterialTheme.colorScheme.onPrimary,
                        fontWeight = FontWeight.Bold
                    )
                } else {
                    Icon(
                        imageVector = Icons.Filled.Person,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimary
                    )
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = displayName,
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onPrimary,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = email?.takeIf { it.isNotBlank() } ?: "No email on file",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f)
                )
            }
        }
    }
}

@Composable
private fun ProfileSection(
    title: String,
    content: @Composable () -> Unit
) {
    val spacing = LocalNephSpacing.current
    Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
        Text(
            text = title.uppercase(),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = spacing.xs)
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(20.dp)
                )
                .padding(horizontal = spacing.lg, vertical = spacing.sm)
        ) {
            content()
        }
    }
}

@Composable
private fun ProfileFieldRow(label: String, value: String?) {
    val spacing = LocalNephSpacing.current
    Column {
        Spacer(modifier = Modifier.height(spacing.sm))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(0.45f)
            )
            Text(
                text = value?.takeIf { it.isNotBlank() } ?: "—",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(0.55f)
            )
        }
        Spacer(modifier = Modifier.height(spacing.sm))
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
    }
}
