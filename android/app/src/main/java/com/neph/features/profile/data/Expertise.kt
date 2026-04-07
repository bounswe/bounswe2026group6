package com.neph.features.profile.data

val expertiseOptions = listOf(
    "First Aid",
    "Driving",
    "Search & Rescue",
    "Cooking",
    "Logistics"
)

fun expertiseOptionsFor(selectedExpertise: List<String>): List<String> {
    val extras = selectedExpertise
        .map { it.trim() }
        .filter { it.isNotEmpty() && it !in expertiseOptions }

    return expertiseOptions + extras
}
