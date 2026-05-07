package com.neph.features.nearbyusers.data

import com.neph.core.database.NearbyVisibleUserEntity
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
import com.neph.features.profile.data.CurrentDeviceLocation
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.json.JSONObject
import java.util.Locale
import kotlin.math.round

data class NearbyVisibleUserUiModel(
    val cacheSource: NearbyVisibleUsersCacheSource,
    val userId: String,
    val displayName: String?,
    val safetyStatus: String,
    val statusUpdatedAt: String?,
    val latitude: Double?,
    val longitude: Double?,
    val locationCapturedAt: String?,
    val visibilityScope: String?,
    val fetchedAtEpochMillis: Long,
    val expiresAtEpochMillis: Long,
    val isStale: Boolean
) {
    val hasLocation: Boolean
        get() = latitude != null && longitude != null
}

enum class NearbyVisibleUsersCacheSource(val storageValue: String) {
    RESIDENTIAL_PROFILE("RESIDENTIAL_PROFILE"),
    CURRENT_OPERATIONAL_LOCATION("CURRENT_OPERATIONAL_LOCATION");

    companion object {
        fun fromStorageValue(value: String): NearbyVisibleUsersCacheSource {
            return values().firstOrNull { it.storageValue == value } ?: RESIDENTIAL_PROFILE
        }
    }
}

data class NearbyVisibleUsersResult(
    val users: List<NearbyVisibleUserUiModel>,
    val fromCache: Boolean,
    val isStale: Boolean,
    val message: String?
)

object NearbyVisibleUsersRepository {
    private const val CacheTtlMillis = 24L * 60L * 60L * 1000L
    private const val StaleAfterMillis = 15L * 60L * 1000L

    private val database get() = NephDatabaseProvider.requireInstance()

    fun observeCachedUsers(
        cacheOwnerUserId: String,
        cacheSource: NearbyVisibleUsersCacheSource = NearbyVisibleUsersCacheSource.RESIDENTIAL_PROFILE
    ): Flow<List<NearbyVisibleUserUiModel>> {
        return database.nearbyVisibleUserDao()
            .observeByCacheOwnerAndSource(cacheOwnerUserId, cacheSource.storageValue)
            .map { entities -> entities.map { it.toUiModel(System.currentTimeMillis()) } }
    }

    suspend fun refreshNearbyVisibleUsers(token: String, cacheOwnerUserId: String): NearbyVisibleUsersResult {
        return refreshNearbyVisibleUsersForSource(
            token = token,
            cacheOwnerUserId = cacheOwnerUserId,
            cacheSource = NearbyVisibleUsersCacheSource.RESIDENTIAL_PROFILE,
            path = "/safety-status/visible?nearby=true"
        )
    }

    suspend fun refreshNearbyVisibleUsersForCurrentLocation(
        token: String,
        cacheOwnerUserId: String,
        currentLocation: CurrentDeviceLocation
    ): NearbyVisibleUsersResult {
        val latitude = "%.6f".format(Locale.US, currentLocation.latitude)
        val longitude = "%.6f".format(Locale.US, currentLocation.longitude)
        return refreshNearbyVisibleUsersForSource(
            token = token,
            cacheOwnerUserId = cacheOwnerUserId,
            cacheSource = NearbyVisibleUsersCacheSource.CURRENT_OPERATIONAL_LOCATION,
            path = "/safety-status/visible?nearby=true&context=current-location&latitude=$latitude&longitude=$longitude",
            fallbackToCacheOnApiError = false
        )
    }

    internal fun parseVisibleSafetyStatuses(
        response: JSONObject,
        now: Long,
        cacheOwnerUserId: String,
        cacheSource: NearbyVisibleUsersCacheSource = NearbyVisibleUsersCacheSource.RESIDENTIAL_PROFILE
    ): List<NearbyVisibleUserEntity> {
        val items = response.optJSONArray("safetyStatuses") ?: return emptyList()
        return buildList {
            for (index in 0 until items.length()) {
                items.optJSONObject(index)?.toNearbyVisibleUserEntity(
                    now = now,
                    cacheOwnerUserId = cacheOwnerUserId,
                    cacheSource = cacheSource
                )?.let(::add)
            }
        }.distinctBy { it.userId }
    }

    internal fun isEntityStale(entity: NearbyVisibleUserEntity, now: Long): Boolean {
        return entity.expiresAtEpochMillis <= now || entity.fetchedAtEpochMillis + StaleAfterMillis <= now
    }

