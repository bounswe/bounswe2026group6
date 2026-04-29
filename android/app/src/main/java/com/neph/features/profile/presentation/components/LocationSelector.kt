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
    enabled: Boolean = true,
    countryError: String? = null,
    cityError: String? = null,
    districtError: String? = null,
    neighborhoodError: String? = null,
    neighborhoodLabel: String = "Neighborhood"
) {
    val countryData = country.takeIf { it.isNotEmpty() }?.let { locationData[it] }

    val countryOptions = locationData
        .map { DropdownOption(it.value.label, it.key) }
        .sortedBy { it.label.lowercase() }
    val cityOptions = countryData?.cities
        ?.map { DropdownOption(it.value.label, it.key) }
        ?.sortedBy { it.label.lowercase() }
        ?: emptyList()
    val districtOptions = countryData?.cities
        ?.get(city)
        ?.districts
        ?.map { DropdownOption(it.value.label, it.key) }
        ?.sortedBy { it.label.lowercase() }
        ?: emptyList()
    val neighborhoodOptions = countryData?.cities
        ?.get(city)
        ?.districts
        ?.get(district)
        ?.neighborhoods
        ?.sortedBy { it.label.lowercase() }
        ?: emptyList()

    AppDropdown(
        value = country,
        onValueChange = { onCountryChange(it); onCityChange(""); onDistrictChange(""); onNeighborhoodChange("") },
        label = "Country",
        options = listOf(DropdownOption("Select Country", "")) + countryOptions,
        enabled = enabled,
        testTag = "complete_profile_country",
        optionTestTagPrefix = "complete_profile_country_option",
        selectedTextMapper = { it.label },
        error = countryError
    )

    AppDropdown(
        value = city,
        onValueChange = { onCityChange(it); onDistrictChange(""); onNeighborhoodChange("") },
        label = "City",
        options = listOf(DropdownOption("Select City", "")) + cityOptions,
        enabled = enabled && country.isNotEmpty(),
        testTag = "complete_profile_city",
        optionTestTagPrefix = "complete_profile_city_option",
        selectedTextMapper = { it.label },
        error = cityError
    )

    AppDropdown(
        value = district,
        onValueChange = { onDistrictChange(it); onNeighborhoodChange("") },
        label = "District",
        options = listOf(DropdownOption("Select District", "")) + districtOptions,
        enabled = enabled && city.isNotEmpty(),
        testTag = "complete_profile_district",
        optionTestTagPrefix = "complete_profile_district_option",
        selectedTextMapper = { it.label },
        error = districtError
    )

    AppDropdown(
        value = neighborhood,
        onValueChange = onNeighborhoodChange,
        label = neighborhoodLabel,
        options = listOf(DropdownOption("Select Neighborhood", "")) + neighborhoodOptions.map { DropdownOption(it.label, it.value) },
        enabled = enabled && district.isNotEmpty(),
        testTag = "complete_profile_neighborhood",
        optionTestTagPrefix = "complete_profile_neighborhood_option",
        selectedTextMapper = { it.label },
        error = neighborhoodError
    )
}
