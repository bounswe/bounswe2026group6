package com.neph.features.auth.presentation

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import com.neph.core.network.ApiException
import com.neph.features.auth.util.countryCodeOptions
import com.neph.features.profile.data.CurrentLocationShareWarning
import com.neph.features.profile.data.DeviceLocationProvider
import com.neph.features.profile.data.LocationData
import com.neph.features.profile.data.LocationTreeRepository
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.profile.data.bloodTypeOptions
import com.neph.features.profile.data.calculateAgeFromDateOfBirth
import com.neph.features.profile.data.combinePhoneNumber
import com.neph.features.profile.data.composeFullName
import com.neph.features.profile.data.expertiseOptionsFor
import com.neph.features.profile.data.locationData
import com.neph.features.profile.data.normalizeDateOfBirth
import com.neph.features.profile.data.normalizePhoneParts
import com.neph.features.profile.data.parseListField
import com.neph.features.profile.data.sanitizeDecimalInput
import com.neph.features.profile.data.splitFullName
import com.neph.features.profile.data.toEditableString
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.features.profile.presentation.components.GenderSelector
import com.neph.features.profile.presentation.components.LocationSelector
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SaveActionBar
import com.neph.ui.components.inputs.AppDropdown
import com.neph.ui.components.inputs.AppTextArea
import com.neph.ui.components.inputs.AppTextField
import com.neph.ui.components.selection.AppCheckbox
import com.neph.ui.layout.AuthScaffold
import com.neph.ui.location.rememberForegroundLocationPermissionRequester
import com.neph.ui.map.MapPickerDialog
import com.neph.ui.map.MapPickerSelection
import com.neph.ui.map.LocationSelectionMapAction
import com.neph.ui.map.residentialMapPickerFeedbackMessage
import com.neph.ui.map.resolveMapPickerLocationUpdate
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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
    val existingNameParts = remember(existingProfile.firstName, existingProfile.lastName, existingProfile.fullName) {
        val first = existingProfile.firstName?.trim().orEmpty()
        val last = existingProfile.lastName?.trim().orEmpty()
        if (first.isNotBlank() || last.isNotBlank()) {
            first to last
        } else {
            splitFullName(existingProfile.fullName.orEmpty())
        }
    }

    var firstName by rememberSaveable { mutableStateOf(existingNameParts.first) }
    var lastName by rememberSaveable { mutableStateOf(existingNameParts.second) }
    var countryCode by rememberSaveable { mutableStateOf(existingPhoneParts.countryCode) }
    var phone by rememberSaveable { mutableStateOf(existingPhoneParts.phone) }
    var gender by rememberSaveable { mutableStateOf(existingProfile.gender.orEmpty()) }
    var height by rememberSaveable { mutableStateOf(existingProfile.height.toEditableString()) }
    var weight by rememberSaveable { mutableStateOf(existingProfile.weight.toEditableString()) }
    var dateOfBirth by rememberSaveable { mutableStateOf(existingProfile.dateOfBirth.orEmpty()) }
    var bloodType by rememberSaveable { mutableStateOf(existingProfile.bloodType.orEmpty()) }
    var medicalHistory by rememberSaveable { mutableStateOf(existingProfile.medicalHistory.orEmpty()) }
    var chronicDiseases by rememberSaveable { mutableStateOf(existingProfile.chronicDiseases.orEmpty()) }
    var allergies by rememberSaveable { mutableStateOf(existingProfile.allergies.orEmpty()) }
    var country by rememberSaveable { mutableStateOf(existingProfile.country.orEmpty()) }
    var city by rememberSaveable { mutableStateOf(existingProfile.city.orEmpty()) }
    var district by rememberSaveable { mutableStateOf(existingProfile.district.orEmpty()) }
    var neighborhood by rememberSaveable { mutableStateOf(existingProfile.neighborhood.orEmpty()) }
    var extraAddress by rememberSaveable { mutableStateOf(existingProfile.extraAddress.orEmpty()) }
    var expertise by rememberSaveable { mutableStateOf(existingProfile.expertise) }
    var loading by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf("") }
    var info by rememberSaveable { mutableStateOf("") }
    var mapActionInfo by rememberSaveable { mutableStateOf("") }
    var mapPickerOpen by rememberSaveable { mutableStateOf(false) }
    var mapPickerLoading by rememberSaveable { mutableStateOf(false) }
    var mapCenterLoading by rememberSaveable { mutableStateOf(false) }
    var mapCenterInfo by rememberSaveable { mutableStateOf("") }
    var mapCenterLatitude by rememberSaveable { mutableStateOf<Double?>(null) }
    var mapCenterLongitude by rememberSaveable { mutableStateOf<Double?>(null) }
    var mapPickerSelection by remember { mutableStateOf<MapPickerSelection?>(null) }
    var availableLocationData by remember { mutableStateOf<LocationData>(locationData) }
    var locationLoading by remember { mutableStateOf(true) }
    var locationInfo by rememberSaveable { mutableStateOf("") }

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

    fun handleMapSelection(selection: MapPickerSelection) {
        if (mapPickerLoading) return

        mapPickerLoading = true
        mapActionInfo = ""

        scope.launch {
            try {
                val reverseLocation = RequestHelpRepository.reverseGeocodeCurrentLocation(
                    latitude = selection.latitude,
                    longitude = selection.longitude
                )
                val update = resolveMapPickerLocationUpdate(
                    currentCountry = country,
                    currentCity = city,
                    currentDistrict = district,
                    currentNeighborhood = neighborhood,
                    currentExtraAddress = extraAddress,
                    reverseLocation = reverseLocation,
                    locations = availableLocationData
                )

                country = update.country
                city = update.city
                district = update.district
                neighborhood = update.neighborhood
                extraAddress = update.extraAddress
                mapActionInfo = residentialMapPickerFeedbackMessage(reverseLocation, update)
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                mapActionInfo = "Could not resolve the selected point. You can still enter the address manually."
            } finally {
                mapPickerSelection = selection
                mapPickerLoading = false
                mapPickerOpen = false
            }
        }
    }

    fun openProfileMapPickerWithFallback(message: String) {
        mapCenterLatitude = null
        mapCenterLongitude = null
        mapCenterInfo = message
        mapCenterLoading = false
        mapPickerOpen = true
    }

    fun captureCurrentLocationForProfileMap(fromPermissionResult: Boolean = false) {
        if (mapCenterLoading && !fromPermissionResult) return

        mapCenterLoading = true
        mapCenterInfo = ""

        scope.launch {
            try {
                val attempt = DeviceLocationProvider.captureCurrentLocationForSharing(
                    context = context,
                    sharingEnabled = true
                )
                val location = attempt.location
                if (location == null) {
                    val fallbackMessage = when (attempt.warning) {
                        CurrentLocationShareWarning.PERMISSION_DENIED ->
                            "Location permission was denied. You can still choose your home location manually."

                        CurrentLocationShareWarning.LOCATION_UNAVAILABLE,
                        null -> "Current location is unavailable. You can still choose your home location manually."
                    }
                    openProfileMapPickerWithFallback(fallbackMessage)
                    return@launch
                }

                mapCenterLatitude = location.latitude
                mapCenterLongitude = location.longitude
                mapCenterInfo = "Map opened near your device location. Please verify the selected home location."
                mapPickerOpen = true
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                openProfileMapPickerWithFallback(
                    "Current location is unavailable. You can still choose your home location manually."
                )
            } finally {
                mapCenterLoading = false
            }
        }
    }

    val mapLocationPermissionRequester = rememberForegroundLocationPermissionRequester { result ->
        if (result.granted) {
            captureCurrentLocationForProfileMap(fromPermissionResult = true)
        } else {
            openProfileMapPickerWithFallback(
                "Location permission was denied. You can still choose your home location manually."
            )
        }
    }

    fun prepareAndOpenProfileMapPicker() {
        if (mapCenterLoading) return

        mapActionInfo = ""
        mapCenterLatitude = null
        mapCenterLongitude = null
        mapCenterInfo = ""

        if (mapLocationPermissionRequester.refreshPermissionState()) {
            captureCurrentLocationForProfileMap()
        } else {
            mapCenterLoading = true
            mapLocationPermissionRequester.requestPermission()
        }
    }

    fun handleSave() {
        error = ""
        info = ""
        mapActionInfo = ""

        val normalizedFirstName = firstName.trim()
        val normalizedLastName = lastName.trim()
        val normalizedPhone = phone.trim()
        val normalizedDateOfBirth = normalizeDateOfBirth(dateOfBirth)
        val todayIso = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

        if (normalizedFirstName.isBlank() || normalizedLastName.isBlank()) {
            error = "Please enter both first and last name."
            return
        }

        if (normalizedDateOfBirth == null || normalizedDateOfBirth > todayIso) {
            error = "Please enter a valid date of birth in YYYY-MM-DD format."
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

        if (height.isBlank() || weight.isBlank() ||
            country.isBlank() || city.isBlank() || district.isBlank() || neighborhood.isBlank()
        ) {
            error = "Please fill in all required fields."
            return
        }

        val heightFloat = height.toFloatOrNull()
        val weightFloat = weight.toFloatOrNull()
        val ageInt = calculateAgeFromDateOfBirth(normalizedDateOfBirth)
        if (heightFloat == null || weightFloat == null || heightFloat <= 0f || weightFloat <= 0f) {
            error = "Height and weight must be valid positive numbers."
            return
        }

        if (ageInt == null) {
            error = "Please enter a valid date of birth in YYYY-MM-DD format."
            return
        }

        loading = true
        scope.launch {
            try {
                val profileToSync = ProfileRepository.getProfile().copy(
                    firstName = normalizedFirstName,
                    lastName = normalizedLastName,
                    fullName = composeFullName(normalizedFirstName, normalizedLastName),
                    phone = combinePhoneNumber(countryCode, normalizedPhone),
                    gender = gender.takeIf(String::isNotBlank),
                    height = heightFloat,
                    weight = weightFloat,
                    dateOfBirth = normalizedDateOfBirth,
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
                    expertise = parseListField(expertise.joinToString(", "))
                )
                ProfileRepository.syncProfile(
                    profile = profileToSync
                )
                val completionMessage = "Profile saved."

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
            Row(horizontalArrangement = Arrangement.spacedBy(spacing.sm)) {
                AppTextField(
                    value = firstName,
                    onValueChange = { firstName = it },
                    label = "First Name",
                    testTag = "complete_profile_first_name",
                    placeholder = "Enter your first name",
                    modifier = Modifier.weight(1f)
                )

                AppTextField(
                    value = lastName,
                    onValueChange = { lastName = it },
                    label = "Last Name",
                    testTag = "complete_profile_last_name",
                    placeholder = "Enter your last name",
                    modifier = Modifier.weight(1f)
                )
            }

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
                value = dateOfBirth,
                onValueChange = { dateOfBirth = it },
                label = "Date of Birth",
                testTag = "complete_profile_date_of_birth",
                placeholder = "YYYY-MM-DD",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
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
                label = "Medical History (optional - comma-separated)"
            )

            AppTextArea(
                value = chronicDiseases,
                onValueChange = { chronicDiseases = it },
                label = "Chronic Diseases (optional - comma-separated)"
            )

            AppTextArea(
                value = allergies,
                onValueChange = { allergies = it },
                label = "Allergies (optional - comma-separated)"
            )

            Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
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

            Text("Residential Location", style = MaterialTheme.typography.titleMedium)

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

            SecondaryButton(
                text = "Select Home Location on Map",
                onClick = ::prepareAndOpenProfileMapPicker,
                enabled = !locationLoading && !loading && !mapCenterLoading
            )

            AppTextField(
                value = extraAddress,
                onValueChange = { extraAddress = it },
                label = "Extra Address",
                testTag = "complete_profile_extra_address"
            )

            LocationSelectionMapAction(
                countryKeyOrLabel = country,
                cityKeyOrLabel = city,
                districtKeyOrLabel = district,
                neighborhoodValueOrLabel = neighborhood,
                extraAddress = extraAddress,
                locations = availableLocationData,
                enabled = !loading,
                onOpenFailure = { mapActionInfo = it },
                onOpenSuccess = { mapActionInfo = "" }
            )

            if (mapPickerOpen) {
                MapPickerDialog(
                    title = "Select Home Location on Map",
                    initialLatitude = mapPickerSelection?.latitude,
                    initialLongitude = mapPickerSelection?.longitude,
                    centerLatitude = mapCenterLatitude,
                    centerLongitude = mapCenterLongitude,
                    centerActionLoading = mapCenterLoading,
                    centerActionMessage = mapCenterInfo,
                    loading = mapPickerLoading,
                    onDismiss = { if (!mapPickerLoading) mapPickerOpen = false },
                    onConfirm = ::handleMapSelection
                )
            }

            if (error.isNotBlank()) {
                Text(error, color = MaterialTheme.colorScheme.error)
            }

            if (info.isNotBlank()) {
                HelperText(text = info)
            }

            if (mapActionInfo.isNotBlank()) {
                HelperText(text = mapActionInfo)
            }

            SaveActionBar(onSave = ::handleSave, loading = loading)
        }
    }
}
