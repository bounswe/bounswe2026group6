package com.neph.e2e

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOn
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
        reachAssignedRequestsPage()

        continueThroughDrawerPage(
            pageTitle = "Emergency Numbers",
            menuTargetTag = "mobile_onboarding_target_menu_emergency_info",
            menuInstruction = "Tap Emergency Numbers",
            pageText = "Emergency Contact List"
        )
        continueThroughDrawerPage(
            pageTitle = "Help Request Map",
            menuTargetTag = "mobile_onboarding_target_menu_help_request_map",
            menuInstruction = "Tap Help Request Map",
            pageText = "Showing waiting help requests"
        )
        continueThroughDrawerPage(
            pageTitle = "Nearby Users",
            menuTargetTag = "mobile_onboarding_target_menu_nearby_users",
            menuInstruction = "Tap Nearby Users",
            pageText = "Based on your residential"
        )
        continueThroughDrawerPage(
            pageTitle = "Gathering Areas",
            menuTargetTag = "mobile_onboarding_target_menu_gathering_areas",
            menuInstruction = "Tap Gathering Areas",
            pageText = "Location-based assembly"
        )
        continueThroughDrawerPage(
            pageTitle = "Safety Circles",
            menuTargetTag = "mobile_onboarding_target_menu_safety_circles",
            menuInstruction = "Tap Safety Circles",
            pageText = "Create Circle"
        )
        continueThroughDrawerPage(
            pageTitle = "Notifications",
            menuTargetTag = "mobile_onboarding_target_menu_notifications",
            menuInstruction = "Tap Notifications",
            pageText = "Notifications"
        )
        continueThroughDrawerPage(
            pageTitle = "Settings",
            menuTargetTag = "mobile_onboarding_target_menu_settings",
            menuInstruction = "Tap Settings",
            pageText = "Appearance"
        )

        composeRule.onNodeWithTag("mobile_onboarding_finish").performClick()
        waitUntilTagGone("mobile_onboarding_dialog")
        waitForText("I need help now")

        composeRule.activityRule.scenario.recreate()
        waitForText("I need help now")
        waitUntilTagGone("mobile_onboarding_dialog")
    }

    @Test
    fun skippingTutorialMidway_returnsUserHome() {
        reachAssignedRequestsPage()
        continueThroughDrawerPage(
            pageTitle = "Emergency Numbers",
            menuTargetTag = "mobile_onboarding_target_menu_emergency_info",
            menuInstruction = "Tap Emergency Numbers",
            pageText = "Emergency Contact List"
        )

        composeRule.onNodeWithTag("mobile_onboarding_skip").performClick()
        waitUntilTagGone("mobile_onboarding_dialog")
        waitForText("I need help now")
    }

    private fun reachAssignedRequestsPage() {
        waitForText("I need help now")
        waitForTag("mobile_onboarding_dialog")
        waitForTag("mobile_onboarding_welcome_message")
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
        waitForTag("mobile_onboarding_confirmation_checkbox")

        composeRule.onNodeWithTag("mobile_onboarding_confirmation_checkbox").performScrollTo().performClick()
        waitForGuideTitle("Send Help Request")
        composeRule.onNodeWithTag("mobile_onboarding_confirmation_checkbox").assertIsOn()
        waitForTag("mobile_onboarding_target_send_help_request")

        composeRule.onNodeWithTag("mobile_onboarding_target_send_help_request").performScrollTo().performClick()
        waitForGuideTitle("My Help Requests")
        waitForText("No real help request was saved")
        waitForText("Guide preview only")
        waitForText("Fire Brigade")

        composeRule.onNodeWithTag("mobile_onboarding_continue").performClick()
        waitForGuideTitle("Open the Menu")
        waitForTag("mobile_onboarding_target_menu")

        composeRule.onNodeWithTag("mobile_onboarding_target_menu").performClick()
        waitForGuideTitle("Assigned Request")
        waitForText("Tap Assigned Request")
        waitForTag("mobile_onboarding_target_assigned_request_menu")

        composeRule.onNodeWithTag("mobile_onboarding_target_assigned_request_menu").performClick()
        waitForGuideTitle("Assigned Requests")
        waitForText("There is no assigned request for you right now.")
        waitForText("No assigned request right now.")

    }


    private fun continueThroughDrawerPage(
        pageTitle: String,
        menuTargetTag: String,
        menuInstruction: String,
        pageText: String
    ) {
        composeRule.onNodeWithTag("mobile_onboarding_continue").performClick()
        waitForGuideTitle("Open the Menu")
        waitForTag("mobile_onboarding_target_menu")

        composeRule.onNodeWithTag("mobile_onboarding_target_menu").performClick()
        waitForText(menuInstruction)
        waitForTag(menuTargetTag)

        composeRule.onNodeWithTag(menuTargetTag).performScrollTo().performClick()
        waitForGuideTitle(pageTitle)
        waitForText(pageText)
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
