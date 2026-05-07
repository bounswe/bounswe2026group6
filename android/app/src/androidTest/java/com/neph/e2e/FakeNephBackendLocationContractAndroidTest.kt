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
        val error = patchLocationExpectApiError(
            JSONObject().apply {
                put(
                    "administrative",
                    JSONObject().apply {
                        put("countryCode", "TURKEY")
                    }
                )
            }
        )

        assertEquals(400, error.status)
        assertEquals("VALIDATION_ERROR", error.code)
        assertEquals("administrative.countryCode must be a 2-letter ISO code", error.message)
    }

    @Test
    fun patchLocation_rejectsAdministrativeWhenNotObject() = runBlocking {
        val error = patchLocationExpectApiError(
            JSONObject().apply {
                put("administrative", "TR")
            }
        )

        assertEquals(400, error.status)
        assertEquals("VALIDATION_ERROR", error.code)
        assertEquals("administrative must be an object", error.message)
    }

    @Test
    fun patchLocation_rejectsAdministrativeCountryCodeWhenNotString() = runBlocking {
        val error = patchLocationExpectApiError(
            JSONObject().apply {
                put(
                    "administrative",
                    JSONObject().apply {
                        put("countryCode", 90)
                    }
                )
            }
        )

        assertEquals(400, error.status)
        assertEquals("VALIDATION_ERROR", error.code)
        assertEquals("administrative.countryCode must be a string or null", error.message)
    }

    @Test
    fun patchLocation_rejectsLatitudeConflictWithCoordinateLatitude() = runBlocking {
        val error = patchLocationExpectApiError(
            JSONObject().apply {
                put("latitude", 41.1)
                put("longitude", 29.0)
                put(
                    "coordinate",
                    JSONObject().apply {
                        put("latitude", 41.2)
                        put("longitude", 29.0)
                    }
                )
            }
        )

        assertEquals(400, error.status)
        assertEquals("VALIDATION_ERROR", error.code)
        assertEquals("latitude conflicts with coordinate.latitude", error.message)
    }

    private suspend fun patchLocationExpectApiError(body: JSONObject): ApiException {
        return try {
            JsonHttpClient.request(
                path = "/profiles/me/location",
                method = "PATCH",
                token = "access-token-1",
                body = body
            )
            fail("Expected ApiException for invalid location payload")
            throw AssertionError("Expected ApiException")
        } catch (error: ApiException) {
            error
        }
    }
}
