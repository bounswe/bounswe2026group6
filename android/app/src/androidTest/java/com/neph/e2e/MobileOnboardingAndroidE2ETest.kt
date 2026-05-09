package com.neph.e2e

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.neph.MainActivity
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.onboarding.data.MobileOnboardingStore
import com.neph.features.profile.data.ProfileData
import com.neph.features.profile.data.ProfileRepository
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule

class MobileOnboardingAndroidE2ETest {
    private val fakeBackend = FakeNephBackend()
    private val seededProfile = FakeProfileState(
        firstName = "Mina",
        lastName = "Onboard",
        phoneNumber = "+905551112244",
        age = 28,
        gender = "female",
        height = 168.0,
        weight = 58.0,
        country = "Turkey",
        city = "Istanbul",
        address = "Kadıköy, Test Street 8"
    )
    private val environmentRule = NephE2ETestEnvironmentRule(fakeBackend) { context, backend ->
        backend.seedVerifiedUser(
            email = "mina.onboarding@example.com",
            password = "Passw0rd!",
            profile = seededProfile
        )

        AuthSessionStore.initialize(context)
        AuthSessionStore.saveAccessToken("access-token-1", rememberMe = true, userId = "user-1")
        ProfileRepository.initialize(context)
        ProfileRepository.saveProfile(
            ProfileData(
                firstName = "Mina",
                lastName = "Onboard",
                fullName = "Mina Onboard",
                email = "mina.onboarding@example.com"
            )
        )
        MobileOnboardingStore.initialize(context)
        MobileOnboardingStore.markPendingForCurrentUser()
    }
    private val composeRule = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val ruleChain: TestRule = RuleChain
        .outerRule(environmentRule)
        .around(composeRule)

    @Test
    fun pendingAuthenticatedUser_canFollowGuidedCoreConcepts_once() {
        waitForText("I need help now")
        waitForTag("mobile_onboarding_dialog")
        composeRule.onNodeWithTag("mobile_onboarding_title").assertTextEquals("Home Dashboard")
        composeRule.onNodeWithTag("mobile_onboarding_back").assertIsNotEnabled()

        composeRule.onNodeWithTag("home_request_help_action").performClick()
        waitForGuideTitle("Request Help")
        waitForText("Create a help request")
        waitForTag("mobile_onboarding_target_fire_brigade")

        composeRule.onNodeWithTag("mobile_onboarding_target_fire_brigade").performClick()
        waitForGuideTitle("Risk Flags")
        waitForText("You selected Fire Brigade")
        waitForTag("mobile_onboarding_target_fire_risk")

        composeRule.onNodeWithTag("mobile_onboarding_target_fire_risk").performScrollTo().performClick()
        waitForGuideTitle("Confirmation")
        waitForText("You marked fire")

        composeRule.activityRule.scenario.recreate()
        waitForGuideTitle("Confirmation")

        composeRule.onNodeWithTag("mobile_onboarding_skip").performClick()
        waitUntilTagGone("mobile_onboarding_dialog")

        composeRule.activityRule.scenario.recreate()
        waitForText("Request Help")
        waitUntilTagGone("mobile_onboarding_dialog")
    }

    private fun waitForGuideTitle(title: String, timeoutMillis: Long = 15_000) {
        composeRule.waitUntil(timeoutMillis) {
            runCatching {
                composeRule.onNodeWithTag("mobile_onboarding_title").assertTextEquals(title)
                true
            }.getOrDefault(false)
        }
    }

    private fun waitForText(text: String, timeoutMillis: Long = 15_000) {
        composeRule.waitUntil(timeoutMillis) {
            runCatching {
                composeRule.onAllNodesWithText(text, substring = true).fetchSemanticsNodes().isNotEmpty()
            }.getOrDefault(false)
        }
    }

    private fun waitForTag(tag: String, timeoutMillis: Long = 15_000) {
        composeRule.waitUntil(timeoutMillis) {
            hasTag(tag)
        }
    }

    private fun waitUntilTagGone(tag: String, timeoutMillis: Long = 15_000) {
        composeRule.waitUntil(timeoutMillis) {
            !hasTag(tag)
        }
    }

    private fun hasTag(tag: String): Boolean {
        return runCatching {
            composeRule.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
        }.getOrDefault(false)
    }
}
