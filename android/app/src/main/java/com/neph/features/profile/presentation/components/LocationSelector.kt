package com.neph.features.profile.presentation.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import com.neph.features.profile.data.DistrictOption
import com.neph.features.profile.data.NeighborhoodOption
import com.neph.features.profile.data.ProvinceOption
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.inputs.AppDropdown
import com.neph.ui.components.inputs.DropdownOption
import com.neph.ui.theme.LocalNephSpacing

@Composable
fun LocationSelector(
    provinceCode: String,
    districtId: String,
    neighborhoodId: String,
    provinces: List<ProvinceOption>,
    districts: List<DistrictOption>,
    neighborhoods: List<NeighborhoodOption>,
    loadingProvinces: Boolean,
    loadingDistricts: Boolean,
    loadingNeighborhoods: Boolean,
    provinceErrorMessage: String? = null,
    districtErrorMessage: String? = null,
    neighborhoodErrorMessage: String? = null,
    onRetryProvinces: (() -> Unit)? = null,
    onRetryDistricts: (() -> Unit)? = null,
    onRetryNeighborhoods: (() -> Unit)? = null,
    onProvinceChange: (String) -> Unit,
    onDistrictChange: (String) -> Unit,
    onNeighborhoodChange: (String) -> Unit,
    provinceError: String? = null,
    districtError: String? = null,
    neighborhoodError: String? = null
) {
    val spacing = LocalNephSpacing.current
    val provinceOptions = provinces.map { DropdownOption(it.name, it.code) }
    val districtOptions = districts.map { DropdownOption(it.name, it.id) }
    val neighborhoodOptions = neighborhoods.map { DropdownOption(it.name, it.id) }

    Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
        AppDropdown(
            value = provinceCode,
            onValueChange = onProvinceChange,
            label = "Province",
            options = listOf(DropdownOption("Select Province", "")) + provinceOptions,
            placeholder = if (loadingProvinces) "Loading provinces..." else "Select province",
            enabled = !loadingProvinces,
            error = provinceError
        )

        if (!provinceErrorMessage.isNullOrBlank()) {
            HelperText(text = provinceErrorMessage)
            if (onRetryProvinces != null) {
                TextActionButton(text = "Retry provinces", onClick = onRetryProvinces)
            }
        }

        AppDropdown(
            value = districtId,
            onValueChange = onDistrictChange,
            label = "District",
            options = listOf(DropdownOption("Select District", "")) + districtOptions,
            placeholder = when {
                provinceCode.isBlank() -> "Select province first"
                loadingDistricts -> "Loading districts..."
                else -> "Select district"
            },
            enabled = provinceCode.isNotBlank() && !loadingDistricts,
            error = districtError
        )

        when {
            provinceCode.isBlank() -> HelperText(text = "Select a province to load districts.")
            !districtErrorMessage.isNullOrBlank() -> {
                HelperText(text = districtErrorMessage)
                if (onRetryDistricts != null) {
                    TextActionButton(text = "Retry districts", onClick = onRetryDistricts)
                }
            }
            !loadingDistricts && districts.isEmpty() -> HelperText(text = "No districts found for this province.")
        }

        AppDropdown(
            value = neighborhoodId,
            onValueChange = onNeighborhoodChange,
            label = "Neighborhood",
            options = listOf(DropdownOption("Select Neighborhood", "")) + neighborhoodOptions,
            placeholder = when {
                districtId.isBlank() -> "Select district first"
                loadingNeighborhoods -> "Loading neighborhoods..."
                else -> "Select neighborhood"
            },
            enabled = districtId.isNotBlank() && !loadingNeighborhoods,
            error = neighborhoodError
        )

        when {
            districtId.isBlank() -> HelperText(text = "Select a district to load neighborhoods.")
            !neighborhoodErrorMessage.isNullOrBlank() -> {
                HelperText(text = neighborhoodErrorMessage)
                if (onRetryNeighborhoods != null) {
                    TextActionButton(text = "Retry neighborhoods", onClick = onRetryNeighborhoods)
                }
            }
            !loadingNeighborhoods && neighborhoods.isEmpty() -> HelperText(text = "No neighborhoods found for this district.")
        }
    }
}
