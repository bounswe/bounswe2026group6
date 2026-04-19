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
import com.neph.MainActivity
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.profile.data.ProfileData
import com.neph.features.profile.data.ProfileRepository
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
        waitForText("Request Help")
        composeRule.onNodeWithText("Request Help").assertIsDisplayed()

        composeRule.onNodeWithContentDescription("Open menu").performClick()
        waitForClickable("Profile")
        clickableNode("Profile").performClick()

        waitForText("Alex Helper")
        composeRule.onNodeWithText("Alex Helper").assertIsDisplayed()
        composeRule.onNodeWithText("alex.android@example.com").assertIsDisplayed()
    }

    @Test
    fun authenticatedUser_can_openPrivacySecurity_and_logout() {
        waitForText("Request Help")
        composeRule.onNodeWithText("Request Help").assertIsDisplayed()

        composeRule.onAllNodesWithContentDescription("Open settings")[0].performClick()
        waitForClickable("Privacy & Security")
        clickableNode("Privacy & Security").performClick()

        waitForText("Temporary placeholder screen.")
        composeRule.onNodeWithText("Temporary placeholder screen.").assertIsDisplayed()

        composeRule.activity.runOnUiThread {
            composeRule.activity.onBackPressedDispatcher.onBackPressed()
        }

        waitForClickable("Log Out")
        clickableNode("Log Out").performClick()
        waitForText("Continue as Guest")
        composeRule.onNodeWithText("Continue as Guest").assertIsDisplayed()
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
