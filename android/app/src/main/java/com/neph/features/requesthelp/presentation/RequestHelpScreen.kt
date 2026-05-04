package com.neph.features.requesthelp.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.neph.core.network.ApiException
import com.neph.core.database.HelpRequestEntity
import com.neph.core.sync.LocalOwnerType
import com.neph.core.sync.SyncStatus
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.auth.util.countryCodeOptions
import com.neph.features.profile.data.CurrentLocationShareWarning
import com.neph.features.profile.data.DeviceLocationProvider
import com.neph.features.profile.data.findCityKeyByLabel
import com.neph.features.profile.data.findCountryKeyByLabel
import com.neph.features.profile.data.findDistrictKeyByLabel
import com.neph.features.profile.data.findNeighborhoodValueByLabel
import com.neph.features.profile.data.LocationData
import com.neph.features.profile.data.LocationTreeRepository
import com.neph.features.profile.data.ProfileData
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.profile.data.PhoneParts
import com.neph.features.profile.data.bloodTypeOptions
import com.neph.features.profile.data.locationData
import com.neph.features.profile.data.normalizeBloodType
import com.neph.features.profile.data.normalizePhoneParts
import com.neph.features.requesthelp.data.RequestHelpContactSubmission
import com.neph.features.requesthelp.data.RequestHelpLocationSubmission
import com.neph.features.profile.presentation.components.LocationSelector
import com.neph.features.requesthelp.data.RequestHelpReverseLocation
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.features.requesthelp.data.RequestHelpSubmission
import com.neph.features.requesthelp.data.jsonArrayToStringList
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.components.inputs.AppDropdown
import com.neph.ui.components.inputs.AppTextArea
import com.neph.ui.components.inputs.AppTextField
import com.neph.ui.components.selection.AppCheckbox
import com.neph.ui.components.selection.AppMultiSelectChipGroup
import com.neph.ui.layout.AppScaffold
import com.neph.ui.location.rememberForegroundLocationPermissionRequester
import com.neph.ui.map.MapPickerDialog
import com.neph.ui.map.MapPickerSelection
import com.neph.ui.map.LocationSelectionMapAction
import com.neph.ui.map.formatMapCoordinate
import com.neph.ui.map.resolveMapPickerLocationUpdate
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

private val helpTypeOptions = listOf(
    "First Aid",
    "Search & Rescue",
    "Fire Brigade",
    "Evacuation / Transport",
    "Food & Water",
    "Shelter",
    "Security Support",
    "Other"
)

private val riskFlagOptions = listOf(
    "Fire",
    "Gas Leak",
    "Collapse Risk",
    "Flooding",
    "Electric Hazard",
    "Blocked Access / Debris"
)

private val vulnerableGroupOptions = listOf(
    "Children",
    "Elderly",
    "Disabled",
    "Pregnant",
    "Chronic Condition"
)

private data class RequestHelpFormState(
    val helpTypes: List<String> = emptyList(),
    val otherHelpType: String = "",
    val affectedPeopleCount: String = "",
    val riskFlags: List<String> = emptyList(),
    val vulnerableGroups: List<String> = emptyList(),
    val situationDescription: String = "",
    val bloodType: String = "",
    val country: String = "",
    val city: String = "",
    val district: String = "",
    val neighborhood: String = "",
    val shortAddress: String = "",
    val fullName: String = "",
    val countryCode: String = "+90",
    val phoneNumber: String = "",
    val alternativePhone: String = "",
    val confirmationAccepted: Boolean = false
)

private data class RequestHelpFieldErrors(
    val helpTypes: String? = null,
    val affectedPeopleCount: String? = null,
    val situationDescription: String? = null,
    val country: String? = null,
    val city: String? = null,
    val district: String? = null,
    val neighborhood: String? = null,
    val shortAddress: String? = null,
    val fullName: String? = null,
    val phoneNumber: String? = null,
    val alternativePhone: String? = null,
    val confirmationAccepted: String? = null
)

