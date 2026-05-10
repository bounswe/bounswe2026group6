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
import com.neph.features.profile.data.locationData
import com.neph.features.profile.data.normalizePhoneParts
import com.neph.features.operationallocation.data.OperationalLocationRepository
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
import com.neph.ui.map.requestHelpMapPickerFeedbackMessage
import com.neph.ui.map.resolveMapPickerLocationUpdate
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private val helpTypeOptions = listOf(
    "First Aid",
    "Food & Water",
    "Shelter",
    "Search & Rescue"
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

private const val RequestHelpGpsCoordinateSource = "gps"
private const val RequestHelpMapCoordinateSource = "map_selection"

private data class RequestHelpFormState(
    val helpTypes: List<String> = emptyList(),
    val affectedPeopleCount: String = "",
    val riskFlags: List<String> = emptyList(),
    val vulnerableGroups: List<String> = emptyList(),
    val situationDescription: String = "",
    val shareProfileHealthInfoWithVolunteer: Boolean = false,
    val country: String = "",
    val city: String = "",
    val district: String = "",
    val neighborhood: String = "",
    val shortAddress: String = "",
    val latitude: Double? = null,
    val longitude: Double? = null,
    val coordinateSource: String? = null,
    val coordinateCapturedAt: String? = null,
    val coordinateAccuracyMeters: Double? = null,
    val locationWasManuallyChanged: Boolean = false,
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
    "Food & Water" to "food_water",
    "Shelter" to "shelter"
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

    return RequestHelpFormState(
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
        affectedPeopleCount = affectedPeopleCount.toString(),
        riskFlags = riskFlagsJson.jsonArrayToStringList(),
        vulnerableGroups = vulnerableGroupsJson.jsonArrayToStringList(),
        situationDescription = description,
        shareProfileHealthInfoWithVolunteer = shareProfileHealthInfoWithVolunteer,
        country = country,
        city = city,
        district = district,
        neighborhood = neighborhood,
        shortAddress = extraAddress,
        latitude = latitude,
        longitude = longitude,
        coordinateSource = coordinateSource,
        coordinateCapturedAt = coordinateCapturedAt,
        coordinateAccuracyMeters = coordinateAccuracyMeters,
        locationWasManuallyChanged = false,
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
    val affectedPeople = if (state.affectedPeopleCount.isBlank()) 1 else state.affectedPeopleCount.toIntOrNull()

    return RequestHelpFieldErrors(
        helpTypes = if (state.helpTypes.isEmpty()) "Select at least one help type." else null,
        affectedPeopleCount = when {
            state.affectedPeopleCount.isNotBlank() && (affectedPeople == null || affectedPeople < 1) ->
                "Enter a valid number greater than or equal to 1."
            else -> null
        },
        situationDescription = null,
        country = if (state.country.isBlank()) "Country is required." else null,
        city = if (state.city.isBlank()) "City is required." else null,
        district = if (state.district.isBlank()) "District is required." else null,
        neighborhood = null,
        shortAddress = null,
        fullName = null,
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

private fun shouldShowLowContextWarning(state: RequestHelpFormState): Boolean {
    return state.situationDescription.isBlank() && state.fullName.isBlank()
}

private fun RequestHelpFormState.withoutCoordinateSnapshot(): RequestHelpFormState {
    return copy(
        latitude = null,
        longitude = null,
        coordinateSource = null,
        coordinateCapturedAt = null,
        coordinateAccuracyMeters = null,
        locationWasManuallyChanged = true
    )
}

private fun RequestHelpFormState.hasCoordinateSnapshot(): Boolean {
    return latitude != null && longitude != null
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
        otherHelpText = "",
        affectedPeopleCount = state.affectedPeopleCount.toIntOrNull() ?: 1,
        description = state.situationDescription.trim(),
        riskFlags = state.riskFlags.map { it.trim() },
        vulnerableGroups = state.vulnerableGroups.map { it.trim() },
        shareProfileHealthInfoWithVolunteer = state.shareProfileHealthInfoWithVolunteer,
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
            extraAddress = state.shortAddress.trim(),
            latitude = state.latitude,
            longitude = state.longitude,
            coordinateSource = state.coordinateSource,
            coordinateCapturedAt = state.coordinateCapturedAt,
            coordinateAccuracyMeters = state.coordinateAccuracyMeters
        ),
        contact = RequestHelpContactSubmission(
            fullName = state.fullName.trim(),
            phone = primaryPhone,
            alternativePhone = alternativePhone
        ),
        consentGiven = state.confirmationAccepted
    )
}

private fun currentIsoUtc(): String {
    return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date())
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

private fun resolveEventLocationAutofillSelection(
    reverseLocation: RequestHelpReverseLocation,
    locations: LocationData
): GuestLocationAutofillSelection? {
    val countryFromCode = reverseLocation.countryCode
        ?.lowercase()
        ?.takeIf { locations.containsKey(it) }
        .orEmpty()
    val countryFromLabel = findCountryKeyByLabel(reverseLocation.country, locations)
    val country = countryFromCode.ifBlank { countryFromLabel }
    if (country.isBlank()) return null

    val city = findCityKeyByLabel(country, reverseLocation.city, locations)
    if (city.isBlank()) return null

    val district = findDistrictKeyByLabel(country, city, reverseLocation.district, locations)
    if (district.isBlank()) return null

    val neighborhood = findNeighborhoodValueByLabel(
        country,
        city,
        district,
        reverseLocation.neighborhood,
        locations
    )

    return GuestLocationAutofillSelection(
        country = country,
        city = city,
        district = district,
        neighborhood = neighborhood,
        shortAddress = reverseLocation.extraAddress?.takeIf { it.isNotBlank() }.orEmpty()
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

    fun applyPendingCoordinateSnapshot(
        baseState: RequestHelpFormState,
        clearAdministrativeFields: Boolean
    ): RequestHelpFormState {
        val snapshot = RequestHelpRepository.consumePendingCoordinateSnapshot() ?: return baseState
        infoMessage = "Current emergency point saved. Please complete the address fields manually."
        return baseState.copy(
            country = if (clearAdministrativeFields) "" else baseState.country,
            city = if (clearAdministrativeFields) "" else baseState.city,
            district = if (clearAdministrativeFields) "" else baseState.district,
            neighborhood = if (clearAdministrativeFields) "" else baseState.neighborhood,
            shortAddress = if (clearAdministrativeFields) "" else baseState.shortAddress,
            latitude = snapshot.latitude,
            longitude = snapshot.longitude,
            coordinateSource = snapshot.coordinateSource,
            coordinateCapturedAt = snapshot.coordinateCapturedAt,
            coordinateAccuracyMeters = snapshot.coordinateAccuracyMeters,
            locationWasManuallyChanged = false
        )
    }

    fun updateManualLocation(nextState: RequestHelpFormState) {
        val hadCoordinateSnapshot = formState.hasCoordinateSnapshot()
        formState = nextState.withoutCoordinateSnapshot()
        mapPickerSelection = null
        mapActionMessage = ""
        if (hadCoordinateSnapshot) {
            infoMessage = "Selected emergency point cleared because the address fields changed."
        }
    }

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
            var capturedSnapshot = false
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

                runCatching {
                    OperationalLocationRepository.saveAndSyncIfAuthenticated(location)
                }

                formState = formState.copy(
                    latitude = location.latitude,
                    longitude = location.longitude,
                    coordinateSource = RequestHelpGpsCoordinateSource,
                    coordinateCapturedAt = location.capturedAt,
                    coordinateAccuracyMeters = location.accuracyMeters,
                    locationWasManuallyChanged = false
                )
                capturedSnapshot = true

                val reverseLocation = RequestHelpRepository.reverseGeocodeCurrentLocation(
                    latitude = location.latitude,
                    longitude = location.longitude
                )
                if (reverseLocation == null) {
                    formState = formState.copy(country = "", city = "", district = "", neighborhood = "", shortAddress = "")
                    infoMessage = "Current emergency point saved. Please complete the address fields manually."
                    return@launch
                }

                val previousFormState = formState
                val autofill = resolveEventLocationAutofillSelection(
                    reverseLocation = reverseLocation,
                    locations = availableLocationData
                )
                if (autofill == null) {
                    formState = previousFormState.copy(
                        country = "",
                        city = "",
                        district = "",
                        neighborhood = "",
                        shortAddress = "",
                        latitude = location.latitude,
                        longitude = location.longitude,
                        coordinateSource = RequestHelpGpsCoordinateSource,
                        coordinateCapturedAt = location.capturedAt,
                        coordinateAccuracyMeters = location.accuracyMeters,
                        locationWasManuallyChanged = false
                    )
                    infoMessage = "Current emergency point saved. Please complete the address fields manually."
                    return@launch
                }

                val nextFormState = previousFormState.copy(
                    country = autofill.country,
                    city = autofill.city,
                    district = autofill.district,
                    neighborhood = autofill.neighborhood,
                    shortAddress = autofill.shortAddress,
                    latitude = location.latitude,
                    longitude = location.longitude,
                    coordinateSource = RequestHelpGpsCoordinateSource,
                    coordinateCapturedAt = location.capturedAt,
                    coordinateAccuracyMeters = location.accuracyMeters,
                    locationWasManuallyChanged = false
                )
                if (nextFormState != previousFormState) {
                    formState = nextFormState
                    infoMessage = "Current location applied. Please verify the emergency location fields."
                } else {
                    infoMessage = "Current location detected. Existing location values were kept."
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                infoMessage = if (capturedSnapshot) {
                    "Current emergency point saved. Please complete the address fields manually."
                } else {
                    "Could not retrieve your current location. You can continue with manual location entry."
                }
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
            val selectedCapturedAt = currentIsoUtc()
            try {
                formState = formState.copy(
                    latitude = selection.latitude,
                    longitude = selection.longitude,
                    coordinateSource = RequestHelpMapCoordinateSource,
                    coordinateCapturedAt = selectedCapturedAt,
                    coordinateAccuracyMeters = null,
                    locationWasManuallyChanged = false
                )
                val reverseLocation = RequestHelpRepository.reverseGeocodeCurrentLocation(
                    latitude = selection.latitude,
                    longitude = selection.longitude
                )
                val reverseUpdate = reverseLocation?.let {
                    resolveMapPickerLocationUpdate(
                        currentCountry = "",
                        currentCity = "",
                        currentDistrict = "",
                        currentNeighborhood = "",
                        currentExtraAddress = "",
                        reverseLocation = it,
                        locations = availableLocationData
                    )
                }
                val mappedUpdate = reverseUpdate?.takeIf { it.hasStructuredMatch }
                if (mappedUpdate == null) {
                    formState = formState.copy(
                        country = "",
                        city = "",
                        district = "",
                        neighborhood = "",
                        shortAddress = "",
                        latitude = selection.latitude,
                        longitude = selection.longitude,
                        coordinateSource = RequestHelpMapCoordinateSource,
                        coordinateCapturedAt = selectedCapturedAt,
                        coordinateAccuracyMeters = null,
                        locationWasManuallyChanged = false
                    )
                    mapActionMessage = requestHelpMapPickerFeedbackMessage(reverseLocation, mappedUpdate)
                    return@launch
                }
                formState = formState.copy(
                    country = mappedUpdate.country,
                    city = mappedUpdate.city,
                    district = mappedUpdate.district,
                    neighborhood = mappedUpdate.neighborhood,
                    shortAddress = mappedUpdate.extraAddress,
                    latitude = selection.latitude,
                    longitude = selection.longitude,
                    coordinateSource = RequestHelpMapCoordinateSource,
                    coordinateCapturedAt = selectedCapturedAt,
                    coordinateAccuracyMeters = null,
                    locationWasManuallyChanged = false
                )
                mapActionMessage = requestHelpMapPickerFeedbackMessage(reverseLocation, mappedUpdate)
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                formState = formState.copy(
                    country = "",
                    city = "",
                    district = "",
                    neighborhood = "",
                    shortAddress = "",
                    latitude = selection.latitude,
                    longitude = selection.longitude,
                    coordinateSource = RequestHelpMapCoordinateSource,
                    coordinateCapturedAt = selectedCapturedAt,
                    coordinateAccuracyMeters = null,
                    locationWasManuallyChanged = false
                )
                mapActionMessage = "Could not resolve the selected point. You can still enter the emergency address manually."
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
            formState = applyPendingCoordinateSnapshot(
                baseState = RequestHelpFormState(),
                clearAdministrativeFields = true
            )
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
            formState = applyPendingCoordinateSnapshot(
                baseState = buildPrefilledForm(profile),
                clearAdministrativeFields = true
            )
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (error: ApiException) {
            if (error.status == 401) {
                AuthRepository.logout()
                errorMessage = "Your session expired. Please log in again before sending a help request."
                onNavigateToLogin()
                return@LaunchedEffect
            }
            formState = applyPendingCoordinateSnapshot(
                baseState = buildPrefilledForm(ProfileRepository.getProfile()),
                clearAdministrativeFields = true
            )
            if (infoMessage.isBlank()) {
                infoMessage = "Could not refresh profile details. Using saved information where available."
            }
        } catch (_: Exception) {
            formState = applyPendingCoordinateSnapshot(
                baseState = buildPrefilledForm(ProfileRepository.getProfile()),
                clearAdministrativeFields = true
            )
            if (infoMessage.isBlank()) {
                infoMessage = "Could not refresh profile details. Using saved information where available."
            }
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
                        submission = submission,
                        preserveExistingCoordinates = !formState.locationWasManuallyChanged
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
                                helpTypes = toggleSelection(formState.helpTypes, it)
                            )
                        },
                        error = fieldErrors.helpTypes
                    )
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
                        label = "Affected People Count (optional)",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        error = fieldErrors.affectedPeopleCount
                    )

                    AppMultiSelectChipGroup(
                        label = "Risk Flags (optional)",
                        options = riskFlagOptions,
                        selectedOptions = formState.riskFlags,
                        onOptionToggle = {
                            formState = formState.copy(
                                riskFlags = toggleSelection(formState.riskFlags, it)
                            )
                        }
                    )

                    AppMultiSelectChipGroup(
                        label = "Vulnerable Groups (optional)",
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
                        label = "Situation Description (optional)",
                        placeholder = "Describe the situation briefly",
                        error = fieldErrors.situationDescription
                    )

                    AppCheckbox(
                        checked = formState.shareProfileHealthInfoWithVolunteer,
                        onCheckedChange = {
                            formState = formState.copy(shareProfileHealthInfoWithVolunteer = it)
                        },
                        label = "I agree to share my profile health information with the volunteer assigned to this request."
                    )
                }
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(
                        title = "Emergency Location",
                        subtitle = "Where do you need help right now? Profile location may prefill fields, but this request uses the event location you confirm here."
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
                            updateManualLocation(
                                formState.copy(country = it, city = "", district = "", neighborhood = "")
                            )
                        },
                        onCityChange = {
                            updateManualLocation(
                                formState.copy(city = it, district = "", neighborhood = "")
                            )
                        },
                        onDistrictChange = {
                            updateManualLocation(
                                formState.copy(district = it, neighborhood = "")
                            )
                        },
                        onNeighborhoodChange = {
                            updateManualLocation(formState.copy(neighborhood = it))
                        },
                        locationData = availableLocationData,
                        enabled = !locationLoading,
                        countryError = fieldErrors.country,
                        cityError = fieldErrors.city,
                        districtError = fieldErrors.district,
                        neighborhoodError = fieldErrors.neighborhood,
                        neighborhoodLabel = "Neighborhood (optional)"
                    )

                    SecondaryButton(
                        text = "Select Emergency Location on Map",
                        onClick = { mapPickerOpen = true },
                        enabled = !locationLoading && !loading
                    )

                    if (formState.latitude != null && formState.longitude != null) {
                        HelperText(
                            text = "Emergency location point selected. Please verify the address fields before sending."
                        )
                    }

                    AppTextField(
                        value = formState.shortAddress,
                        onValueChange = { updateManualLocation(formState.copy(shortAddress = it)) },
                        label = "Short Address / Address Description (optional)",
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
                            title = "Select Emergency Location on Map",
                            initialLatitude = mapPickerSelection?.latitude ?: formState.latitude,
                            initialLongitude = mapPickerSelection?.longitude ?: formState.longitude,
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
                        label = "Full Name (optional)",
                        error = fieldErrors.fullName
                    )

                    if (shouldShowLowContextWarning(formState)) {
                        HelperText(
                            text = "Add a situation description or full name when possible to help coordinators triage faster."
                        )
                    }

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
