package com.neph.features.profile.data

val expertiseOptions = listOf(
    "First Aid"
)

fun normalizeExpertise(selectedExpertise: List<String>): List<String> {
    val allowed = expertiseOptions.first()

    return selectedExpertise
        .map { it.trim() }
        .filter { it.equals(allowed, ignoreCase = true) }
        .map { allowed }
        .distinct()
}

fun expertiseOptionsFor(_selectedExpertise: List<String>): List<String> {
    return expertiseOptions
}