private val helpTypeApiValues = mapOf(
    "First Aid" to "first_aid",
    "Search & Rescue" to "search_rescue",
    "Fire Brigade" to "fire_brigade",
    "Evacuation / Transport" to "evacuation_transport",
    "Food & Water" to "food_water",
    "Shelter" to "shelter",
    "Security Support" to "security_support",
    "Other" to "other"
)

private val helpTypeLabelsByApiValue = helpTypeApiValues.entries.associate { (label, value) -> value to label }

private fun parseBackendPhoneNumber(countryCode: String, phone: String): Long? {
    if (countryCode != "+90") {
        return null
    }

    val normalizedPhone = phone.filter(Char::isDigit).trimStart('0')
    if (normalizedPhone.length != 10 || normalizedPhone.firstOrNull() != '5') {
        return null
    }

    return normalizedPhone.toLongOrNull()
}

private fun buildPrefilledForm(profile: ProfileData): RequestHelpFormState {
    val phoneParts: PhoneParts = normalizePhoneParts(profile.phone)
    val normalizedBloodType = normalizeBloodType(profile.bloodType).orEmpty()

    return RequestHelpFormState(
        bloodType = normalizedBloodType,
        country = profile.country.orEmpty(),
        city = profile.city.orEmpty(),
        district = profile.district.orEmpty(),
        neighborhood = profile.neighborhood.orEmpty(),
        shortAddress = profile.extraAddress.orEmpty(),
        fullName = profile.fullName.orEmpty(),
        countryCode = phoneParts.countryCode,
        phoneNumber = phoneParts.phone
    )
}

private fun HelpRequestEntity.toFormState(): RequestHelpFormState {
    val phoneParts = normalizePhoneParts(contactPhone)
    return RequestHelpFormState(
        helpTypes = helpTypesJson.jsonArrayToStringList().mapNotNull { helpTypeLabelsByApiValue[it] },
        otherHelpType = otherHelpText,
        affectedPeopleCount = affectedPeopleCount.toString(),
        riskFlags = riskFlagsJson.jsonArrayToStringList(),
        vulnerableGroups = vulnerableGroupsJson.jsonArrayToStringList(),
        situationDescription = description,
        bloodType = bloodType,
        country = country,
        city = city,
        district = district,
        neighborhood = neighborhood,
        shortAddress = extraAddress,
        fullName = contactFullName,
        countryCode = phoneParts.countryCode,
        phoneNumber = phoneParts.phone,
        alternativePhone = contactAlternativePhone.orEmpty(),
        confirmationAccepted = true
    )
}

private fun toggleSelection(current: List<String>, option: String): List<String> {
    return if (option in current) {
        current - option
    } else {
        current + option
    }
}

private fun findCountryLabel(countryKey: String, locations: LocationData): String =
    locations[countryKey]?.label.orEmpty()

private fun findCityLabel(countryKey: String, cityKey: String, locations: LocationData): String =
    locations[countryKey]?.cities?.get(cityKey)?.label.orEmpty()

private fun findDistrictLabel(
    countryKey: String,
    cityKey: String,
    districtKey: String,
    locations: LocationData
): String =
    locations[countryKey]?.cities?.get(cityKey)?.districts?.get(districtKey)?.label.orEmpty()

private fun findNeighborhoodLabel(
    countryKey: String,
    cityKey: String,
    districtKey: String,
    neighborhoodKey: String,
    locations: LocationData
): String =
    locations[countryKey]
        ?.cities
        ?.get(cityKey)
        ?.districts
        ?.get(districtKey)
        ?.neighborhoods
        ?.firstOrNull { it.value == neighborhoodKey }
        ?.label
        .orEmpty()

