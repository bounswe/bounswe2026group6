package com.neph.features.onboarding.data

import android.content.Context
import android.content.SharedPreferences
import com.neph.BuildConfig
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.profile.data.ProfileRepository

object MobileOnboardingStore {
    private const val PrefsName = "neph_mobile_onboarding"
    internal const val PendingPrefix = "mobile_onboarding_pending"
    internal const val SeenPrefix = "mobile_onboarding_seen"
    internal const val CurrentStepPrefix = "mobile_onboarding_current_step"

    private lateinit var prefs: SharedPreferences

    fun initialize(context: Context) {
        if (!::prefs.isInitialized) {
            prefs = context.applicationContext.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
        }
    }

    fun markPendingForCurrentUser() {
        val userKey = currentUserKey() ?: return
        val firstStep = MobileOnboardingJourney.firstStep(isAuthenticated = true)
        prefs.edit()
            .putBoolean(MobileOnboardingKeys.scopedKey(PendingPrefix, userKey), true)
            .putString(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey), firstStep.id.name)
            .apply()
    }

    fun restartForCurrentUser() {
        val userKey = currentUserKey() ?: return
        val firstStep = MobileOnboardingJourney.firstStep(isAuthenticated = true)
        prefs.edit()
            .putBoolean(MobileOnboardingKeys.scopedKey(PendingPrefix, userKey), true)
            .remove(MobileOnboardingKeys.scopedKey(SeenPrefix, userKey))
            .putString(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey), firstStep.id.name)
            .apply()
    }

    fun shouldShowForCurrentUser(): Boolean {
        val userKey = currentUserKey() ?: return false
        val pendingKey = MobileOnboardingKeys.scopedKey(PendingPrefix, userKey)
        val seenKey = MobileOnboardingKeys.scopedKey(SeenPrefix, userKey)
        val pending = prefs.getBoolean(pendingKey, false)
        val seen = prefs.getBoolean(seenKey, false)

        if (pending && seen) {
            prefs.edit().remove(pendingKey).apply()
        }

        return MobileOnboardingKeys.shouldShow(pending = pending, seen = seen)
    }

    fun currentStepForCurrentUser(isAuthenticated: Boolean): MobileOnboardingStepId? {
        val userKey = currentUserKey() ?: return null
        val stored = prefs.getString(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey), null)
        val parsed = stored?.let { runCatching { MobileOnboardingStepId.valueOf(it) }.getOrNull() }
        val valid = parsed?.takeIf { MobileOnboardingJourney.stepFor(it, isAuthenticated) != null }
        if (valid != null) return valid

        val firstStep = MobileOnboardingJourney.firstStep(isAuthenticated)
        setCurrentStepForCurrentUser(firstStep.id)
        return firstStep.id
    }

    fun setCurrentStepForCurrentUser(stepId: MobileOnboardingStepId) {
        val userKey = currentUserKey() ?: return
        prefs.edit()
            .putString(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey), stepId.name)
            .apply()
    }

    fun markSeenForCurrentUser() {
        val userKey = currentUserKey() ?: return
        prefs.edit()
            .putBoolean(MobileOnboardingKeys.scopedKey(SeenPrefix, userKey), true)
            .remove(MobileOnboardingKeys.scopedKey(PendingPrefix, userKey))
            .remove(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey))
            .apply()
    }

    fun clearPendingForCurrentUser() {
        val userKey = currentUserKey() ?: return
        prefs.edit()
            .remove(MobileOnboardingKeys.scopedKey(PendingPrefix, userKey))
            .remove(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey))
            .apply()
    }

    fun resetForTesting() {
        requireDebugBuildForTestingReset()
        if (::prefs.isInitialized) {
            prefs.edit().clear().commit()
        }
    }

    private fun currentUserKey(): String? {
        ensureInitialized()
        if (AuthSessionStore.getAccessToken().isNullOrBlank()) {
            return null
        }

        AuthSessionStore.getCurrentUserId()
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?.let { return "user:$it" }

        val email = runCatching { ProfileRepository.getProfile().email }
            .getOrNull()
            ?.trim()
            ?.lowercase()
            ?.takeIf { it.isNotBlank() }
        return email?.let { "email:$it" }
    }

    private fun ensureInitialized() {
        check(::prefs.isInitialized) {
            "MobileOnboardingStore must be initialized before use."
        }
    }

    private fun requireDebugBuildForTestingReset() {
        check(BuildConfig.DEBUG) {
            "MobileOnboardingStore.resetForTesting() is only available in debug/e2e test builds."
        }
    }
}

internal object MobileOnboardingKeys {
    fun scopedKey(prefix: String, userKey: String): String {
        val sanitizedUserKey = userKey.trim().lowercase().replace(Regex("[^a-z0-9:_@.+-]"), "_")
        return "${prefix}_${sanitizedUserKey}"
    }

    fun shouldShow(pending: Boolean, seen: Boolean): Boolean = pending && !seen
}
