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
        assertFalse(guestSteps.any { it.id == MobileOnboardingStepId.OPEN_ASSIGNED_REQUESTS_MENU })
        assertFalse(guestSteps.any { it.id == MobileOnboardingStepId.SELECT_ASSIGNED_REQUEST })
        assertFalse(guestSteps.any { it.id == MobileOnboardingStepId.ASSIGNED_REQUESTS })
        assertFalse(guestSteps.any { it.id == MobileOnboardingStepId.SETTINGS })
    }

    @Test
    fun journeyKeepsCoreRoutesInGuidedOrderForAuthenticatedUsers() {
        val authenticatedSteps = MobileOnboardingJourney.availableSteps(isAuthenticated = true)

        assertEquals(
            listOf(
                MobileOnboardingStepId.HOME_DASHBOARD,
                MobileOnboardingStepId.REQUEST_HELP_TYPE,
                MobileOnboardingStepId.REQUEST_HELP_RISK_FIRE,
                MobileOnboardingStepId.REQUEST_HELP_CONFIRM,
                MobileOnboardingStepId.REQUEST_HELP_SEND,
                MobileOnboardingStepId.MY_HELP_REQUESTS,
                MobileOnboardingStepId.OPEN_ASSIGNED_REQUESTS_MENU,
                MobileOnboardingStepId.SELECT_ASSIGNED_REQUEST,
                MobileOnboardingStepId.ASSIGNED_REQUESTS,
                MobileOnboardingStepId.OPEN_EMERGENCY_NUMBERS_MENU,
                MobileOnboardingStepId.SELECT_EMERGENCY_NUMBERS,
                MobileOnboardingStepId.EMERGENCY_NUMBERS,
                MobileOnboardingStepId.OPEN_HELP_REQUEST_MAP_MENU,
                MobileOnboardingStepId.SELECT_HELP_REQUEST_MAP,
                MobileOnboardingStepId.HELP_REQUEST_MAP,
                MobileOnboardingStepId.OPEN_NEARBY_USERS_MENU,
                MobileOnboardingStepId.SELECT_NEARBY_USERS,
                MobileOnboardingStepId.NEARBY_USERS,
                MobileOnboardingStepId.OPEN_GATHERING_AREAS_MENU,
                MobileOnboardingStepId.SELECT_GATHERING_AREAS,
                MobileOnboardingStepId.GATHERING_AREAS,
                MobileOnboardingStepId.OPEN_SAFETY_CIRCLES_MENU,
                MobileOnboardingStepId.SELECT_SAFETY_CIRCLES,
                MobileOnboardingStepId.SAFETY_CIRCLES,
                MobileOnboardingStepId.OPEN_NOTIFICATIONS_MENU,
                MobileOnboardingStepId.SELECT_NOTIFICATIONS,
                MobileOnboardingStepId.NOTIFICATIONS,
                MobileOnboardingStepId.OPEN_SETTINGS_MENU,
                MobileOnboardingStepId.SELECT_SETTINGS,
                MobileOnboardingStepId.SETTINGS
            ),
            authenticatedSteps.map { it.id }
        )
        assertEquals(Routes.RequestHelp.route, authenticatedSteps[1].route)
        assertEquals(Routes.MyHelpRequests.route, authenticatedSteps[5].route)
        assertEquals(Routes.Settings.route, authenticatedSteps.last().route)
        assertEquals(Routes.AssignedRequest.route, authenticatedSteps[8].route)
    }

    @Test
    fun journeyCanMoveForwardAndBackward() {
        assertEquals(
            MobileOnboardingStepId.REQUEST_HELP_TYPE,
            MobileOnboardingJourney.nextStep(MobileOnboardingStepId.HOME_DASHBOARD, isAuthenticated = true)?.id
        )
        assertEquals(
            MobileOnboardingStepId.HOME_DASHBOARD,
            MobileOnboardingJourney.previousStep(MobileOnboardingStepId.REQUEST_HELP_TYPE, isAuthenticated = true)?.id
        )
        assertNull(MobileOnboardingJourney.previousStep(MobileOnboardingStepId.HOME_DASHBOARD, isAuthenticated = true))
    }
}
