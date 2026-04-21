package com.neph.features.auth.presentation

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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import android.widget.Toast
import com.neph.core.network.ApiException
import com.neph.features.auth.util.countryCodeOptions
import com.neph.features.profile.data.CurrentLocationShareWarning
import com.neph.features.profile.data.DeviceLocationProvider
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.profile.data.LocationData
import com.neph.features.profile.data.LocationTreeRepository
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
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SaveActionBar
import com.neph.ui.components.inputs.AppDropdown
import com.neph.ui.components.inputs.AppTextArea
import com.neph.ui.components.inputs.AppTextField
import com.neph.ui.components.selection.AppCheckbox
import com.neph.ui.components.selection.AppToggleSwitch
import com.neph.ui.layout.AuthScaffold
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun CompleteProfileScreen(
    onComplete: () -> Unit,
    onNavigateBack: () -> Unit
) {
    val existingProfile = remember { ProfileRepository.getProfile() }
    val existingPhoneParts = remember(existingProfile.phone) { normalizePhoneParts(existingProfile.phone) }
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var fullName by rememberSaveable { mutableStateOf(existingProfile.fullName.orEmpty()) }
    var countryCode by rememberSaveable { mutableStateOf(existingPhoneParts.countryCode) }
    var phone by rememberSaveable { mutableStateOf(existingPhoneParts.phone) }
    var gender by rememberSaveable { mutableStateOf(existingProfile.gender.orEmpty()) }
    var height by rememberSaveable { mutableStateOf(existingProfile.height.toEditableString()) }
    var weight by rememberSaveable { mutableStateOf(existingProfile.weight.toEditableString()) }
    var age by rememberSaveable { mutableStateOf(existingProfile.age?.toString().orEmpty()) }
    var bloodType by rememberSaveable { mutableStateOf(existingProfile.bloodType.orEmpty()) }
    var medicalHistory by rememberSaveable { mutableStateOf(existingProfile.medicalHistory.orEmpty()) }
    var chronicDiseases by rememberSaveable { mutableStateOf(existingProfile.chronicDiseases.orEmpty()) }
    var allergies by rememberSaveable { mutableStateOf(existingProfile.allergies.orEmpty()) }
    var country by rememberSaveable { mutableStateOf(existingProfile.country.orEmpty()) }
    var city by rememberSaveable { mutableStateOf(existingProfile.city.orEmpty()) }
    var district by rememberSaveable { mutableStateOf(existingProfile.district.orEmpty()) }
    var neighborhood by rememberSaveable { mutableStateOf(existingProfile.neighborhood.orEmpty()) }
    var extraAddress by rememberSaveable { mutableStateOf(existingProfile.extraAddress.orEmpty()) }
    var shareLocation by rememberSaveable { mutableStateOf(existingProfile.shareLocation ?: false) }
    var profession by rememberSaveable { mutableStateOf(existingProfile.profession) }
    var expertise by rememberSaveable { mutableStateOf(existingProfile.expertise) }
    var loading by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf("") }
    var info by rememberSaveable { mutableStateOf("") }
    var availableLocationData by remember { mutableStateOf<LocationData>(locationData) }
    var locationLoading by remember { mutableStateOf(true) }
    var locationInfo by rememberSaveable { mutableStateOf("") }
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.any { it }) {
            shareLocation = true
            info = "Location permission granted. Current location will be shared when you save."
        } else {
            shareLocation = false
            info = "Location permission denied. Current location sharing remains off."
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

        val normalizedName = fullName.trim()
        val normalizedPhone = phone.trim()
        val (firstName, lastName) = splitFullName(normalizedName)

        if (firstName.isBlank() || lastName.isBlank()) {
            error = "Please enter both first and last name."
            return
        }

        if (normalizedPhone.isEmpty()) {
            error = "Please enter your phone number."
            return
        }

        if (normalizedPhone.startsWith("0")) {
            error = "Enter your phone number without the leading 0."
            return
        }

        if (height.isBlank() || weight.isBlank() || age.isBlank() ||
            country.isBlank() || city.isBlank() || district.isBlank() || neighborhood.isBlank()
        ) {
            error = "Please fill in all required fields."
            return
        }

        val heightFloat = height.toFloatOrNull()
        val weightFloat = weight.toFloatOrNull()
        val ageInt = age.toIntOrNull()
        if (heightFloat == null || weightFloat == null || heightFloat <= 0f || weightFloat <= 0f) {
            error = "Height and weight must be valid positive numbers."
            return
        }

        if (ageInt == null || ageInt <= 0) {
            error = "Age must be a valid positive number."
            return
        }

        loading = true
        scope.launch {
            try {
                val profileToSync = ProfileRepository.getProfile().copy(
                    fullName = normalizedName,
                    phone = combinePhoneNumber(countryCode, normalizedPhone),
                    gender = gender.takeIf(String::isNotBlank),
                    height = heightFloat,
                    weight = weightFloat,
                    age = ageInt,
                    bloodType = bloodType.takeIf(String::isNotBlank),
                    medicalHistory = medicalHistory.takeIf(String::isNotBlank),
                    chronicDiseases = chronicDiseases.takeIf(String::isNotBlank),
                    allergies = allergies.takeIf(String::isNotBlank),
                    country = country,
                    city = city,
                    district = district,
                    neighborhood = neighborhood,
                    extraAddress = extraAddress.takeIf(String::isNotBlank),
                    shareLocation = shareLocation,
                    profession = profession?.trim()?.takeIf(String::isNotBlank),
                    expertise = parseListField(expertise.joinToString(", "))
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

                ProfileRepository.syncProfile(
                    profile = syncedProfile,
                    currentDeviceLocation = locationShareAttempt.location,
                    forceClearSharedCoordinates = locationShareAttempt.warning == CurrentLocationShareWarning.LOCATION_UNAVAILABLE
                )

                val completionMessage = when (locationShareAttempt.warning) {
                    CurrentLocationShareWarning.PERMISSION_DENIED ->
                        "Profile saved. Location permission is denied, so location sharing was turned off and stored coordinates were cleared."

                    CurrentLocationShareWarning.LOCATION_UNAVAILABLE ->
                        "Profile saved. Current location is unavailable, so sharing remains on and stale coordinates were cleared."

                    null -> {
                        if (locationShareAttempt.location != null) {
                            "Profile saved. Current location shared."
                        } else {
                            "Profile saved."
                        }
                    }
                }

                info = completionMessage
                Toast.makeText(context, completionMessage, Toast.LENGTH_LONG).show()

                onComplete()
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (errorResponse: ApiException) {
                error = errorResponse.message.ifBlank { "Failed to save profile." }
            } catch (_: Exception) {
                error = "Something went wrong while saving your profile. Please try again."
            } finally {
                loading = false
            }
        }
    }

    AuthScaffold(
        title = "Complete Your Profile",
        subtitle = "Set up your account details"
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
            AppTextField(
                value = fullName,
                onValueChange = { fullName = it },
                label = "Full Name",
                testTag = "complete_profile_full_name",
                placeholder = "Enter your full name"
            )

            Row(horizontalArrangement = Arrangement.spacedBy(spacing.sm)) {
                AppDropdown(
                    value = countryCode,
                    onValueChange = { countryCode = it },
                    label = "Code",
                    options = countryCodeOptions,
                    modifier = Modifier.weight(0.42f),
                    testTag = "complete_profile_country_code",
                    optionTestTagPrefix = "complete_profile_country_code_option",
                    selectedTextMapper = { it.value }
                )

                AppTextField(
                    value = phone,
                    onValueChange = { phone = it.filter(Char::isDigit) },
                    label = "Phone Number",
                    placeholder = "Enter your phone number",
                    testTag = "complete_profile_phone",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    modifier = Modifier.weight(0.58f)
                )
            }

            HelperText(text = "Enter your phone number without the leading 0.")

            Row(horizontalArrangement = Arrangement.spacedBy(spacing.sm)) {
                AppTextField(
                    value = height,
                    onValueChange = { height = sanitizeDecimalInput(it, maxLen = 3) },
                    label = "Height (cm)",
                    testTag = "complete_profile_height",
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )

                AppTextField(
                    value = weight,
                    onValueChange = { weight = sanitizeDecimalInput(it, maxLen = 3) },
                    label = "Weight (kg)",
                    testTag = "complete_profile_weight",
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )
            }

            GenderSelector(value = gender, onValueChange = { gender = it })

            AppTextField(
                value = age,
                onValueChange = { age = it.filter(Char::isDigit).take(3) },
                label = "Age",
                testTag = "complete_profile_age",
                placeholder = "Enter your age",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
            )

            Text("Medical Information (optional)", style = MaterialTheme.typography.titleMedium)

            AppDropdown(
                value = bloodType,
                onValueChange = { bloodType = it },
                label = "Blood Type",
                options = bloodTypeOptions,
                selectedTextMapper = { it.label }
            )

            AppTextArea(
                value = medicalHistory,
                onValueChange = { medicalHistory = it },
                label = "Medical History (optional — comma-separated)"
            )

            AppTextArea(
                value = chronicDiseases,
                onValueChange = { chronicDiseases = it },
                label = "Chronic Diseases (optional — comma-separated)"
            )

            AppTextArea(
                value = allergies,
                onValueChange = { allergies = it },
                label = "Allergies (optional — comma-separated)"
            )

            Text("Profession", style = MaterialTheme.typography.titleMedium)

            AppDropdown(
                value = profession.orEmpty(),
                onValueChange = { profession = it },
                label = "Profession",
                options = professionOptionsFor(profession),
                placeholder = "Select your profession"
            )

            Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
                Text(
                    text = "Expertise (optional)",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )

                expertiseOptionsFor(expertise).forEach { option ->
                    AppCheckbox(
                        checked = option in expertise,
                        onCheckedChange = { checked ->
                            expertise = if (checked) {
                                expertise + option
                            } else {
                                expertise - option
                            }
                        },
                        label = option
                    )
                }
            }

            Text("Location", style = MaterialTheme.typography.titleMedium)

            if (locationLoading) {
                HelperText(text = "Loading location options...")
            }

            if (locationInfo.isNotBlank()) {
                HelperText(text = locationInfo)
            }

            LocationSelector(
                country = country,
                city = city,
                district = district,
                neighborhood = neighborhood,
                onCountryChange = {
                    country = it
                    city = ""
                    district = ""
                    neighborhood = ""
                },
                onCityChange = {
                    city = it
                    district = ""
                    neighborhood = ""
                },
                onDistrictChange = {
                    district = it
                    neighborhood = ""
                },
                onNeighborhoodChange = { neighborhood = it },
                locationData = availableLocationData,
                enabled = !locationLoading
            )

            AppTextField(
                value = extraAddress,
                onValueChange = { extraAddress = it },
                label = "Extra Address",
                testTag = "complete_profile_extra_address"
            )

            AppToggleSwitch(
                checked = shareLocation,
                onCheckedChange = { shareEnabled ->
                    if (!shareEnabled) {
                        shareLocation = false
                        return@AppToggleSwitch
                    }

                    if (DeviceLocationProvider.hasLocationPermission(context)) {
                        shareLocation = true
                    } else {
                        locationPermissionLauncher.launch(DeviceLocationProvider.RequiredLocationPermissions)
                    }
                },
                label = "Share Current Location"
            )

            if (error.isNotBlank()) {
                Text(error, color = MaterialTheme.colorScheme.error)
            }

            if (info.isNotBlank()) {
                HelperText(text = info)
            }

            SaveActionBar(onSave = ::handleSave, loading = loading)
        }
    }
}
