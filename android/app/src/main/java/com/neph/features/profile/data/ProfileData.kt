package com.neph.features.profile.data

data class ProfileData(
    val firstName: String? = null,
    val lastName: String? = null,
    val fullName: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val profession: String? = null,
    val expertise: List<String> = emptyList(),

    val height: Float? = null,
    val weight: Float? = null,
    val bloodType: String? = null,
    val gender: String? = null,
    val dateOfBirth: String? = null,
    val age: Int? = null,

    val medicalHistory: String? = null,

    val chronicDiseases: String? = null,
    val allergies: String? = null,

    val country: String? = null,
    val city: String? = null,
    val district: String? = null,
    val neighborhood: String? = null,
    val extraAddress: String? = null,

    val profileVisibility: String? = null,
    val healthInfoVisibility: String? = null,
    val locationVisibility: String? = null,
    val shareLocation: Boolean? = null,
    val sharedLatitude: Double? = null,
    val sharedLongitude: Double? = null
)
