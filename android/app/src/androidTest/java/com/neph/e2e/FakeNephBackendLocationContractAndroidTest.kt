package com.neph.e2e

import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class FakeNephBackendLocationContractAndroidTest {
    private val fakeBackend = FakeNephBackend()

    @Before
    fun setUp() {
        fakeBackend.reset()
        fakeBackend.start()
        fakeBackend.seedVerifiedUser(
            email = "contract.android@example.com",
            password = "Passw0rd!"
        )
    }

    @After
    fun tearDown() {
        fakeBackend.shutdown()
        fakeBackend.reset()
    }

    @Test
    fun patchLocation_rejectsInvalidAdministrativeCountryCode() = runBlocking {
        try {
            JsonHttpClient.request(
                path = "/profiles/me/location",
                method = "PATCH",
                token = "access-token-1",
                body = JSONObject().apply {
                    put(
                        "administrative",
                        JSONObject().apply {
                            put("countryCode", "TURKEY")
                        }
                    )
                }
            )
            fail("Expected ApiException for invalid administrative.countryCode")
        } catch (error: ApiException) {
            assertEquals(400, error.status)
            assertEquals("VALIDATION_ERROR", error.code)
            assertEquals("administrative.countryCode must be a 2-letter ISO code", error.message)
        }
    }
}
