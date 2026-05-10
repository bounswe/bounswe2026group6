package com.neph.features.auth.util

fun isValidEmail(email: String): Boolean {
    val normalized = email.trim()
    if (normalized.isEmpty()) {
        return false
    }

    // Keep validation permissive in UI and avoid domain-extension bias (.com-only behavior).
    return UiEmailRegex.matches(normalized)
}

private val UiEmailRegex = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")