    suspend fun clearLocalCache(cacheOwnerUserId: String? = null) {
        if (cacheOwnerUserId.isNullOrBlank()) {
            database.nearbyVisibleUserDao().clearAll()
        } else {
            database.nearbyVisibleUserDao().clearByCacheOwner(cacheOwnerUserId)
        }
    }

    private suspend fun refreshNearbyVisibleUsersForSource(
        token: String,
        cacheOwnerUserId: String,
        cacheSource: NearbyVisibleUsersCacheSource,
        path: String,
        fallbackToCacheOnApiError: Boolean = true
    ): NearbyVisibleUsersResult {
        val now = System.currentTimeMillis()
        database.nearbyVisibleUserDao().deleteExpired(now)

        return try {
            val response = JsonHttpClient.request(
                path = path,
                token = token
            )
            val entities = parseVisibleSafetyStatuses(response, now, cacheOwnerUserId, cacheSource)
            database.nearbyVisibleUserDao().clearByCacheOwnerAndSource(
                cacheOwnerUserId = cacheOwnerUserId,
                cacheSource = cacheSource.storageValue
            )
            if (entities.isNotEmpty()) {
                database.nearbyVisibleUserDao().upsertAll(entities)
            }
            NearbyVisibleUsersResult(
                users = entities.map { it.toUiModel(now, forceStale = false) },
                fromCache = false,
                isStale = false,
                message = null
            )
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (error: ApiException) {
            if (error.status == 401 || !fallbackToCacheOnApiError) {
                throw error
            }
            returnCachedUsers(cacheOwnerUserId, cacheSource, now)
        } catch (error: Exception) {
            returnCachedUsers(cacheOwnerUserId, cacheSource, now)
        }
    }

    private suspend fun returnCachedUsers(
        cacheOwnerUserId: String,
        cacheSource: NearbyVisibleUsersCacheSource,
        now: Long
    ): NearbyVisibleUsersResult {
        val cached = database.nearbyVisibleUserDao()
            .getByCacheOwnerAndSource(cacheOwnerUserId, cacheSource.storageValue)
            .map { it.toUiModel(now, forceStale = true) }
        return NearbyVisibleUsersResult(
            users = cached,
            fromCache = true,
            isStale = cached.isNotEmpty(),
            message = if (cached.isEmpty()) {
                "Could not load nearby visible users. Please retry when you have a connection."
            } else {
                "Showing cached nearby users. This information may be stale."
            }
        )
    }

    private fun JSONObject.toNearbyVisibleUserEntity(
        now: Long,
        cacheOwnerUserId: String,
        cacheSource: NearbyVisibleUsersCacheSource
    ): NearbyVisibleUserEntity? {
        val userId = optString("userId").trim()
        if (userId.isBlank()) {
            return null
        }

        val location = optJSONObject("location")
        val latitude = location?.opt("latitude") as? Number
        val longitude = location?.opt("longitude") as? Number

        return NearbyVisibleUserEntity(
            cacheOwnerUserId = cacheOwnerUserId,
            cacheSource = cacheSource.storageValue,
            userId = userId,
            displayName = optString("displayName").takeIf { it.isNotBlank() && it != "null" },
            safetyStatus = optString("status").ifBlank { "unknown" },
            statusUpdatedAt = optString("updatedAt").takeIf { it.isNotBlank() && it != "null" },
            latitude = latitude?.toDouble()?.roundToCoarseCoordinate(),
            longitude = longitude?.toDouble()?.roundToCoarseCoordinate(),
            locationCapturedAt = location?.optString("capturedAt")?.takeIf { it.isNotBlank() && it != "null" },
            visibilityScope = optString("visibilityScope").takeIf { it.isNotBlank() && it != "null" },
            fetchedAtEpochMillis = now,
            expiresAtEpochMillis = now + CacheTtlMillis
        )
    }

    private fun Double.roundToCoarseCoordinate(): Double {
        return round(this * 1_000.0) / 1_000.0
    }

    private fun NearbyVisibleUserEntity.toUiModel(
        now: Long,
        forceStale: Boolean = false
    ): NearbyVisibleUserUiModel {
        return NearbyVisibleUserUiModel(
            cacheSource = NearbyVisibleUsersCacheSource.fromStorageValue(cacheSource),
            userId = userId,
            displayName = displayName,
            safetyStatus = safetyStatus,
            statusUpdatedAt = statusUpdatedAt,
            latitude = latitude,
            longitude = longitude,
            locationCapturedAt = locationCapturedAt,
            visibilityScope = visibilityScope,
            fetchedAtEpochMillis = fetchedAtEpochMillis,
            expiresAtEpochMillis = expiresAtEpochMillis,
            isStale = forceStale || isEntityStale(this, now)
        )
    }
}