private fun validateForm(state: RequestHelpFormState): RequestHelpFieldErrors {
    val affectedPeople = state.affectedPeopleCount.toIntOrNull()

    return RequestHelpFieldErrors(
        helpTypes = if (state.helpTypes.isEmpty()) "Select at least one help type." else null,
        affectedPeopleCount = when {
            state.affectedPeopleCount.isBlank() -> "Affected people count is required."
            affectedPeople == null || affectedPeople < 1 -> "Enter a valid number greater than or equal to 1."
            else -> null
        },
        situationDescription = if (state.situationDescription.isBlank()) {
            "Situation description cannot be blank."
        } else {
            null
        },
        country = if (state.country.isBlank()) "Country is required." else null,
        city = if (state.city.isBlank()) "City is required." else null,
        district = if (state.district.isBlank()) "District is required." else null,
        neighborhood = if (state.neighborhood.isBlank()) "Neighborhood is required." else null,
        shortAddress = if (state.shortAddress.isBlank()) "Short address is required." else null,
        fullName = if (state.fullName.isBlank()) "Full name cannot be blank." else null,
        phoneNumber = when {
            state.phoneNumber.isBlank() -> "Phone number cannot be blank."
            parseBackendPhoneNumber(state.countryCode, state.phoneNumber) == null ->
                "Use a valid Turkish mobile number starting with 5."
            else -> null
        },
        alternativePhone = when {
            state.alternativePhone.isBlank() -> null
            parseBackendPhoneNumber(state.countryCode, state.alternativePhone) == null ->
                "Use a valid Turkish mobile number starting with 5."
            else -> null
        },
        confirmationAccepted = if (!state.confirmationAccepted) {
            "You must confirm information sharing before sending."
        } else {
            null
        }
    )
}

private fun RequestHelpFieldErrors.hasAny(): Boolean {
    return listOf(
        helpTypes,
        affectedPeopleCount,
        situationDescription,
        country,
        city,
        district,
        neighborhood,
        shortAddress,
        fullName,
        phoneNumber,
        alternativePhone,
        confirmationAccepted
    ).any { !it.isNullOrBlank() }
}

private fun buildSubmission(
    state: RequestHelpFormState,
    locations: LocationData
): RequestHelpSubmission {
    val primaryPhone = requireNotNull(parseBackendPhoneNumber(state.countryCode, state.phoneNumber))
    val alternativePhone = state.alternativePhone
        .takeIf { it.isNotBlank() }
        ?.let { requireNotNull(parseBackendPhoneNumber(state.countryCode, it)) }

    return RequestHelpSubmission(
        helpTypes = state.helpTypes.mapNotNull { helpTypeApiValues[it] },
        otherHelpText = state.otherHelpType.trim(),
        affectedPeopleCount = state.affectedPeopleCount.toInt(),
        description = state.situationDescription.trim(),
        riskFlags = state.riskFlags.map { it.trim() },
        vulnerableGroups = state.vulnerableGroups.map { it.trim() },
        bloodType = state.bloodType.trim(),
        location = RequestHelpLocationSubmission(
            country = findCountryLabel(state.country, locations).ifBlank { state.country.trim() },
            city = findCityLabel(state.country, state.city, locations).ifBlank { state.city.trim() },
            district = findDistrictLabel(state.country, state.city, state.district, locations)
                .ifBlank { state.district.trim() },
            neighborhood = findNeighborhoodLabel(
                state.country,
                state.city,
                state.district,
                state.neighborhood,
                locations
            ).ifBlank { state.neighborhood.trim() },
            extraAddress = state.shortAddress.trim()
        ),
        contact = RequestHelpContactSubmission(
            fullName = state.fullName.trim(),
            phone = primaryPhone,
            alternativePhone = alternativePhone
        ),
        consentGiven = state.confirmationAccepted
    )
}

internal data class GuestLocationAutofillSelection(
    val country: String,
    val city: String,
    val district: String,
    val neighborhood: String,
    val shortAddress: String
)

