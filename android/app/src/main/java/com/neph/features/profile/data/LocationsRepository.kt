package com.neph.features.profile.data

import com.neph.core.network.JsonHttpClient
import org.json.JSONObject

object LocationsRepository {
    private var provincesCache: List<ProvinceOption>? = null
    private val districtsCache = mutableMapOf<String, List<DistrictOption>>()
    private val neighborhoodsCache = mutableMapOf<String, List<NeighborhoodOption>>()

    suspend fun fetchProvinces(forceRefresh: Boolean = false): List<ProvinceOption> {
        if (!forceRefresh) {
            provincesCache?.let { return it }
        }

        val response = JsonHttpClient.request(path = "/locations/provinces")
        val provinces = response.optJSONArray("provinces").toProvinceOptions()
        provincesCache = provinces
        return provinces
    }

    suspend fun fetchDistricts(provinceCode: String, forceRefresh: Boolean = false): List<DistrictOption> {
        val normalizedProvinceCode = provinceCode.trim()
        if (normalizedProvinceCode.isBlank()) {
            return emptyList()
        }

        if (!forceRefresh) {
            districtsCache[normalizedProvinceCode]?.let { return it }
        }

        val response = JsonHttpClient.request(
            path = "/locations/districts?provinceCode=$normalizedProvinceCode"
        )
        val districts = response.optJSONArray("districts").toDistrictOptions()
        districtsCache[normalizedProvinceCode] = districts
        return districts
    }

    suspend fun fetchNeighborhoods(
        provinceCode: String,
        districtId: String,
        forceRefresh: Boolean = false
    ): List<NeighborhoodOption> {
        val normalizedProvinceCode = provinceCode.trim()
        val normalizedDistrictId = districtId.trim()
        if (normalizedProvinceCode.isBlank() || normalizedDistrictId.isBlank()) {
            return emptyList()
        }

        val cacheKey = "$normalizedProvinceCode:$normalizedDistrictId"
        if (!forceRefresh) {
            neighborhoodsCache[cacheKey]?.let { return it }
        }

        val response = JsonHttpClient.request(
            path = "/locations/neighborhoods?provinceCode=$normalizedProvinceCode&districtId=$normalizedDistrictId"
        )
        val neighborhoods = response.optJSONArray("neighborhoods").toNeighborhoodOptions()
        neighborhoodsCache[cacheKey] = neighborhoods
        return neighborhoods
    }

    private fun org.json.JSONArray?.toProvinceOptions(): List<ProvinceOption> {
        if (this == null) {
            return emptyList()
        }

        return buildList {
            for (index in 0 until length()) {
                val item = optJSONObject(index) ?: continue
                val code = item.optString("code").trim()
                val id = item.optString("id").trim()
                val name = item.optString("name").trim()
                if (code.isNotBlank() && id.isNotBlank() && name.isNotBlank()) {
                    add(ProvinceOption(code = code, id = id, name = name))
                }
            }
        }
    }

    private fun org.json.JSONArray?.toDistrictOptions(): List<DistrictOption> {
        if (this == null) {
            return emptyList()
        }

        return buildList {
            for (index in 0 until length()) {
                val item = optJSONObject(index) ?: continue
                val id = item.optString("id").trim()
                val provinceCode = item.optString("provinceCode").trim()
                val name = item.optString("name").trim()
                if (id.isNotBlank() && provinceCode.isNotBlank() && name.isNotBlank()) {
                    add(DistrictOption(id = id, provinceCode = provinceCode, name = name))
                }
            }
        }
    }

    private fun org.json.JSONArray?.toNeighborhoodOptions(): List<NeighborhoodOption> {
        if (this == null) {
            return emptyList()
        }

        return buildList {
            for (index in 0 until length()) {
                val item = optJSONObject(index) ?: continue
                val id = item.optString("id").trim()
                val provinceCode = item.optString("provinceCode").trim()
                val districtId = item.optString("districtId").trim()
                val name = item.optString("name").trim()
                if (id.isNotBlank() && provinceCode.isNotBlank() && districtId.isNotBlank() && name.isNotBlank()) {
                    add(
                        NeighborhoodOption(
                            id = id,
                            provinceCode = provinceCode,
                            districtId = districtId,
                            name = name
                        )
                    )
                }
            }
        }
    }
}
