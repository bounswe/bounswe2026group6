package com.neph.features.onboarding.data

import com.neph.navigation.Routes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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

    @Test
    fun journeySkipsAuthenticatedOnlyStepsForGuests() {
        val guestSteps = MobileOnboardingJourney.availableSteps(isAuthenticated = false)

        assertEquals(MobileOnboardingStepId.HOME_DASHBOARD, guestSteps.first().id)
        assertFalse(guestSteps.any { it.id == MobileOnboardingStepId.ASSIGNED_REQUESTS })
        assertFalse(guestSteps.any { it.id == MobileOnboardingStepId.PROFILE_PRIVACY })
    }

    @Test
    fun journeyKeepsCoreRoutesInGuidedOrderForAuthenticatedUsers() {
        val authenticatedSteps = MobileOnboardingJourney.availableSteps(isAuthenticated = true)

        assertEquals(
            listOf(
                MobileOnboardingStepId.HOME_DASHBOARD,
                MobileOnboardingStepId.REQUEST_HELP_BACK,
                MobileOnboardingStepId.HOME_REQUEST_HELP_REOPEN,
                MobileOnboardingStepId.REQUEST_HELP_TYPE,
                MobileOnboardingStepId.REQUEST_HELP_RISK_FIRE,
                MobileOnboardingStepId.REQUEST_HELP_CONFIRM,
                MobileOnboardingStepId.REQUEST_HELP_SEND,
                MobileOnboardingStepId.MY_HELP_REQUESTS,
                MobileOnboardingStepId.HELP_REQUEST_MAP,
                MobileOnboardingStepId.GATHERING_AREAS,
                MobileOnboardingStepId.EMERGENCY_NUMBERS,
                MobileOnboardingStepId.NEWS,
                MobileOnboardingStepId.VOLUNTEER_AVAILABILITY,
                MobileOnboardingStepId.ASSIGNED_REQUESTS,
                MobileOnboardingStepId.PROFILE_PRIVACY
            ),
            authenticatedSteps.map { it.id }
        )
        assertEquals(Routes.RequestHelp.route, authenticatedSteps[1].route)
        assertEquals(Routes.Profile.route, authenticatedSteps.last().route)
    }

    @Test
    fun journeyCanMoveForwardAndBackward() {
        assertEquals(
            MobileOnboardingStepId.REQUEST_HELP_BACK,
            MobileOnboardingJourney.nextStep(MobileOnboardingStepId.HOME_DASHBOARD, isAuthenticated = true)?.id
        )
        assertEquals(
            MobileOnboardingStepId.HOME_REQUEST_HELP_REOPEN,
            MobileOnboardingJourney.previousStep(MobileOnboardingStepId.REQUEST_HELP_TYPE, isAuthenticated = true)?.id
        )
        assertNull(MobileOnboardingJourney.previousStep(MobileOnboardingStepId.HOME_DASHBOARD, isAuthenticated = true))
    }
}
