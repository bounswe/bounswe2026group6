package com.neph.features.profile.presentation.components

import androidx.compose.runtime.Composable
import com.neph.ui.components.inputs.AppDropdown
import com.neph.ui.components.inputs.DropdownOption

@Composable
fun GenderSelector(
    value: String,
    onValueChange: (String) -> Unit
) {
    val options = listOf(
        DropdownOption("Select Gender", ""),
        DropdownOption("Male", "male"),
        DropdownOption("Female", "female"),
        DropdownOption("Other", "other")
    )
    AppDropdown(
        value = value,
        onValueChange = onValueChange,
        label = "Gender",
        options = options,
        selectedTextMapper = { it.label }
    )
}
