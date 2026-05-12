package com.neph.features.onboarding.data

import android.content.Context
import android.content.SharedPreferences
import com.neph.BuildConfig
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.profile.data.ProfileRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

object MobileOnboardingStore {
    private const val PrefsName = "neph_mobile_onboarding"
    internal const val PendingPrefix = "mobile_onboarding_pending"
    internal const val SeenPrefix = "mobile_onboarding_seen"
    internal const val CurrentStepPrefix = "mobile_onboarding_current_step"

    private lateinit var prefs: SharedPreferences
    private val revisionState = MutableStateFlow(0)
    val revisionFlow: StateFlow<Int> = revisionState.asStateFlow()

    fun initialize(context: Context) {
        if (!::prefs.isInitialized) {
            prefs = context.applicationContext.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
        }
    }

    fun markPendingForCurrentUser() {
        val userKeys = currentUserKeys()
        if (userKeys.isEmpty()) return
        val firstStep = MobileOnboardingJourney.firstStep(isAuthenticated = true)
        val editor = prefs.edit()
        userKeys.forEach { userKey ->
            editor
                .putBoolean(MobileOnboardingKeys.scopedKey(PendingPrefix, userKey), true)
                .putString(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey), firstStep.id.name)
        }
        editor.apply()
        notifyOnboardingStateChanged()
    }

    fun markPendingForCurrentUserIfUnseen() {
        if (!::prefs.isInitialized) return
        val userKeys = currentUserKeys()
        if (userKeys.isEmpty()) return
        markPendingForUserKeysIfUnseen(userKeys)
    }

    fun markPendingForUserIfUnseen(userId: String?, email: String?) {
        if (!::prefs.isInitialized) return
        val userKeys = candidateUserKeys(userId = userId, email = email)
        if (userKeys.isEmpty()) {
            markPendingForCurrentUserIfUnseen()
            return
        }
        markPendingForUserKeysIfUnseen(userKeys)
    }

    private fun markPendingForUserKeysIfUnseen(userKeys: List<String>) {
        val normalizedUserKeys = userKeys
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .distinct()
        if (normalizedUserKeys.isEmpty()) return

        if (
            normalizedUserKeys.any { userKey ->
                prefs.getBoolean(MobileOnboardingKeys.scopedKey(SeenPrefix, userKey), false)
            }
        ) {
            return
        }

        val storedStep = normalizedUserKeys.firstNotNullOfOrNull { userKey ->
            prefs.getString(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey), null)
                ?.takeIf { it.isNotBlank() }
        }
        val firstStep = MobileOnboardingJourney.firstStep(isAuthenticated = true)
        val stepId = storedStep ?: firstStep.id.name

        val editor = prefs.edit()
        var changed = false
        normalizedUserKeys.forEach { userKey ->
            val pendingKey = MobileOnboardingKeys.scopedKey(PendingPrefix, userKey)
            val currentStepKey = MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey)
            if (!prefs.getBoolean(pendingKey, false)) {
                editor.putBoolean(pendingKey, true)
                changed = true
            }
            if (prefs.getString(currentStepKey, null).isNullOrBlank()) {
                editor.putString(currentStepKey, stepId)
                changed = true
            }
        }

        if (!changed) return

        editor.apply()
        notifyOnboardingStateChanged()
    }

    private fun candidateUserKeys(userId: String?, email: String?): List<String> {
        return buildList {
            userId
                ?.trim()
                ?.takeIf { it.isNotBlank() }
                ?.let { add("user:$it") }
            email
                ?.trim()
                ?.lowercase()
                ?.takeIf { it.isNotBlank() }
                ?.let { add("email:$it") }
        }
    }

    fun restartForCurrentUser() {
        val userKeys = currentUserKeys()
        if (userKeys.isEmpty()) return
        val firstStep = MobileOnboardingJourney.firstStep(isAuthenticated = true)
        val editor = prefs.edit()
        userKeys.forEach { userKey ->
            editor
                .putBoolean(MobileOnboardingKeys.scopedKey(PendingPrefix, userKey), true)
                .remove(MobileOnboardingKeys.scopedKey(SeenPrefix, userKey))
                .putString(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey), firstStep.id.name)
        }
        editor.apply()
        notifyOnboardingStateChanged()
    }

    fun shouldShowForCurrentUser(): Boolean {
        val userKeys = currentUserKeys()
        if (userKeys.isEmpty()) return false

        val pendingKeys = userKeys
            .map { userKey -> MobileOnboardingKeys.scopedKey(PendingPrefix, userKey) }
            .filter { pendingKey -> prefs.getBoolean(pendingKey, false) }
        val pending = pendingKeys.isNotEmpty()
        val seen = userKeys.any { userKey ->
            prefs.getBoolean(MobileOnboardingKeys.scopedKey(SeenPrefix, userKey), false)
        }

        if (pending && seen) {
            val editor = prefs.edit()
            userKeys.forEach { userKey ->
                editor
                    .remove(MobileOnboardingKeys.scopedKey(PendingPrefix, userKey))
                    .remove(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey))
            }
            editor.apply()
            notifyOnboardingStateChanged()
        }

        return MobileOnboardingKeys.shouldShow(pending = pending, seen = seen)
    }

    fun currentStepForCurrentUser(isAuthenticated: Boolean): MobileOnboardingStepId? {
        val userKeys = currentUserKeys()
        if (userKeys.isEmpty()) return null
        val parsed = userKeys.firstNotNullOfOrNull { userKey ->
            prefs.getString(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey), null)
                ?.let { stored -> runCatching { MobileOnboardingStepId.valueOf(stored) }.getOrNull() }
        }
        val valid = parsed?.takeIf { MobileOnboardingJourney.stepFor(it, isAuthenticated) != null }
        if (valid != null) {
            setCurrentStepForUserKeys(userKeys, valid)
            return valid
        }

        val firstStep = MobileOnboardingJourney.firstStep(isAuthenticated)
        setCurrentStepForUserKeys(userKeys, firstStep.id)
        return firstStep.id
    }

    fun setCurrentStepForCurrentUser(stepId: MobileOnboardingStepId) {
        val userKeys = currentUserKeys()
        if (userKeys.isEmpty()) return
        setCurrentStepForUserKeys(userKeys, stepId)
    }

    fun markSeenForCurrentUser() {
        val userKeys = currentUserKeys()
        if (userKeys.isEmpty()) return
        val editor = prefs.edit()
        userKeys.forEach { userKey ->
            editor
                .putBoolean(MobileOnboardingKeys.scopedKey(SeenPrefix, userKey), true)
                .remove(MobileOnboardingKeys.scopedKey(PendingPrefix, userKey))
                .remove(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey))
        }
        editor.apply()
        notifyOnboardingStateChanged()
    }

    fun clearPendingForCurrentUser() {
        val userKeys = currentUserKeys()
        if (userKeys.isEmpty()) return
        val editor = prefs.edit()
        userKeys.forEach { userKey ->
            editor
                .remove(MobileOnboardingKeys.scopedKey(PendingPrefix, userKey))
                .remove(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey))
        }
        editor.apply()
        notifyOnboardingStateChanged()
    }

    fun resetForTesting() {
        requireDebugBuildForTestingReset()
        if (::prefs.isInitialized) {
            prefs.edit().clear().commit()
        }
        notifyOnboardingStateChanged()
    }

    private fun notifyOnboardingStateChanged() {
        revisionState.update { revision -> revision + 1 }
    }

    private fun setCurrentStepForUserKeys(userKeys: List<String>, stepId: MobileOnboardingStepId) {
        val editor = prefs.edit()
        userKeys.forEach { userKey ->
            editor.putString(MobileOnboardingKeys.scopedKey(CurrentStepPrefix, userKey), stepId.name)
        }
        editor.apply()
    }

    private fun currentUserKeys(): List<String> {
        ensureInitialized()
        if (AuthSessionStore.getAccessToken().isNullOrBlank()) {
            return emptyList()
        }

        val userId = AuthSessionStore.getCurrentUserId()
            ?.trim()
            ?.takeIf { it.isNotBlank() }

        val email = runCatching { ProfileRepository.getProfile().email }
            .getOrNull()
            ?.trim()
            ?.lowercase()
            ?.takeIf { it.isNotBlank() }

        return candidateUserKeys(userId = userId, email = email)
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
