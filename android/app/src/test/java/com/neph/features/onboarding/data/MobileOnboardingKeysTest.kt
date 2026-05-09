package com.neph.features.onboarding.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileOnboardingKeysTest {
    @Test
    fun shouldShowOnlyWhenPendingAndNotSeen() {
        assertTrue(MobileOnboardingKeys.shouldShow(pending = true, seen = false))
        assertFalse(MobileOnboardingKeys.shouldShow(pending = true, seen = true))
        assertFalse(MobileOnboardingKeys.shouldShow(pending = false, seen = false))
        assertFalse(MobileOnboardingKeys.shouldShow(pending = false, seen = true))
    }

    @Test
    fun scopedKeyKeepsStatePerUserAndSanitizesUnsafeCharacters() {
        assertEquals(
            "mobile_onboarding_seen_user:user-1",
            MobileOnboardingKeys.scopedKey("mobile_onboarding_seen", "user:User-1")
        )
        assertEquals(
            "mobile_onboarding_pending_email:person+test@example.com",
            MobileOnboardingKeys.scopedKey("mobile_onboarding_pending", "email:Person+Test@Example.com")
        )
        assertEquals(
            "mobile_onboarding_seen_user:abc_123",
            MobileOnboardingKeys.scopedKey("mobile_onboarding_seen", "user:abc 123")
        )
    }
}
