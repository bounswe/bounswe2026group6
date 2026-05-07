package com.neph.features.nearbyusers.data

import com.neph.core.database.NearbyVisibleUserEntity
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NearbyVisibleUsersRepositoryTest {
    @Test
    fun parserStoresOnlyMinimalVisibleFields() {
        val now = 1_000L
        val response = JSONObject()
            .put(
                "safetyStatuses",
                JSONArray()
                    .put(
                        JSONObject()
                            .put("userId", "user-visible")
                            .put("displayName", "Visible User")
                            .put("status", "safe")
                            .put("updatedAt", "2026-05-04T10:00:00.000Z")
                            .put(
                                "location",
                                JSONObject()
                                    .put("latitude", 41.04321)
                                    .put("longitude", 29.00987)
                                    .put("capturedAt", "2026-05-04T09:58:00.000Z")
                            )
                    )
            )

        val users = NearbyVisibleUsersRepository.parseVisibleSafetyStatuses(
            response,
            now,
            cacheOwnerUserId = "viewer-1"
        )

        assertEquals(1, users.size)
        assertEquals("viewer-1", users[0].cacheOwnerUserId)
        assertEquals(NearbyVisibleUsersCacheSource.RESIDENTIAL_PROFILE.storageValue, users[0].cacheSource)
        assertEquals("user-visible", users[0].userId)
        assertEquals("Visible User", users[0].displayName)
        assertEquals("safe", users[0].safetyStatus)
        assertEquals("2026-05-04T10:00:00.000Z", users[0].statusUpdatedAt)
        assertEquals(41.043, users[0].latitude ?: 0.0, 0.0)
        assertEquals(29.010, users[0].longitude ?: 0.0, 0.0)
        assertEquals(now, users[0].fetchedAtEpochMillis)
    }

    @Test
    fun parserStoresCurrentLocationCacheSourceSeparately() {
        val response = JSONObject()
            .put(
                "safetyStatuses",
                JSONArray()
                    .put(
                        JSONObject()
                            .put("userId", "user-current-location")
                            .put("displayName", "Current Nearby")
                            .put("status", "safe")
                    )
            )

        val user = NearbyVisibleUsersRepository.parseVisibleSafetyStatuses(
            response,
            now = 2_000L,
            cacheOwnerUserId = "viewer-1",
            cacheSource = NearbyVisibleUsersCacheSource.CURRENT_OPERATIONAL_LOCATION
        ).single()

        assertEquals(
            NearbyVisibleUsersCacheSource.CURRENT_OPERATIONAL_LOCATION.storageValue,
            user.cacheSource
        )
    }

    @Test
    fun parserDoesNotCacheLocationWhenBackendDoesNotExposeIt() {
        val response = JSONObject()
            .put(
                "safetyStatuses",
                JSONArray()
                    .put(
                        JSONObject()
                            .put("userId", "user-private-location")
                            .put("displayName", "Private Location")
                            .put("status", "not_safe")
                            .put("location", JSONObject.NULL)
                    )
            )

        val user = NearbyVisibleUsersRepository.parseVisibleSafetyStatuses(
            response,
            now = 2_000L,
            cacheOwnerUserId = "viewer-1"
        ).single()

        assertNull(user.latitude)
        assertNull(user.longitude)
        assertNull(user.locationCapturedAt)
    }

    @Test
    fun stalePolicyMarksCacheStaleAfterRefreshWindowOrExpiry() {
        val entity = NearbyVisibleUserEntity(
            cacheOwnerUserId = "viewer-1",
            cacheSource = NearbyVisibleUsersCacheSource.RESIDENTIAL_PROFILE.storageValue,
            userId = "user-stale",
            displayName = "Stale User",
            safetyStatus = "unknown",
            statusUpdatedAt = null,
            latitude = null,
            longitude = null,
            locationCapturedAt = null,
            visibilityScope = null,
            fetchedAtEpochMillis = 10_000L,
            expiresAtEpochMillis = 20_000L
        )

        assertFalse(NearbyVisibleUsersRepository.isEntityStale(entity, now = 12_000L))
        assertTrue(NearbyVisibleUsersRepository.isEntityStale(entity, now = 16 * 60 * 1000L + 10_000L))
        assertTrue(NearbyVisibleUsersRepository.isEntityStale(entity, now = 20_000L))
    }
}