internal fun resolveGuestLocationAutofillSelection(
    currentCountry: String,
    currentCity: String,
    currentDistrict: String,
    currentNeighborhood: String,
    currentShortAddress: String,
    reverseLocation: RequestHelpReverseLocation,
    locations: LocationData
): GuestLocationAutofillSelection {
    val countryFromCode = reverseLocation.countryCode
        ?.lowercase()
        ?.takeIf { locations.containsKey(it) }
        .orEmpty()
    val countryFromLabel = findCountryKeyByLabel(reverseLocation.country, locations)
    val mappedCountry = countryFromCode.ifBlank { countryFromLabel }
    val country = currentCountry.ifBlank { mappedCountry }

    val mappedCity = if (country.isNotBlank()) {
        findCityKeyByLabel(country, reverseLocation.city, locations)
    } else {
        ""
    }
    val city = currentCity.ifBlank { mappedCity }

    val mappedDistrict = if (country.isNotBlank() && city.isNotBlank()) {
        findDistrictKeyByLabel(country, city, reverseLocation.district, locations)
    } else {
        ""
    }
    val district = currentDistrict.ifBlank { mappedDistrict }

    val mappedNeighborhood = if (country.isNotBlank() && city.isNotBlank() && district.isNotBlank()) {
        findNeighborhoodValueByLabel(
            country,
            city,
            district,
            reverseLocation.neighborhood,
            locations
        )
    } else {
        ""
    }
    val neighborhood = currentNeighborhood.ifBlank { mappedNeighborhood }

    val shortAddress = currentShortAddress.ifBlank {
        reverseLocation.extraAddress
            ?.takeIf { it.isNotBlank() }
            .orEmpty()
    }

    return GuestLocationAutofillSelection(
        country = country,
        city = city,
        district = district,
        neighborhood = neighborhood,
        shortAddress = shortAddress
    )
}

