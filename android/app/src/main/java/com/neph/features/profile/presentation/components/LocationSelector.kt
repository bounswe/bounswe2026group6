package com.neph.features.profile.presentation.components

import androidx.compose.runtime.Composable
import com.neph.features.profile.data.LocationData
import com.neph.ui.components.inputs.AppDropdown
import com.neph.ui.components.inputs.DropdownOption

@Composable
fun LocationSelector(
    country: String,
    city: String,
    district: String,
    neighborhood: String,
    onCountryChange: (String) -> Unit,
    onCityChange: (String) -> Unit,
    onDistrictChange: (String) -> Unit,
    onNeighborhoodChange: (String) -> Unit,
    locationData: LocationData,
    countryError: String? = null,
    cityError: String? = null,
    districtError: String? = null,
    neighborhoodError: String? = null
) {
    val countryData = country.takeIf { it.isNotEmpty() }?.let { locationData[it] }
    
    val cityOptions = countryData?.cities?.map { DropdownOption(it.value.label, it.key) } ?: emptyList()
    val districtOptions = countryData?.cities?.get(city)?.districts?.map { DropdownOption(it.value.label, it.key) } ?: emptyList()
    val neighborhoodOptions = countryData?.cities?.get(city)?.districts?.get(district)?.neighborhoods ?: emptyList()
    
    AppDropdown(
        value = country,
        onValueChange = { onCountryChange(it); onCityChange(""); onDistrictChange(""); onNeighborhoodChange("") },
        label = "Country",
        options = listOf(DropdownOption("Select Country", "")) + locationData.map { DropdownOption(it.value.label, it.key) },
        selectedTextMapper = { it.label },
        error = countryError
    )
    
    AppDropdown(
        value = city,
        onValueChange = { onCityChange(it); onDistrictChange(""); onNeighborhoodChange("") },
        label = "City",
        options = listOf(DropdownOption("Select City", "")) + cityOptions,
        enabled = country.isNotEmpty(),
        selectedTextMapper = { it.label },
        error = cityError
    )
    
    AppDropdown(
        value = district,
        onValueChange = { onDistrictChange(it); onNeighborhoodChange("") },
        label = "District",
        options = listOf(DropdownOption("Select District", "")) + districtOptions,
        enabled = city.isNotEmpty(),
        selectedTextMapper = { it.label },
        error = districtError
    )
    
    AppDropdown(
        value = neighborhood,
        onValueChange = onNeighborhoodChange,
        label = "Neighborhood",
        options = listOf(DropdownOption("Select Neighborhood", "")) + neighborhoodOptions.map { DropdownOption(it.label, it.value) },
        enabled = district.isNotEmpty(),
        selectedTextMapper = { it.label },
        error = neighborhoodError
    )
}
