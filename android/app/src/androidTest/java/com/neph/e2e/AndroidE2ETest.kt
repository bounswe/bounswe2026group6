package com.neph.e2e

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import com.neph.MainActivity
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule

class AndroidE2ETest {
    private val fakeBackend = FakeNephBackend()
    private val environmentRule = NephE2ETestEnvironmentRule(fakeBackend)
    private val composeRule = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val ruleChain: TestRule = RuleChain
        .outerRule(environmentRule)
        .around(composeRule)

    @Test
    fun guest_can_continueToHome() {
        waitForClickable("Continue as Guest")
        clickableNode("Continue as Guest").performClick()

        waitForText("Create Help Request")
        composeRule.onNodeWithText("Create Help Request").assertIsDisplayed()
    }

    @Test
    fun guest_can_openHelpRequestMap_andSeeWaitingRequests() {
        waitForClickable("Continue as Guest")
        clickableNode("Continue as Guest").performClick()

        waitForText("Create Help Request")
        composeRule.onAllNodesWithContentDescription("Open menu")[0].performClick()
        waitForClickable("Help Request Map")
        clickableNode("Help Request Map").performClick()

        waitForText("Showing waiting help requests by type and priority.")
        composeRule.onAllNodesWithText("Help Request Map")[0].assertIsDisplayed()

        composeRule.waitUntil(5_000) {
            contentDescriptionNodeCount("Crisis marker") == 2 &&
                textNodeCount("First Aid") > 0 &&
                textNodeCount("Shelter") > 0 &&
                textNodeCount("Priority: High") > 0 &&
                textNodeCount("Waiting Requests") > 0 &&
                textNodeCount("Search and Rescue") == 0 &&
                textNodeCount("sariyer") == 0
        }
    }

    @Test
    fun forgotPassword_flow_can_reach_resetScreen() {
        val email = "reset.android@example.com"
        val password = "Passw0rd!"

        fakeBackend.seedVerifiedUser(email = email, password = password)

        waitForClickable("Log In")
        clickableNode("Log In").performClick()
        openEmailFormIfNeeded("login_email")
        waitForTag("login_email")
        clickableNode("Forgot password?").performClick()

        waitForTag("forgot_password_email")
        composeRule.onNodeWithTag("forgot_password_email").performTextInput(email)
        clickableNode("Send Reset Link").performClick()
        waitForText("Password reset email sent. Please check your inbox.")
        composeRule.onNodeWithText("Password reset email sent. Please check your inbox.")
            .assertIsDisplayed()

        clickableNode("I have a reset link").performClick()
        waitForTag("reset_password_token")
        composeRule.onNodeWithTag("reset_password_token").assertIsDisplayed()
    }

    private fun openEmailFormIfNeeded(fieldTag: String) {
        composeRule.waitUntil(5_000) {
            hasTag(fieldTag) || hasClickableText("Continue with Email")
        }

        if (hasTag(fieldTag)) {
            return
        }

        clickableNode("Continue with Email").performClick()
        waitForTag(fieldTag)
    }

    private fun selectDropdown(fieldTag: String, optionTag: String) {
        composeRule.onNodeWithTag(fieldTag)
            .performScrollTo()
            .performClick()
        composeRule.onNodeWithTag(optionTag, useUnmergedTree = true).performClick()
    }

    private fun clickableNode(text: String) = composeRule.onNode(
        hasText(text) and hasClickAction()
    )

    private fun waitForClickable(text: String, timeoutMillis: Long = 15_000) {
        composeRule.waitUntil(timeoutMillis) {
            hasClickableText(text)
        }
    }

    private fun waitForTag(tag: String, timeoutMillis: Long = 15_000) {
        composeRule.waitUntil(timeoutMillis) {
            hasTag(tag)
        }
    }

    private fun waitForText(text: String, timeoutMillis: Long = 15_000) {
        composeRule.waitUntil(timeoutMillis) {
            hasTextNode(text)
        }
    }

    private fun hasClickableText(text: String): Boolean {
        return runCatching {
            composeRule.onAllNodes(hasText(text) and hasClickAction()).fetchSemanticsNodes().isNotEmpty()
        }.getOrDefault(false)
    }

    private fun hasTag(tag: String): Boolean {
        return runCatching {
            composeRule.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
        }.getOrDefault(false)
    }

    private fun hasTextNode(text: String): Boolean {
        return runCatching {
            composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }.getOrDefault(false)
    }

    private fun textNodeCount(text: String): Int {
        return runCatching {
            composeRule.onAllNodesWithText(text).fetchSemanticsNodes().size
        }.getOrDefault(0)
    }

    private fun contentDescriptionNodeCount(text: String): Int {
        return runCatching {
            composeRule.onAllNodesWithContentDescription(text, substring = true).fetchSemanticsNodes().size
        }.getOrDefault(0)
    }
}