@Composable
fun RequestHelpScreen(
    draftLocalId: String? = null,
    onNavigateBack: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateToMyHelpRequests: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val sessionToken = AuthSessionStore.getAccessToken().orEmpty()
    val isLoggedIn = sessionToken.isNotBlank()
    var activeDraftLocalId by rememberSaveable { mutableStateOf(draftLocalId.orEmpty()) }
    val observedDraft by activeDraftLocalId
        .takeIf { it.isNotBlank() }
        ?.let { RequestHelpRepository.observeLocalHelpRequest(it).collectAsState(initial = null) }
        ?: remember { mutableStateOf<HelpRequestEntity?>(null) }

    var formState by remember {
        mutableStateOf(
            if (isLoggedIn) buildPrefilledForm(ProfileRepository.getProfile()) else RequestHelpFormState()
        )
    }
    var fieldErrors by remember { mutableStateOf(RequestHelpFieldErrors()) }
    var availableLocationData by remember { mutableStateOf<LocationData>(locationData) }
    var locationLoading by remember { mutableStateOf(true) }
    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }
    var infoMessage by remember { mutableStateOf("") }
    var mapActionMessage by rememberSaveable { mutableStateOf("") }
    var mapPickerOpen by rememberSaveable { mutableStateOf(false) }
    var mapPickerLoading by rememberSaveable { mutableStateOf(false) }
    var mapPickerSelection by remember { mutableStateOf<MapPickerSelection?>(null) }
    var checkingActiveRequest by remember { mutableStateOf(isLoggedIn) }
    var currentLocationLoading by remember { mutableStateOf(false) }

    LaunchedEffect(draftLocalId) {
        val nextDraftLocalId = draftLocalId.orEmpty()
        if (nextDraftLocalId != activeDraftLocalId) {
            activeDraftLocalId = nextDraftLocalId
            fieldErrors = RequestHelpFieldErrors()
            errorMessage = ""
            infoMessage = ""
            mapActionMessage = ""
            checkingActiveRequest = isLoggedIn || nextDraftLocalId.isNotBlank()
        }
    }

    fun applyCurrentLocationToForm() {
        scope.launch {
            if (currentLocationLoading) return@launch
            currentLocationLoading = true
            try {
                val attempt = DeviceLocationProvider.captureCurrentLocationForSharing(
                    context = context,
                    sharingEnabled = true
                )
                val location = attempt.location
                if (location == null) {
                    infoMessage = when (attempt.warning) {
                        CurrentLocationShareWarning.PERMISSION_DENIED ->
                            "Location permission is denied. You can continue with manual location entry."

                        CurrentLocationShareWarning.LOCATION_UNAVAILABLE,
                        null -> "Could not retrieve your current location. You can continue with manual location entry."
                    }
                    return@launch
                }

                val reverseLocation = RequestHelpRepository.reverseGeocodeCurrentLocation(
                    latitude = location.latitude,
                    longitude = location.longitude
                )
                if (reverseLocation == null) {
                    infoMessage = "Could not resolve your current location. You can continue with manual location entry."
                    return@launch
                }

                val previousFormState = formState
                val autofill = resolveGuestLocationAutofillSelection(
                    currentCountry = previousFormState.country,
                    currentCity = previousFormState.city,
                    currentDistrict = previousFormState.district,
                    currentNeighborhood = previousFormState.neighborhood,
                    currentShortAddress = previousFormState.shortAddress,
                    reverseLocation = reverseLocation,
                    locations = availableLocationData
                )

                val nextFormState = previousFormState.copy(
                    country = autofill.country,
                    city = autofill.city,
                    district = autofill.district,
                    neighborhood = autofill.neighborhood,
                    shortAddress = autofill.shortAddress
                )
                if (nextFormState != previousFormState) {
                    formState = nextFormState
                    infoMessage = "Current location applied without changing non-empty fields."
                } else {
                    infoMessage = "Current location detected. Existing location values were kept."
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                infoMessage = "Could not retrieve your current location. You can continue with manual location entry."
            } finally {
                currentLocationLoading = false
            }
        }
    }

    fun handleMapSelection(selection: MapPickerSelection) {
        if (mapPickerLoading) return

        mapPickerLoading = true
        mapActionMessage = ""

        scope.launch {
            try {
                val reverseLocation = RequestHelpRepository.reverseGeocodeCurrentLocation(
                    latitude = selection.latitude,
                    longitude = selection.longitude
                )
                val update = resolveMapPickerLocationUpdate(
                    currentCountry = formState.country,
                    currentCity = formState.city,
                    currentDistrict = formState.district,
                    currentNeighborhood = formState.neighborhood,
                    currentExtraAddress = formState.shortAddress,
                    reverseLocation = reverseLocation,
                    locations = availableLocationData
                )
                formState = formState.copy(
                    country = update.country,
                    city = update.city,
                    district = update.district,
                    neighborhood = update.neighborhood,
                    shortAddress = update.extraAddress
                )
                mapActionMessage = when {
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
                mapActionMessage = "Could not resolve selected coordinates. You can continue with manual location entry."
            } finally {
                mapPickerSelection = selection
                mapPickerLoading = false
                mapPickerOpen = false
            }
        }
    }

    val locationPermissionRequester = rememberForegroundLocationPermissionRequester { result ->
        if (result.granted) {
            applyCurrentLocationToForm()
        } else {
            infoMessage = "Location permission is denied. You can continue with manual location entry."
        }
    }

    LaunchedEffect(Unit) {
        try {
            availableLocationData = LocationTreeRepository.ensureLocationData()
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (_: Exception) {
            availableLocationData = locationData
            infoMessage = "Could not refresh location options. Showing saved location list."
        } finally {
            locationLoading = false
        }
    }

    LaunchedEffect(sessionToken, activeDraftLocalId) {
        val existingDraft = activeDraftLocalId.takeIf { it.isNotBlank() }?.let { localId ->
            RequestHelpRepository.getLocalHelpRequest(localId)
        }
        if (existingDraft != null) {
            if (existingDraft.ownerType == LocalOwnerType.AUTHENTICATED && !isLoggedIn) {
                onNavigateToLogin()
                return@LaunchedEffect
            }
            formState = existingDraft.toFormState()
            infoMessage = ""
            checkingActiveRequest = false
            return@LaunchedEffect
        }

        if (!isLoggedIn) {
            formState = RequestHelpFormState()
            checkingActiveRequest = false
            return@LaunchedEffect
        }

        try {
            val hasActiveRequest = RequestHelpRepository.hasActiveHelpRequest(sessionToken)
            if (hasActiveRequest) {
                onNavigateToMyHelpRequests()
                return@LaunchedEffect
            }

            val profile = ProfileRepository.fetchAndCacheRemoteProfile()
            formState = buildPrefilledForm(profile)
            infoMessage = ""
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (error: ApiException) {
            if (error.status == 401) {
                AuthRepository.logout()
                errorMessage = "Your session expired. Please log in again before sending a help request."
                onNavigateToLogin()
                return@LaunchedEffect
            }
            formState = buildPrefilledForm(ProfileRepository.getProfile())
            infoMessage = "Could not refresh profile details. Using saved information where available."
        } catch (_: Exception) {
            formState = buildPrefilledForm(ProfileRepository.getProfile())
            infoMessage = "Could not refresh profile details. Using saved information where available."
        } finally {
            checkingActiveRequest = false
        }
    }

    fun handleSubmit() {
        val nextFieldErrors = validateForm(formState)
        fieldErrors = nextFieldErrors
        errorMessage = ""
        infoMessage = ""
        mapActionMessage = ""

        if (nextFieldErrors.hasAny()) {
            return
        }

        loading = true
        scope.launch {
            try {
                if (isLoggedIn) {
                    val hasActiveRequest = activeDraftLocalId.isBlank() && RequestHelpRepository.hasActiveHelpRequest(sessionToken)
                    if (hasActiveRequest) {
                        errorMessage = "You can only have one active help request at a time."
                        return@launch
                    }
                }

                val submission = buildSubmission(formState, availableLocationData)
                val result = if (activeDraftLocalId.isNotBlank()) {
                    RequestHelpRepository.updateHelpRequest(
                        token = sessionToken,
                        localId = activeDraftLocalId,
                        submission = submission
                    )
                } else {
                    RequestHelpRepository.createHelpRequest(
                        token = sessionToken,
                        submission = submission
                    )
                }
                activeDraftLocalId = result.requestId
                infoMessage = "Help request saved on this device and queued for sync."
                onNavigateToMyHelpRequests()
            } catch (error: ApiException) {
                if (error.status == 401) {
                    AuthRepository.logout()
                    errorMessage = "Your session expired. Please log in again before sending a help request."
                    onNavigateToLogin()
                } else {
                    errorMessage = "Could not save your help request locally. Please try again."
                }
            } catch (_: Exception) {
                errorMessage = "Could not save your help request locally. Please try again."
            } finally {
                loading = false
            }
        }
    }

    AppScaffold(
        title = "Request Help",
        onNavigateBack = onNavigateBack,
        topBar = {
            RequestHelpStickyTopBar(
                draft = observedDraft,
                onNavigateBack = onNavigateBack
            )
        }
    ) {
        if (checkingActiveRequest) {
            HelperText(text = "Checking your current help request status...")
            return@AppScaffold
        }

        Column(
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(
                        title = "Help Types",
                        subtitle = if (isLoggedIn) {
                            "Select the support you need. Shared fields are prefilled from your profile when available."
                        } else {
                            "Guest users can fill and send this request form manually."
                        }
                    )

                    AppMultiSelectChipGroup(
                        label = "Required help",
                        options = helpTypeOptions,
                        selectedOptions = formState.helpTypes,
                        onOptionToggle = {
                            formState = formState.copy(
                                helpTypes = toggleSelection(formState.helpTypes, it),
                                otherHelpType = if (it == "Other" && "Other" in formState.helpTypes) "" else formState.otherHelpType
                            )
                        },
                        error = fieldErrors.helpTypes
                    )

                    if ("Other" in formState.helpTypes) {
                        AppTextField(
                            value = formState.otherHelpType,
                            onValueChange = { formState = formState.copy(otherHelpType = it) },
                            label = "Other Help Type Details",
                            placeholder = "Add a short detail if needed"
                        )
                    }
                }
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(
                        title = "Situation Details",
                        subtitle = "Share a concise summary so the backend request record contains enough coordination context."
                    )

                    AppTextField(
                        value = formState.affectedPeopleCount,
                        onValueChange = {
                            formState = formState.copy(
                                affectedPeopleCount = it.filter(Char::isDigit)
                            )
                        },
                        label = "Affected People Count",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        error = fieldErrors.affectedPeopleCount
                    )

                    AppMultiSelectChipGroup(
                        label = "Risk Flags",
                        options = riskFlagOptions,
                        selectedOptions = formState.riskFlags,
                        onOptionToggle = {
                            formState = formState.copy(
                                riskFlags = toggleSelection(formState.riskFlags, it)
                            )
                        }
                    )

                    AppMultiSelectChipGroup(
                        label = "Vulnerable Groups",
                        options = vulnerableGroupOptions,
                        selectedOptions = formState.vulnerableGroups,
                        onOptionToggle = {
                            formState = formState.copy(
                                vulnerableGroups = toggleSelection(formState.vulnerableGroups, it)
                            )
                        }
                    )

                    AppTextArea(
                        value = formState.situationDescription,
                        onValueChange = { formState = formState.copy(situationDescription = it) },
                        label = "Situation Description",
                        placeholder = "Describe the situation briefly",
                        error = fieldErrors.situationDescription
                    )

                    AppDropdown(
                        value = formState.bloodType,
                        onValueChange = { formState = formState.copy(bloodType = it) },
                        label = "Blood Type",
                        options = bloodTypeOptions,
                        placeholder = "Select blood type",
                        selectedTextMapper = { it.label }
                    )
                }
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(
                        title = "Location",
                        subtitle = "Use the same location structure as your profile."
                    )

                    if (locationLoading) {
                        HelperText(text = "Loading location options...")
                    }

                    if (currentLocationLoading) {
                        HelperText(text = "Detecting your current location. You can continue filling the form while this runs.")
                    }

                    SecondaryButton(
                        text = "Use Current Location",
                        onClick = {
                            if (locationPermissionRequester.refreshPermissionState()) {
                                applyCurrentLocationToForm()
                            } else {
                                locationPermissionRequester.requestPermission()
                            }
                        },
                        enabled = !currentLocationLoading
                    )

                    LocationSelector(
                        country = formState.country,
                        city = formState.city,
                        district = formState.district,
                        neighborhood = formState.neighborhood,
                        onCountryChange = {
                            formState = formState.copy(country = it, city = "", district = "", neighborhood = "")
                        },
                        onCityChange = {
                            formState = formState.copy(city = it, district = "", neighborhood = "")
                        },
                        onDistrictChange = {
                            formState = formState.copy(district = it, neighborhood = "")
                        },
                        onNeighborhoodChange = {
                            formState = formState.copy(neighborhood = it)
                        },
                        locationData = availableLocationData,
                        enabled = !locationLoading,
                        countryError = fieldErrors.country,
                        cityError = fieldErrors.city,
                        districtError = fieldErrors.district,
                        neighborhoodError = fieldErrors.neighborhood
                    )

                    SecondaryButton(
                        text = "Select Location on Map",
                        onClick = { mapPickerOpen = true },
                        enabled = !locationLoading && !loading
                    )

                    mapPickerSelection?.let { selection ->
                        HelperText(
                            text = "Selected coordinates: ${formatMapCoordinate(selection.latitude)}, ${formatMapCoordinate(selection.longitude)}"
                        )
                    }

                    AppTextField(
                        value = formState.shortAddress,
                        onValueChange = { formState = formState.copy(shortAddress = it) },
                        label = "Short Address / Address Description",
                        error = fieldErrors.shortAddress
                    )

                    LocationSelectionMapAction(
                        countryKeyOrLabel = formState.country,
                        cityKeyOrLabel = formState.city,
                        districtKeyOrLabel = formState.district,
                        neighborhoodValueOrLabel = formState.neighborhood,
                        extraAddress = formState.shortAddress,
                        locations = availableLocationData,
                        enabled = !loading,
                        onOpenFailure = { mapActionMessage = it },
                        onOpenSuccess = { mapActionMessage = "" }
                    )

                    if (mapPickerOpen) {
                        MapPickerDialog(
                            initialLatitude = mapPickerSelection?.latitude,
                            initialLongitude = mapPickerSelection?.longitude,
                            loading = mapPickerLoading,
                            onDismiss = { if (!mapPickerLoading) mapPickerOpen = false },
                            onConfirm = ::handleMapSelection
                        )
                    }
                }
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(
                        title = "Contact Information",
                        subtitle = "Shared profile fields are prefilled for logged-in users and remain editable."
                    )

                    AppTextField(
                        value = formState.fullName,
                        onValueChange = { formState = formState.copy(fullName = it) },
                        label = "Full Name",
                        error = fieldErrors.fullName
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(spacing.sm)
                    ) {
                        AppDropdown(
                            value = formState.countryCode,
                            onValueChange = { formState = formState.copy(countryCode = it) },
                            label = "Code",
                            options = countryCodeOptions,
                            modifier = Modifier.weight(0.42f),
                            selectedTextMapper = { it.value }
                        )

                        AppTextField(
                            value = formState.phoneNumber,
                            onValueChange = {
                                formState = formState.copy(phoneNumber = it.filter(Char::isDigit))
                            },
                            label = "Phone Number",
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            modifier = Modifier.weight(0.58f),
                            error = fieldErrors.phoneNumber
                        )
                    }

                    AppTextField(
                        value = formState.alternativePhone,
                        onValueChange = {
                            formState = formState.copy(alternativePhone = it.filter(Char::isDigit))
                        },
                        label = "Alternative Phone (optional)",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        error = fieldErrors.alternativePhone
                    )
                }
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(
                        title = "Confirmation",
                        subtitle = "Review the information before sending."
                    )

                    AppCheckbox(
                        checked = formState.confirmationAccepted,
                        onCheckedChange = {
                            formState = formState.copy(confirmationAccepted = it)
                        },
                        label = "I confirm this information can be shared for emergency coordination.",
                        error = fieldErrors.confirmationAccepted
                    )
                }
            }

            if (errorMessage.isNotBlank()) {
                HelperText(text = errorMessage)
            }

            if (infoMessage.isNotBlank()) {
                HelperText(text = infoMessage)
            }

            if (mapActionMessage.isNotBlank()) {
                HelperText(text = mapActionMessage)
            }

            PrimaryButton(
                text = "Send Help Request",
                onClick = ::handleSubmit,
                loading = loading
            )

            SecondaryButton(
                text = "Cancel",
                onClick = onNavigateBack,
                enabled = !loading
            )
        }
    }
}

