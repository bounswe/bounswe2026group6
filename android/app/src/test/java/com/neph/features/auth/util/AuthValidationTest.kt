package com.neph.features.auth.util

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthValidationTest {
    @Test
    fun isValidEmail_acceptsComAndNonComDomains() {
        val validEmails = listOf(
            "user@example.com",
            "user@example.net",
            "user@example.org",
            "user@example.edu",
            "user@example.io",
            "user@example.co.uk",
            "first.last+tag@sub.domain.co.uk",
            " user@trimmed.org "
        )

        validEmails.forEach { email ->
            assertTrue("Expected valid email: $email", isValidEmail(email))
        }
    }

    @Test
    fun isValidEmail_rejectsInvalidFormats() {
        val invalidEmails = listOf(
            "",
            "plainaddress",
            "user@",
            "@example.com",
            "user@example",
            "user@@example.com",
            "user name@example.com",
            "user@exa mple.com"
        )

        invalidEmails.forEach { email ->
            assertFalse("Expected invalid email: $email", isValidEmail(email))
        }
    }
}
