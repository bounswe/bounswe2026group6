package com.neph.features.profile.presentation

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
import com.neph.features.profile.data.calculateAgeFromDateOfBirth
import com.neph.features.profile.data.combinePhoneNumber
import com.neph.features.profile.data.composeFullName
import com.neph.features.profile.data.expertiseOptionsFor
import com.neph.features.profile.data.locationData
import com.neph.features.profile.data.normalizeDateOfBirth
import com.neph.features.profile.data.normalizePhoneParts
import com.neph.features.profile.data.parseListField
import com.neph.features.profile.data.professionOptionsFor
import com.neph.features.profile.data.sanitizeDecimalInput
import com.neph.features.profile.data.toEditableString
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.features.profile.presentation.components.GenderSelector
import com.neph.features.profile.presentation.components.LocationSelector
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.components.inputs.AppDropdown
import com.neph.ui.components.inputs.AppTextArea
import com.neph.ui.components.inputs.AppTextField
import com.neph.ui.components.inputs.DateInput
import com.neph.ui.components.selection.AppCheckbox
import com.neph.ui.layout.AppScaffold
import com.neph.ui.location.rememberForegroundLocationPermissionRequester
import com.neph.ui.map.MapPickerDialog
import com.neph.ui.map.MapPickerSelection
import com.neph.ui.map.LocationSelectionMapAction
import com.neph.ui.map.resolveMapPickerLocationUpdate
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun EditProfileScreen(
    onSave: (ProfileData) -> Unit,
    onNavigateBack: () -> Unit
) {
    var profile by remember { mutableStateOf(ProfileRepository.getProfile()) }
    val initialFirstName = remember(profile.firstName, profile.fullName) {
        profile.firstName?.trim().orEmpty().ifBlank {
            profile.fullName.orEmpty().trim().split(Regex("\\s+")).firstOrNull().orEmpty()
        }
    }
    val initialLastName = remember(profile.lastName, profile.fullName) {
        profile.lastName?.trim().orEmpty().ifBlank {
            val parts = profile.fullName.orEmpty().trim().split(Regex("\\s+")).filter { it.isNotBlank() }
            parts.drop(1).joinToString(" ")
        }
    }
    val initialPhoneParts = remember { normalizePhoneParts(profile.phone) }

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

    var countryCode by rememberSaveable { mutableStateOf(initialPhoneParts.countryCode) }
    var phone by rememberSaveable { mutableStateOf(initialPhoneParts.phone) }
    var firstNameText by rememberSaveable { mutableStateOf(initialFirstName) }
    var lastNameText by rememberSaveable { mutableStateOf(initialLastName) }
    var heightText by rememberSaveable { mutableStateOf(profile.height.toEditableString()) }
    var weightText by rememberSaveable { mutableStateOf(profile.weight.toEditableString()) }
    var dateOfBirthText by rememberSaveable { mutableStateOf(profile.dateOfBirth.orEmpty()) }
    var availableLocationData by remember { mutableStateOf<LocationData>(locationData) }
    var locationLoading by remember { mutableStateOf(true) }
    var locationInfo by rememberSaveable { mutableStateOf("") }

    val scope = rememberCoroutineScope()
    val spacing = LocalNephSpacing.current
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        try {
            profile = ProfileRepository.fetchAndCacheRemoteProfile()
            val phoneParts = normalizePhoneParts(profile.phone)
            countryCode = phoneParts.countryCode
            phone = phoneParts.phone
            firstNameText = profile.firstName.orEmpty()
            lastNameText = profile.lastName.orEmpty()
            heightText = profile.height.toEditableString()
            weightText = profile.weight.toEditableString()
            dateOfBirthText = profile.dateOfBirth.orEmpty()
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (_: ApiException) {
            profile = ProfileRepository.getProfile()
            val phoneParts = normalizePhoneParts(profile.phone)
            countryCode = phoneParts.countryCode
            phone = phoneParts.phone
            firstNameText = profile.firstName.orEmpty()
            lastNameText = profile.lastName.orEmpty()
            heightText = profile.height.toEditableString()
            weightText = profile.weight.toEditableString()
            dateOfBirthText = profile.dateOfBirth.orEmpty()
        } catch (_: Exception) {
            profile = ProfileRepository.getProfile()
            val phoneParts = normalizePhoneParts(profile.phone)
            countryCode = phoneParts.countryCode
            phone = phoneParts.phone
            firstNameText = profile.firstName.orEmpty()
            lastNameText = profile.lastName.orEmpty()
            heightText = profile.height.toEditableString()
            weightText = profile.weight.toEditableString()
            dateOfBirthText = profile.dateOfBirth.orEmpty()
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
                    currentCountry = profile.country.orEmpty(),
                    currentCity = profile.city.orEmpty(),
                    currentDistrict = profile.district.orEmpty(),
                    currentNeighborhood = profile.neighborhood.orEmpty(),
                    currentExtraAddress = profile.extraAddress.orEmpty(),
                    reverseLocation = reverseLocation,
                    locations = availableLocationData
                )

                profile = profile.copy(
                    country = update.country,
                    city = update.city,
                    district = update.district,
                    neighborhood = update.neighborhood,
                    extraAddress = update.extraAddress
                )
                mapActionInfo = when {
                    reverseLocation == null ->
                        "Could not resolve selected coordinates. You can continue with manual location entry."
                    update.isMeaningfulMapping ->
                        "Selected location applied."
                    else ->
                        "Selected coordinates were detected. Please verify the location fields manually."
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                mapActionInfo = "Could not resolve selected coordinates. You can continue with manual location entry."
            } finally {
                mapPickerSelection = selection
                mapPickerLoading = false
                mapPickerOpen = false
            }
        }
    }

    fun centerProfileMapOnCurrentLocation() {
        if (mapCenterLoading) return

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
                    mapCenterInfo = when (attempt.warning) {
                        CurrentLocationShareWarning.PERMISSION_DENIED ->
                            "Location permission is denied. The map was not centered."

                        CurrentLocationShareWarning.LOCATION_UNAVAILABLE,
                        null -> "Current location is unavailable. The map was not centered."
                    }
                    return@launch
                }

                mapCenterLatitude = location.latitude
                mapCenterLongitude = location.longitude
                mapCenterInfo = "Map centered on your current location. Choose a point to update your residential location."
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                mapCenterInfo = "Current location is unavailable. The map was not centered."
            } finally {
                mapCenterLoading = false
            }
        }
    }

    val mapLocationPermissionRequester = rememberForegroundLocationPermissionRequester { result ->
        if (result.granted) {
            centerProfileMapOnCurrentLocation()
        } else {
            mapCenterInfo = "Location permission is denied. The map was not centered."
        }
    }

    fun handleSave() {
        error = ""
        info = ""
        mapActionInfo = ""

        val normalizedFirstName = firstNameText.trim()
        val normalizedLastName = lastNameText.trim()
        val normalizedDateOfBirth = normalizeDateOfBirth(dateOfBirthText)
        val todayIso = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

        if (normalizedFirstName.isBlank() || normalizedLastName.isBlank()) {
            error = "Please enter both first and last name."
            return
        }

        if (normalizedDateOfBirth == null || normalizedDateOfBirth > todayIso) {
            error = "Please enter a valid date of birth in YYYY-MM-DD format."
            return
        }

        if (phone.isBlank()) {
            error = "Please enter your phone number."
            return
        }

        val heightFloat = heightText.toFloatOrNull()
        val weightFloat = weightText.toFloatOrNull()
        val ageInt = calculateAgeFromDateOfBirth(normalizedDateOfBirth)
        if (heightFloat == null || heightFloat <= 0f || weightFloat == null || weightFloat <= 0f) {
            error = "Height and weight must be valid positive numbers."
            return
        }

        if (ageInt == null) {
            error = "Please enter a valid date of birth in YYYY-MM-DD format."
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
                    firstName = normalizedFirstName,
                    lastName = normalizedLastName,
                    fullName = composeFullName(normalizedFirstName, normalizedLastName),
                    phone = combinePhoneNumber(countryCode, phone),
                    height = heightFloat,
                    weight = weightFloat,
                    dateOfBirth = normalizedDateOfBirth,
                    age = ageInt
                )
                profile = ProfileRepository.syncProfile(
                    profile = profileToSync
                )

                val phoneParts = normalizePhoneParts(profile.phone)
                countryCode = phoneParts.countryCode
                phone = phoneParts.phone
                firstNameText = profile.firstName.orEmpty()
                lastNameText = profile.lastName.orEmpty()
                heightText = profile.height.toEditableString()
                weightText = profile.weight.toEditableString()
                dateOfBirthText = profile.dateOfBirth.orEmpty()
                info = "Profile updated successfully."
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

                    Row(horizontalArrangement = Arrangement.spacedBy(spacing.sm)) {
                        AppTextField(
                            value = firstNameText,
                            onValueChange = { firstNameText = it },
                            label = "First Name",
                            modifier = Modifier.weight(1f)
                        )

                        AppTextField(
                            value = lastNameText,
                            onValueChange = { lastNameText = it },
                            label = "Last Name",
                            modifier = Modifier.weight(1f)
                        )
                    }

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

                    DateInput(
                        value = dateOfBirthText,
                        onValueChange = { dateOfBirthText = it },
                        label = "Date of Birth"
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
                    SectionHeader(
                        title = "Residential Location",
                        subtitle = "This is your home/neighborhood location. It is not automatically updated by GPS."
                    )

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

                    SecondaryButton(
                        text = "Select Home Location on Map",
                        onClick = { mapPickerOpen = true },
                        enabled = !locationLoading && !loading
                    )

                    AppTextField(
                        value = profile.extraAddress.orEmpty(),
                        onValueChange = { profile = profile.copy(extraAddress = it) },
                        label = "Extra Address"
                    )

                    LocationSelectionMapAction(
                        countryKeyOrLabel = profile.country,
                        cityKeyOrLabel = profile.city,
                        districtKeyOrLabel = profile.district,
                        neighborhoodValueOrLabel = profile.neighborhood,
                        extraAddress = profile.extraAddress,
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
                            showCenterOnCurrentLocation = true,
                            centerActionLoading = mapCenterLoading,
                            centerActionMessage = mapCenterInfo,
                            loading = mapPickerLoading,
                            onDismiss = { if (!mapPickerLoading) mapPickerOpen = false },
                            onConfirm = ::handleMapSelection,
                            onCenterOnCurrentLocation = {
                                if (mapLocationPermissionRequester.refreshPermissionState()) {
                                    centerProfileMapOnCurrentLocation()
                                } else {
                                    mapLocationPermissionRequester.requestPermission()
                                }
                            }
                        )
                    }
                }
            }

            if (error.isNotBlank()) {
                HelperText(text = error)
            }

            if (info.isNotBlank()) {
                HelperText(text = info)
            }

            if (mapActionInfo.isNotBlank()) {
                HelperText(text = mapActionInfo)
            }

            PrimaryButton(
                text = "Save Changes",
                onClick = ::handleSave,
                loading = loading
            )
        }
    }
}
