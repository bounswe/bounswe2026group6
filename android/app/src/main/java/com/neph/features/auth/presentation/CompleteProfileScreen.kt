package com.neph.features.auth.presentation

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
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SaveActionBar
import com.neph.ui.components.inputs.AppDropdown
import com.neph.ui.components.inputs.AppTextArea
import com.neph.ui.components.inputs.AppTextField
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

    var fullName by rememberSaveable { mutableStateOf(existingProfile.fullName.orEmpty()) }
    var countryCode by rememberSaveable { mutableStateOf(existingPhoneParts.countryCode) }
    var phone by rememberSaveable { mutableStateOf(existingPhoneParts.phone) }
    var gender by rememberSaveable { mutableStateOf(existingProfile.gender.orEmpty()) }
    var height by rememberSaveable { mutableStateOf(existingProfile.height.toEditableString()) }
    var weight by rememberSaveable { mutableStateOf(existingProfile.weight.toEditableString()) }
    var bloodType by rememberSaveable { mutableStateOf(existingProfile.bloodType.orEmpty()) }
    var birthDate by rememberSaveable { mutableStateOf(existingProfile.birthDate.orEmpty()) }
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

    var showDatePicker by remember { mutableStateOf(false) }
    val datePickerState = rememberDatePickerState()

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

        if (height.isBlank() || weight.isBlank() || birthDate.isBlank() ||
            country.isBlank() || city.isBlank() || district.isBlank() || neighborhood.isBlank()
        ) {
            error = "Please fill in all required fields."
            return
        }

        if (!birthDate.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) {
            error = "Invalid date format (YYYY-MM-DD)"
            return
        }

        if (parseBirthDateToMillis(birthDate) == null) {
            error = "Please enter a valid calendar date."
            return
        }

        val heightFloat = height.toFloatOrNull()
        val weightFloat = weight.toFloatOrNull()
        if (heightFloat == null || weightFloat == null || heightFloat <= 0f || weightFloat <= 0f) {
            error = "Height and weight must be valid positive numbers"
            return
        }

        loading = true
        scope.launch {
            try {
                ProfileRepository.syncProfile(
                    ProfileRepository.getProfile().copy(
                        fullName = normalizedName,
                        phone = combinePhoneNumber(countryCode, normalizedPhone),
                        gender = gender.takeIf(String::isNotBlank),
                        height = heightFloat,
                        weight = weightFloat,
                        bloodType = bloodType.takeIf(String::isNotBlank),
                        birthDate = birthDate,
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
                )

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
                placeholder = "Enter your full name"
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
                    placeholder = "Enter your phone number",
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
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )

                AppTextField(
                    value = weight,
                    onValueChange = { weight = sanitizeDecimalInput(it, maxLen = 3) },
                    label = "Weight (kg)",
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )
            }

            GenderSelector(value = gender, onValueChange = { gender = it })

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(spacing.sm)
            ) {
                AppTextField(
                    value = birthDate,
                    onValueChange = { birthDate = it },
                    label = "Date of Birth",
                    placeholder = "YYYY-MM-DD",
                    modifier = Modifier.weight(1f)
                )
                TextButton(onClick = { showDatePicker = true }) {
                    Text("Pick date")
                }
            }
            HelperText(text = "The backend currently stores your age, so date of birth is kept locally and synced as age.")

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

            AppTextField(
                value = profession.orEmpty(),
                onValueChange = { profession = it },
                label = "Profession",
                placeholder = "Enter your profession"
            )

            AppTextArea(
                value = expertise.joinToString(", "),
                onValueChange = { expertise = parseListField(it) },
                label = "Expertise (optional — comma-separated)"
            )

            Text("Location", style = MaterialTheme.typography.titleMedium)

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
                locationData = locationData
            )

            AppTextField(
                value = extraAddress,
                onValueChange = { extraAddress = it },
                label = "Extra Address"
            )

            AppToggleSwitch(
                checked = shareLocation,
                onCheckedChange = { shareLocation = it },
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

        if (showDatePicker) {
            DatePickerDialog(
                onDismissRequest = { showDatePicker = false },
                confirmButton = {
                    TextButton(
                        onClick = {
                            val selectedDate = datePickerState.selectedDateMillis
                            if (selectedDate != null) {
                                birthDate = android.text.format.DateFormat.format(
                                    "yyyy-MM-dd",
                                    selectedDate
                                ).toString()
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