package com.neph.features.profile.presentation.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.neph.features.profile.data.DistrictOption
import com.neph.features.profile.data.LocationsRepository
import com.neph.features.profile.data.NeighborhoodOption
import com.neph.features.profile.data.ProvinceOption

data class LocationSelectionState(
    val provinces: List<ProvinceOption>,
    val districts: List<DistrictOption>,
    val neighborhoods: List<NeighborhoodOption>,
    val loadingProvinces: Boolean,
    val loadingDistricts: Boolean,
    val loadingNeighborhoods: Boolean,
    val provinceErrorMessage: String,
    val districtErrorMessage: String,
    val neighborhoodErrorMessage: String,
    val retryProvinces: () -> Unit,
    val retryDistricts: () -> Unit,
    val retryNeighborhoods: () -> Unit
)

@Composable
fun rememberLocationSelectionState(
    provinceCode: String,
    districtId: String
): LocationSelectionState {
    var provinces by remember { mutableStateOf<List<ProvinceOption>>(emptyList()) }
    var districts by remember { mutableStateOf<List<DistrictOption>>(emptyList()) }
    var neighborhoods by remember { mutableStateOf<List<NeighborhoodOption>>(emptyList()) }
    var loadingProvinces by remember { mutableStateOf(true) }
    var loadingDistricts by remember { mutableStateOf(false) }
    var loadingNeighborhoods by remember { mutableStateOf(false) }
    var provinceErrorMessage by remember { mutableStateOf("") }
    var districtErrorMessage by remember { mutableStateOf("") }
    var neighborhoodErrorMessage by remember { mutableStateOf("") }
    var provinceReloadTrigger by remember { mutableStateOf(0) }
    var districtReloadTrigger by remember { mutableStateOf(0) }
    var neighborhoodReloadTrigger by remember { mutableStateOf(0) }

    LaunchedEffect(provinceReloadTrigger) {
        try {
            loadingProvinces = true
            provinceErrorMessage = ""
            provinces = LocationsRepository.fetchProvinces(forceRefresh = provinceReloadTrigger > 0)
        } catch (error: Exception) {
            provinces = emptyList()
            provinceErrorMessage = error.message ?: "Could not load provinces."
        } finally {
            loadingProvinces = false
        }
    }

    LaunchedEffect(provinceCode, districtReloadTrigger) {
        if (provinceCode.isBlank()) {
            districts = emptyList()
            districtErrorMessage = ""
            return@LaunchedEffect
        }

        try {
            loadingDistricts = true
            districtErrorMessage = ""
            districts = LocationsRepository.fetchDistricts(
                provinceCode = provinceCode,
                forceRefresh = districtReloadTrigger > 0
            )
        } catch (error: Exception) {
            districts = emptyList()
            districtErrorMessage = error.message ?: "Could not load districts."
        } finally {
            loadingDistricts = false
        }
    }

    LaunchedEffect(provinceCode, districtId, neighborhoodReloadTrigger) {
        if (provinceCode.isBlank() || districtId.isBlank()) {
            neighborhoods = emptyList()
            neighborhoodErrorMessage = ""
            return@LaunchedEffect
        }

        try {
            loadingNeighborhoods = true
            neighborhoodErrorMessage = ""
            neighborhoods = LocationsRepository.fetchNeighborhoods(
                provinceCode = provinceCode,
                districtId = districtId,
                forceRefresh = neighborhoodReloadTrigger > 0
            )
        } catch (error: Exception) {
            neighborhoods = emptyList()
            neighborhoodErrorMessage = error.message ?: "Could not load neighborhoods."
        } finally {
            loadingNeighborhoods = false
        }
    }

    return LocationSelectionState(
        provinces = provinces,
        districts = districts,
        neighborhoods = neighborhoods,
        loadingProvinces = loadingProvinces,
        loadingDistricts = loadingDistricts,
        loadingNeighborhoods = loadingNeighborhoods,
        provinceErrorMessage = provinceErrorMessage,
        districtErrorMessage = districtErrorMessage,
        neighborhoodErrorMessage = neighborhoodErrorMessage,
        retryProvinces = { provinceReloadTrigger += 1 },
        retryDistricts = { districtReloadTrigger += 1 },
        retryNeighborhoods = { neighborhoodReloadTrigger += 1 }
    )
}
