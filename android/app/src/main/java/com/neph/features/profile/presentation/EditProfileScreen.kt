package com.neph.features.profile.presentation

import android.text.format.DateFormat
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
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
import androidx.compose.ui.text.input.KeyboardType
import com.neph.core.network.ApiException
import com.neph.features.auth.util.countryCodeOptions
import com.neph.features.profile.data.ProfileData
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.profile.data.bloodTypeOptions
import com.neph.features.profile.data.combinePhoneNumber
import com.neph.features.profile.data.locationData
import com.neph.features.profile.data.normalizePhoneParts
import com.neph.features.profile.data.parseBirthDateToMillis
import com.neph.features.profile.data.parseListField
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
    var showDatePicker by remember { mutableStateOf(false) }

    var countryCode by rememberSaveable { mutableStateOf(initialPhoneParts.countryCode) }
    var phone by rememberSaveable { mutableStateOf(initialPhoneParts.phone) }
    var heightText by rememberSaveable { mutableStateOf(profile.height.toEditableString()) }
    var weightText by rememberSaveable { mutableStateOf(profile.weight.toEditableString()) }

    val scope = rememberCoroutineScope()
    val spacing = LocalNephSpacing.current

    LaunchedEffect(Unit) {
        try {
            profile = ProfileRepository.fetchAndCacheRemoteProfile()
            val phoneParts = normalizePhoneParts(profile.phone)
            countryCode = phoneParts.countryCode
            phone = phoneParts.phone
            heightText = profile.height.toEditableString()
            weightText = profile.weight.toEditableString()
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (_: ApiException) {
            profile = ProfileRepository.getProfile()
            val phoneParts = normalizePhoneParts(profile.phone)
            countryCode = phoneParts.countryCode
            phone = phoneParts.phone
            heightText = profile.height.toEditableString()
            weightText = profile.weight.toEditableString()
        } catch (_: Exception) {
            profile = ProfileRepository.getProfile()
            val phoneParts = normalizePhoneParts(profile.phone)
            countryCode = phoneParts.countryCode
            phone = phoneParts.phone
            heightText = profile.height.toEditableString()
            weightText = profile.weight.toEditableString()
            info = "Could not refresh your profile. Showing saved information."
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
        if (heightFloat == null || heightFloat <= 0f || weightFloat == null || weightFloat <= 0f) {
            error = "Height and weight must be valid positive numbers."
            return
        }

        if (profile.birthDate.isNullOrBlank() || !profile.birthDate!!.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) {
            error = "Please enter a valid date of birth in YYYY-MM-DD format."
            return
        }

        if (parseBirthDateToMillis(profile.birthDate) == null) {
            error = "Please enter a valid calendar date."
            return
        }

        if (profile.country.isNullOrBlank() || profile.city.isNullOrBlank() || profile.district.isNullOrBlank() || profile.neighborhood.isNullOrBlank()) {
            error = "Please complete your location fields."
            return
        }

        loading = true
        scope.launch {
            try {
                profile = ProfileRepository.syncProfile(
                    profile.copy(
                        phone = combinePhoneNumber(countryCode, phone),
                        height = heightFloat,
                        weight = weightFloat
                    )
                )
                val phoneParts = normalizePhoneParts(profile.phone)
                countryCode = phoneParts.countryCode
                phone = phoneParts.phone
                heightText = profile.height.toEditableString()
                weightText = profile.weight.toEditableString()
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

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(spacing.sm)
                    ) {
                        AppTextField(
                            value = profile.birthDate.orEmpty(),
                            onValueChange = { profile = profile.copy(birthDate = it.takeIf(String::isNotBlank)) },
                            label = "Date of Birth",
                            placeholder = "YYYY-MM-DD",
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = { showDatePicker = true }) {
                            Text("Pick date")
                        }
                    }
                    HelperText(text = "The backend stores your age, so date of birth is kept locally and synced as age.")
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

                    AppTextField(
                        value = profile.profession.orEmpty(),
                        onValueChange = { value ->
                            profile = profile.copy(profession = value.takeIf(String::isNotBlank))
                        },
                        label = "Profession",
                        placeholder = "Enter your profession"
                    )

                    AppTextArea(
                        value = profile.expertise.joinToString(", "),
                        onValueChange = { value ->
                            profile = profile.copy(expertise = parseListField(value))
                        },
                        label = "Expertise (optional — comma-separated)"
                    )
                }
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(title = "Location")

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
                        locationData = locationData
                    )

                    AppTextField(
                        value = profile.extraAddress.orEmpty(),
                        onValueChange = { profile = profile.copy(extraAddress = it) },
                        label = "Extra Address"
                    )

                    AppToggleSwitch(
                        checked = profile.shareLocation ?: false,
                        onCheckedChange = { profile = profile.copy(shareLocation = it) },
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

        if (showDatePicker) {
            val initialMillis = remember(profile.birthDate) {
                parseBirthDateToMillis(profile.birthDate)
            }
            val datePickerState = rememberDatePickerState(
                initialSelectedDateMillis = initialMillis
            )
            DatePickerDialog(
                onDismissRequest = { showDatePicker = false },
                confirmButton = {
                    TextButton(
                        onClick = {
                            val selectedDate = datePickerState.selectedDateMillis
                            if (selectedDate != null) {
                                val formatted = DateFormat.format(
                                    "yyyy-MM-dd",
                                    selectedDate
                                ).toString()
                                profile = profile.copy(birthDate = formatted)
                            }
                            showDatePicker = false
                        }
                    ) {
                        Text("OK")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDatePicker = false }) {
                        Text("Cancel")
                    }
                }
            ) {
                DatePicker(state = datePickerState)
            }
        }
    }
}