package com.neph.features.profile.data

data class ProvinceOption(
    val code: String,
    val id: String,
    val name: String
)

data class DistrictOption(
    val id: String,
    val provinceCode: String,
    val name: String
)

data class NeighborhoodOption(
    val id: String,
    val provinceCode: String,
    val districtId: String,
    val name: String
)
