package com.neph.features.profile.presentation

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import com.neph.core.network.ApiException
import com.neph.features.auth.util.countryCodeOptions
import com.neph.features.profile.data.CurrentLocationShareWarning
import com.neph.features.profile.data.DeviceLocationProvider
import com.neph.features.profile.data.LocationData
import com.neph.features.profile.data.LocationTreeRepository
import com.neph.features.profile.data.ProfileData
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.profile.data.bloodTypeOptions
import com.neph.features.profile.data.combinePhoneNumber
import com.neph.features.profile.data.expertiseOptionsFor
import com.neph.features.profile.data.locationData
import com.neph.features.profile.data.normalizePhoneParts
import com.neph.features.profile.data.parseListField
import com.neph.features.profile.data.professionOptionsFor
import com.neph.features.profile.data.sanitizeDecimalInput
import com.neph.features.profile.data.splitFullName
import com.neph.features.profile.data.toEditableString
import com.neph.features.profile.presentation.components.GenderSelector
import com.neph.features.profile.presentation.components.LocationSelector
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.components.inputs.AppDropdown
import com.neph.ui.components.inputs.AppTextArea
import com.neph.ui.components.inputs.AppTextField
import com.neph.ui.components.selection.AppCheckbox
import com.neph.ui.components.selection.AppToggleSwitch
import com.neph.ui.layout.AppScaffold
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun EditProfileScreen(
    onSave: (ProfileData) -> Unit,
    onNavigateBack: () -> Unit
) {
    var profile by remember { mutableStateOf(ProfileRepository.getProfile()) }
    val initialPhoneParts = remember { normalizePhoneParts(profile.phone) }

    var loading by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf("") }
    var info by rememberSaveable { mutableStateOf("") }

    var countryCode by rememberSaveable { mutableStateOf(initialPhoneParts.countryCode) }
    var phone by rememberSaveable { mutableStateOf(initialPhoneParts.phone) }
    var heightText by rememberSaveable { mutableStateOf(profile.height.toEditableString()) }
    var weightText by rememberSaveable { mutableStateOf(profile.weight.toEditableString()) }
    var ageText by rememberSaveable { mutableStateOf(profile.age?.toString().orEmpty()) }
    var availableLocationData by remember { mutableStateOf<LocationData>(locationData) }
    var locationLoading by remember { mutableStateOf(true) }
    var locationInfo by rememberSaveable { mutableStateOf("") }

    val scope = rememberCoroutineScope()
    val spacing = LocalNephSpacing.current
    val context = LocalContext.current
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.any { it }) {
            profile = profile.copy(shareLocation = true)
            info = "Location permission granted. Current location will be shared when you save."
        } else {
            profile = profile.copy(shareLocation = false)
            info = "Location permission denied. Current location sharing remains off."
        }
    }

    LaunchedEffect(Unit) {
        try {
            profile = ProfileRepository.fetchAndCacheRemoteProfile()
            val phoneParts = normalizePhoneParts(profile.phone)
            countryCode = phoneParts.countryCode
            phone = phoneParts.phone
            heightText = profile.height.toEditableString()
            weightText = profile.weight.toEditableString()
            ageText = profile.age?.toString().orEmpty()
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (_: ApiException) {
            profile = ProfileRepository.getProfile()
            val phoneParts = normalizePhoneParts(profile.phone)
            countryCode = phoneParts.countryCode
            phone = phoneParts.phone
            heightText = profile.height.toEditableString()
            weightText = profile.weight.toEditableString()
            ageText = profile.age?.toString().orEmpty()
        } catch (_: Exception) {
            profile = ProfileRepository.getProfile()
            val phoneParts = normalizePhoneParts(profile.phone)
            countryCode = phoneParts.countryCode
            phone = phoneParts.phone
            heightText = profile.height.toEditableString()
            weightText = profile.weight.toEditableString()
            ageText = profile.age?.toString().orEmpty()
            info = "Could not refresh your profile. Showing saved information."
        }
    }

    LaunchedEffect(Unit) {
        try {
            availableLocationData = LocationTreeRepository.ensureLocationData()
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (_: Exception) {
            availableLocationData = locationData
            locationInfo = "Could not refresh location options. Showing saved location list."
        } finally {
            locationLoading = false
        }
    }

    fun handleSave() {
        error = ""
        info = ""

        val (firstName, lastName) = splitFullName(profile.fullName.orEmpty())
        if (firstName.isBlank() || lastName.isBlank()) {
            error = "Please enter both first and last name."
            return
        }

        if (phone.isBlank()) {
            error = "Please enter your phone number."
            return
        }

        val heightFloat = heightText.toFloatOrNull()
        val weightFloat = weightText.toFloatOrNull()
        val ageInt = ageText.toIntOrNull()
        if (heightFloat == null || heightFloat <= 0f || weightFloat == null || weightFloat <= 0f) {
            error = "Height and weight must be valid positive numbers."
            return
        }

        if (ageInt == null || ageInt <= 0) {
            error = "Age must be a valid positive number."
            return
        }

        if (profile.country.isNullOrBlank() || profile.city.isNullOrBlank() || profile.district.isNullOrBlank() || profile.neighborhood.isNullOrBlank()) {
            error = "Please complete your location fields."
            return
        }

        loading = true
        scope.launch {
            try {
                val profileToSync = profile.copy(
                    phone = combinePhoneNumber(countryCode, phone),
                    height = heightFloat,
                    weight = weightFloat,
                    age = ageInt
                )
                val locationShareAttempt = DeviceLocationProvider.captureCurrentLocationForSharing(
                    context = context,
                    sharingEnabled = profileToSync.shareLocation == true
                )
                val syncedProfile = when (locationShareAttempt.warning) {
                    CurrentLocationShareWarning.PERMISSION_DENIED -> profileToSync.copy(shareLocation = false)
                    CurrentLocationShareWarning.LOCATION_UNAVAILABLE -> profileToSync
                    null -> profileToSync
                }

                profile = ProfileRepository.syncProfile(
                    profile = syncedProfile,
                    currentDeviceLocation = locationShareAttempt.location,
                    forceClearSharedCoordinates = locationShareAttempt.warning == CurrentLocationShareWarning.LOCATION_UNAVAILABLE
                )
                val phoneParts = normalizePhoneParts(profile.phone)
                countryCode = phoneParts.countryCode
                phone = phoneParts.phone
                heightText = profile.height.toEditableString()
                weightText = profile.weight.toEditableString()
                ageText = profile.age?.toString().orEmpty()
                info = when (locationShareAttempt.warning) {
                    CurrentLocationShareWarning.PERMISSION_DENIED ->
                        "Profile updated successfully. Location permission is denied, so location sharing was turned off and stored coordinates were cleared."

                    CurrentLocationShareWarning.LOCATION_UNAVAILABLE ->
                        "Profile updated successfully. Current location is unavailable, so sharing remains on and stale coordinates were cleared."

                    null -> {
                        if (locationShareAttempt.location != null) {
                            "Profile updated successfully. Current location shared."
                        } else {
                            "Profile updated successfully."
                        }
                    }
                }
                onSave(profile)
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (errorResponse: ApiException) {
                error = errorResponse.message.ifBlank { "Could not save your profile. Please try again." }
            } catch (_: Exception) {
                error = "Something went wrong while saving your profile. Please try again."
            } finally {
                loading = false
            }
        }
    }

    AppScaffold(title = "Edit Profile", onNavigateBack = onNavigateBack) {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.lg)) {
            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(title = "Account Information")

                    AppTextField(
                        value = profile.fullName.orEmpty(),
                        onValueChange = { profile = profile.copy(fullName = it) },
                        label = "Full Name"
                    )

                    AppTextField(
                        value = profile.email.orEmpty(),
                        onValueChange = {},
                        label = "Email",
                        enabled = false
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(spacing.sm)) {
                        AppDropdown(
                            value = countryCode,
                            onValueChange = { countryCode = it },
                            label = "Code",
                            options = countryCodeOptions,
                            modifier = Modifier.weight(0.42f),
                            selectedTextMapper = { it.value }
                        )

                        AppTextField(
                            value = phone,
                            onValueChange = { phone = it.filter(Char::isDigit) },
                            label = "Phone Number",
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            modifier = Modifier.weight(0.58f)
                        )
                    }
                }
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(title = "Physical Information")

                    Row(horizontalArrangement = Arrangement.spacedBy(spacing.sm)) {
                        AppTextField(
                            value = heightText,
                            onValueChange = { heightText = sanitizeDecimalInput(it, maxLen = 3) },
                            label = "Height (cm)",
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                        )

                        AppTextField(
                            value = weightText,
                            onValueChange = { weightText = sanitizeDecimalInput(it, maxLen = 3) },
                            label = "Weight (kg)",
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                        )
                    }

                    GenderSelector(
                        value = profile.gender.orEmpty(),
                        onValueChange = { profile = profile.copy(gender = it) }
                    )

                    AppTextField(
                        value = ageText,
                        onValueChange = {
                            ageText = it.filter(Char::isDigit).take(3)
                        },
                        label = "Age",
                        placeholder = "Enter your age",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(title = "Medical Information")

                    AppDropdown(
                        value = profile.bloodType.orEmpty(),
                        onValueChange = { profile = profile.copy(bloodType = it) },
                        label = "Blood Type",
                        options = bloodTypeOptions,
                        selectedTextMapper = { it.label }
                    )

                    AppTextArea(
                        value = profile.medicalHistory.orEmpty(),
                        onValueChange = { profile = profile.copy(medicalHistory = it) },
                        label = "Medical History"
                    )

                    AppTextArea(
                        value = profile.chronicDiseases.orEmpty(),
                        onValueChange = { profile = profile.copy(chronicDiseases = it) },
                        label = "Chronic Diseases"
                    )

                    AppTextArea(
                        value = profile.allergies.orEmpty(),
                        onValueChange = { profile = profile.copy(allergies = it) },
                        label = "Allergies"
                    )

                    HelperText(text = "Document upload is still unavailable because the backend upload flow does not exist yet.")
                }
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(title = "Profession")

                    AppDropdown(
                        value = profile.profession.orEmpty(),
                        onValueChange = { value ->
                            profile = profile.copy(profession = value.takeIf(String::isNotBlank))
                        },
                        label = "Profession",
                        options = professionOptionsFor(profile.profession),
                        placeholder = "Select your profession"
                    )

                    Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
                        Text(
                            text = "Expertise (optional)",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        expertiseOptionsFor(profile.expertise).forEach { option ->
                            AppCheckbox(
                                checked = option in profile.expertise,
                                onCheckedChange = { checked ->
                                    profile = profile.copy(
                                        expertise = if (checked) {
                                            profile.expertise + option
                                        } else {
                                            profile.expertise - option
                                        }
                                    )
                                },
                                label = option
                            )
                        }
                    }
                }
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(title = "Location")

                    if (locationLoading) {
                        HelperText(text = "Loading location options...")
                    }

                    if (locationInfo.isNotBlank()) {
                        HelperText(text = locationInfo)
                    }

                    LocationSelector(
                        country = profile.country.orEmpty(),
                        city = profile.city.orEmpty(),
                        district = profile.district.orEmpty(),
                        neighborhood = profile.neighborhood.orEmpty(),
                        onCountryChange = {
                            profile = profile.copy(country = it, city = "", district = "", neighborhood = "")
                        },
                        onCityChange = {
                            profile = profile.copy(city = it, district = "", neighborhood = "")
                        },
                        onDistrictChange = {
                            profile = profile.copy(district = it, neighborhood = "")
                        },
                        onNeighborhoodChange = {
                            profile = profile.copy(neighborhood = it)
                        },
                        locationData = availableLocationData,
                        enabled = !locationLoading
                    )

                    AppTextField(
                        value = profile.extraAddress.orEmpty(),
                        onValueChange = { profile = profile.copy(extraAddress = it) },
                        label = "Extra Address"
                    )

                    AppToggleSwitch(
                        checked = profile.shareLocation ?: false,
                        onCheckedChange = { shareEnabled ->
                            if (!shareEnabled) {
                                profile = profile.copy(shareLocation = false)
                                return@AppToggleSwitch
                            }

                            if (DeviceLocationProvider.hasLocationPermission(context)) {
                                profile = profile.copy(shareLocation = true)
                            } else {
                                locationPermissionLauncher.launch(DeviceLocationProvider.RequiredLocationPermissions)
                            }
                        },
                        label = "Share Current Location"
                    )
                }
            }

            if (error.isNotBlank()) {
                HelperText(text = error)
            }

            if (info.isNotBlank()) {
                HelperText(text = info)
            }

            PrimaryButton(
                text = "Save Changes",
                onClick = ::handleSave,
                loading = loading
            )
        }
    }
}
