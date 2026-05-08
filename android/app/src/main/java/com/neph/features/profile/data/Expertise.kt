package com.neph.features.profile.data

val expertiseOptions = listOf(
    "Do you know first aid?"
)

fun normalizeExpertise(selectedExpertise: List<String>): List<String> {
    val allowed = expertiseOptions.first()

    return selectedExpertise
        .map { it.trim() }
        .filter { it.equals(allowed, ignoreCase = true) || it.equals("First Aid", ignoreCase = true) }
        .map { allowed }
        .distinct()
}

fun expertiseOptionsFor(_selectedExpertise: List<String>): List<String> {
    return expertiseOptions
}
