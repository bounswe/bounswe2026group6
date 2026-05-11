package com.neph.features.onboarding.data

data class MobileOnboardingPracticeHelpRequest(
    val helpTypes: List<String>,
    val riskFlags: List<String>,
    val description: String,
    val locationLabel: String,
    val contactName: String?,
    val contactPhone: String?,
    val createdAtLabel: String
)
