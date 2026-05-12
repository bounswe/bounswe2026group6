package com.neph.e2e

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.neph.MainActivity
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.profile.data.ProfileData
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.requesthelp.data.RequestHelpContactSubmission
import com.neph.features.requesthelp.data.RequestHelpLocationSubmission
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.features.requesthelp.data.RequestHelpSubmission
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule

class AuthenticatedSessionAndroidE2ETest {
    private val fakeBackend = FakeNephBackend()
    private val seededProfile = FakeProfileState(
        firstName = "Alex",
        lastName = "Helper",
        phoneNumber = "+905551112233",
        age = 30,
        gender = "female",
        height = 172.0,
        weight = 63.0,
        country = "Turkey",
        city = "Istanbul",
        address = "Bostancı, Kadıköy, Existing Street 5"
    )
    private val environmentRule = NephE2ETestEnvironmentRule(fakeBackend) { context, backend ->
        backend.seedVerifiedUser(
            email = "alex.android@example.com",
            password = "Passw0rd!",
            profile = seededProfile
        )

        AuthSessionStore.initialize(context)
        AuthSessionStore.saveAccessToken("access-token-1", rememberMe = true)
        ProfileRepository.initialize(context)
        ProfileRepository.saveProfile(
            ProfileData(
                fullName = "Alex Helper",
                email = "alex.android@example.com"
            )
        )
    }
    private val composeRule = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val ruleChain: TestRule = RuleChain
        .outerRule(environmentRule)
        .around(composeRule)

    @Test
    fun authenticatedUser_can_openProfileFromDrawer() {
        waitForText("I need help now")
        composeRule.onNodeWithText("I need help now").assertIsDisplayed()

        composeRule.onNodeWithContentDescription("Open menu", useUnmergedTree = true).performClick()
        waitForClickable("Profile")
        clickableNode("Profile").performClick()

        waitForText("Alex Helper")
        composeRule.onNodeWithText("Alex Helper").assertIsDisplayed()
        composeRule.onNodeWithText("alex.android@example.com").assertIsDisplayed()
    }

    @Test
    fun authenticatedUser_can_openPrivacySecurityFromSettings_and_logout() {
        waitForText("I need help now")
        composeRule.onNodeWithText("I need help now").assertIsDisplayed()

        composeRule.onNodeWithContentDescription("Open menu", useUnmergedTree = true).performClick()
        waitForClickable("Settings")
        clickableNode("Settings").performClick()

        waitForClickable("Privacy & Security")
        clickableNode("Privacy & Security").performClick()

        waitForText("Profile visibility")
        composeRule.onNodeWithText("Profile visibility").assertIsDisplayed()
        composeRule.onNodeWithText("Save Privacy Settings").performScrollTo().assertIsDisplayed()

        composeRule.activity.runOnUiThread {
            composeRule.activity.onBackPressedDispatcher.onBackPressed()
        }

        waitForClickable("Log Out")
        clickableNode("Log Out").performClick()
        waitForText("Continue as Guest")
        composeRule.onNodeWithText("Continue as Guest").assertIsDisplayed()
    }

    @Test
    fun authenticatedUser_can_deleteAccountFromSettings() {
        waitForText("I need help now")
        composeRule.onNodeWithText("I need help now").assertIsDisplayed()

        composeRule.onNodeWithContentDescription("Open menu", useUnmergedTree = true).performClick()
        waitForClickable("Settings")
        clickableNode("Settings").performClick()

        waitForClickable("Delete Account")
        composeRule.onAllNodes(hasText("Delete Account") and hasClickAction())[0].performClick()

        waitForText("Delete account?")
        composeRule.onNodeWithText("Delete account?").assertIsDisplayed()
        composeRule.onAllNodes(hasText("Delete Account") and hasClickAction())[1].performClick()

        waitForText("Welcome back")
        composeRule.onNodeWithText("Welcome back").assertIsDisplayed()
    }

    @Test
    fun systemBackFromHelpRequestEdit_homeBottomNavReturnsHome() {
        waitForText("I need help now")
        seedActiveHelpRequest()

        waitForClickable("Requests")
        clickableNode("Requests").performClick()
        waitForClickable("Edit Request")

        clickableNode("Edit Request").performClick()
        waitForText("Edit help request?")
        clickableNode("Edit").performClick()

        waitForText("Request Help")
        composeRule.activityRule.scenario.onActivity { activity ->
            activity.onBackPressedDispatcher.onBackPressed()
        }

        waitForText("My Help Requests")
        waitForClickable("Home")
        clickableNode("Home").performClick()

        waitForText("I need help now")
        composeRule.onNodeWithText("I need help now").assertIsDisplayed()
    }

    private fun seedActiveHelpRequest() {
        RequestHelpRepository.initialize(composeRule.activity.applicationContext)
        runBlocking {
            RequestHelpRepository.createHelpRequest(
                token = "access-token-1",
                submission = RequestHelpSubmission(
                    helpTypes = listOf("Search & Rescue"),
                    otherHelpText = "",
                    affectedPeopleCount = 2,
                    description = "Need help after structural damage.",
                    riskFlags = listOf("Fire"),
                    vulnerableGroups = listOf("Children"),
                    shareProfileHealthInfoWithVolunteer = true,
                    location = RequestHelpLocationSubmission(
                        country = "Turkey",
                        city = "Istanbul",
                        district = "Kadıköy",
                        neighborhood = "Bostancı",
                        extraAddress = "Existing Street 5"
                    ),
                    contact = RequestHelpContactSubmission(
                        fullName = "Alex Helper",
                        phone = 905551112233
                    ),
                    consentGiven = true
                )
            )
        }
    }

    private fun clickableNode(text: String) = composeRule.onNode(hasText(text) and hasClickAction())

    private fun waitForClickable(text: String, timeoutMillis: Long = 15_000) {
        composeRule.waitUntil(timeoutMillis) {
            runCatching {
                composeRule.onAllNodes(hasText(text) and hasClickAction()).fetchSemanticsNodes().isNotEmpty()
            }.getOrDefault(false)
        }
    }

    private fun waitForText(text: String, timeoutMillis: Long = 15_000) {
        composeRule.waitUntil(timeoutMillis) {
            runCatching {
                composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
            }.getOrDefault(false)
        }
    }
}