@Composable
private fun RequestHelpStickyTopBar(
    draft: HelpRequestEntity?,
    onNavigateBack: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    Surface(color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = spacing.lg, vertical = spacing.sm),
            verticalArrangement = Arrangement.spacedBy(spacing.sm)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                TextActionButton(text = "Back", onClick = onNavigateBack)
                Text(
                    text = "Request Help",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Box(modifier = Modifier.size(48.dp))
            }

            draft?.let {
                DraftSyncBanner(draft = it)
            }
        }
    }
}

@Composable
private fun DraftSyncBanner(draft: HelpRequestEntity) {
    val spacing = LocalNephSpacing.current
    val synced = draft.syncStatus == SyncStatus.SYNCED
    val label = if (synced) "Draft synced" else "Saved offline"
    val iconTint = if (synced) {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.onSurfaceVariant
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.medium
    ) {
        Row(
            modifier = Modifier.padding(horizontal = spacing.md, vertical = spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(spacing.sm),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(modifier = Modifier.size(24.dp)) {
                Icon(
                    imageVector = if (synced) Icons.Filled.Wifi else Icons.Filled.Wifi,
                    contentDescription = label,
                    tint = iconTint,
                    modifier = Modifier.size(22.dp)
                )
                if (synced) {
                    Icon(
                        imageVector = Icons.Filled.CheckCircle,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .size(12.dp)
                            .align(Alignment.BottomEnd)
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                } else {
                    Icon(
                        imageVector = Icons.Filled.Error,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier
                            .size(12.dp)
                            .align(Alignment.BottomEnd)
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                }
            }

            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}
@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun RequestHelpScreenPreview() {
    NephTheme {
        RequestHelpScreen(
            onNavigateBack = {},
            onNavigateToLogin = {},
            onNavigateToMyHelpRequests = {}
        )
    }
}
