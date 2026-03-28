package com.neph.features.profile.presentation

import android.text.format.DateFormat
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.neph.features.profile.data.ProfileData
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.profile.data.parseBirthDateToMillis
import com.neph.features.profile.data.sanitizeDecimalInput
import com.neph.features.profile.data.toEditableString
import com.neph.features.profile.presentation.components.GenderSelector
import com.neph.features.profile.presentation.components.LocationSelector
import com.neph.features.profile.data.bloodTypeOptions
import com.neph.features.profile.data.locationData
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.components.inputs.*
import com.neph.ui.components.selection.AppToggleSwitch
import com.neph.ui.layout.AppScaffold
import com.neph.ui.theme.LocalNephSpacing

@Composable
fun EditProfileScreen(
    onSave: (ProfileData) -> Unit,
    onNavigateBack: () -> Unit
) {
    var profile by remember { mutableStateOf(ProfileRepository.getProfile()) }
    var heightText by remember { mutableStateOf("") }
    var weightText by remember { mutableStateOf("") }
    var loading by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val p = ProfileRepository.getProfile()
        profile = p
        heightText = p.height.toEditableString()
        weightText = p.weight.toEditableString()
    }

    var chronicFiles by remember { mutableStateOf<List<String>>(emptyList()) }
    var allergyFiles by remember { mutableStateOf<List<String>>(emptyList()) }

    var showDatePicker by remember { mutableStateOf(false) }

    val spacing = LocalNephSpacing.current

    // FILE PICKERS
    val chronicLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { chronicFiles = chronicFiles + it.toString() }
    }

    val allergyLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { allergyFiles = allergyFiles + it.toString() }
    }

    AppScaffold(title = "Edit Profile", onNavigateBack = onNavigateBack) {

        Column(verticalArrangement = Arrangement.spacedBy(spacing.lg)) {

            // ───── AVATAR ─────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        profile.fullName?.ifEmpty { "User" } ?: "User",
                        style = MaterialTheme.typography.titleLarge
                    )
                    Text(
                        profile.email?.ifEmpty { "No email" } ?: "No email",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            // ───── ACCOUNT ─────
            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                    SectionHeader(title = "Account Information")

                    Text(
                        "Used for login & emergency contact",
                        style = MaterialTheme.typography.bodySmall
                    )

                    Text("Email: ${profile.email ?: "-"}")
                    Text("Phone: ${profile.phone ?: "-"}")
                }
            }

            // ───── PHYSICAL ─────
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
                        value = profile.gender ?: "",
                        onValueChange = { profile = profile.copy(gender = it) }
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(spacing.sm)
                    ) {
                        AppTextField(
                            value = profile.birthDate ?: "",
                            onValueChange = { profile = profile.copy(birthDate = it.ifBlank { null }) },
                            label = "Date of Birth",
                            placeholder = "YYYY-MM-DD",
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = { showDatePicker = true }) {
                            Text("Pick date")
                        }
                    }
                }
            }

            // ───── MEDICAL ─────
            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {

                    SectionHeader(title = "Medical Information")

                    AppDropdown(
                        value = profile.bloodType ?: "",
                        onValueChange = { profile = profile.copy(bloodType = it) },
                        label = "Blood Type",
                        options = bloodTypeOptions,
                        selectedTextMapper = { it.label }
                    )

                    AppTextArea(
                        value = profile.medicalHistory ?: "",
                        onValueChange = { profile = profile.copy(medicalHistory = it) },
                        label = "Medical History"
                    )

                    // ───── CHRONIC ─────
                    Text("Chronic Diseases", style = MaterialTheme.typography.labelLarge)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Upload document")

                        Text(
                            "Upload",
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.clickable {
                                chronicLauncher.launch("*/*")
                            }
                        )
                    }

                    AppTextField(
                        value = profile.chronicDiseases ?: "",
                        onValueChange = { profile = profile.copy(chronicDiseases = it) },
                        label = "Chronic Diseases"
                    )

                    chronicFiles.forEach {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("📄 ${it.substringAfterLast("/")}")
                                Text("Pending Verification", color = MaterialTheme.colorScheme.error)
                            }

                            Text(
                                "Remove",
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.clickable {
                                    chronicFiles = chronicFiles - it
                                }
                            )
                        }
                    }

                    // ───── ALLERGIES ─────
                    Text("Allergies", style = MaterialTheme.typography.labelLarge)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Upload document")

                        Text(
                            "Upload",
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.clickable {
                                allergyLauncher.launch("*/*")
                            }
                        )
                    }

                    AppTextField(
                        value = profile.allergies ?: "",
                        onValueChange = { profile = profile.copy(allergies = it) },
                        label = "Allergies"
                    )

                    allergyFiles.forEach {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("📄 ${it.substringAfterLast("/")}")
                                Text("Pending Verification", color = MaterialTheme.colorScheme.error)
                            }

                            Text(
                                "Remove",
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.clickable {
                                    allergyFiles = allergyFiles - it
                                }
                            )
                        }
                    }
                }
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {

                    // ───── PROFESSION ─────
                    val professionOptions = listOf(
                        "Doctor",
                        "Firefighter",
                        "Nurse",
                        "Engineer",
                        "Volunteer"
                    )

                    Text("Profession", style = MaterialTheme.typography.titleMedium)

                    FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        professionOptions.forEach { option ->
                            FilterChip(
                                selected = profile.profession == option,
                                onClick = {
                                    val next =
                                        if (profile.profession == option) null else option
                                    profile = profile.copy(profession = next)
                                },
                                label = { Text(option) }
                            )
                        }
                    }

                    val expertiseOptions = listOf(
                        "First Aid",
                        "Driving",
                        "Search & Rescue",
                        "Cooking",
                        "Logistics"
                    )

                    Text("Expertise (optional)", style = MaterialTheme.typography.titleMedium)

                    Column {
                        expertiseOptions.forEach { skill ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(
                                    checked = profile.expertise.contains(skill),
                                    onCheckedChange = { checked ->
                                        val next = if (checked) {
                                            profile.expertise + skill
                                        } else {
                                            profile.expertise - skill
                                        }
                                        profile = profile.copy(expertise = next)
                                    }
                                )
                                Text(skill)
                            }
                        }
                    }
                }
            }

            // ───── LOCATION ─────
            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {

                    SectionHeader(title = "Location")

                    LocationSelector(
                        country = profile.country ?: "",
                        city = profile.city ?: "",
                        district = profile.district ?: "",
                        neighborhood = profile.neighborhood ?: "",
                        onCountryChange = { profile = profile.copy(country = it, city = "", district = "", neighborhood = "") },
                        onCityChange = { profile = profile.copy(city = it, district = "", neighborhood = "") },
                        onDistrictChange = { profile = profile.copy(district = it, neighborhood = "") },
                        onNeighborhoodChange = { profile = profile.copy(neighborhood = it) },
                        locationData = locationData
                    )

                    AppTextField(
                        value = profile.extraAddress ?: "",
                        onValueChange = { profile = profile.copy(extraAddress = it) },
                        label = "Extra Address"
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AppToggleSwitch(
                            checked = profile.shareLocation ?: false,
                            onCheckedChange = { profile = profile.copy(shareLocation = it) },
                            label = "Share Current Location"
                        )
                    }
                }
            }

            // ───── SAVE ─────
            PrimaryButton(
                text = "Save Changes",
                onClick = {
                    profile = profile.copy(
                        height = heightText.toFloatOrNull(),
                        weight = weightText.toFloatOrNull()
                    )
                    ProfileRepository.saveProfile(profile)
                    onSave(profile)
                },
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