package com.neph.features.profile.data

import com.neph.ui.components.inputs.DropdownOption

val professionOptions = listOf(
    DropdownOption("Doctor", "Doctor"),
    DropdownOption("Firefighter", "Firefighter"),
    DropdownOption("Nurse", "Nurse"),
    DropdownOption("Engineer", "Engineer"),
    DropdownOption("Volunteer", "Volunteer")
)

fun professionOptionsFor(currentProfession: String?): List<DropdownOption> {
    val normalized = currentProfession?.trim().orEmpty()
    if (normalized.isBlank()) {
        return professionOptions
    }

    return if (professionOptions.any { it.value == normalized }) {
        professionOptions
    } else {
        listOf(DropdownOption(normalized, normalized)) + professionOptions
    }
}
