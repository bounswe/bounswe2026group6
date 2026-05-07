package com.neph.features.nearbyusers.data

import com.neph.core.database.NearbyVisibleUserEntity
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.CancellationException
import org.json.JSONObject
import kotlin.math.round

data class NearbyVisibleUserUiModel(
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

    fun observeCachedUsers(cacheOwnerUserId: String): Flow<List<NearbyVisibleUserUiModel>> {
        return database.nearbyVisibleUserDao()
            .observeByCacheOwner(cacheOwnerUserId)
            .map { entities -> entities.map { it.toUiModel(System.currentTimeMillis()) } }
    }

    suspend fun refreshNearbyVisibleUsers(token: String, cacheOwnerUserId: String): NearbyVisibleUsersResult {
        val now = System.currentTimeMillis()
        database.nearbyVisibleUserDao().deleteExpired(now)

        return try {
            val response = JsonHttpClient.request(
                path = "/safety-status/visible?nearby=true",
                token = token
            )
            val entities = parseVisibleSafetyStatuses(response, now, cacheOwnerUserId)
            database.nearbyVisibleUserDao().clearByCacheOwner(cacheOwnerUserId)
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
            if (error.status == 401) {
                throw error
            }
            returnCachedUsers(cacheOwnerUserId, now)
        } catch (error: Exception) {
            returnCachedUsers(cacheOwnerUserId, now)
        }
    }

    internal fun parseVisibleSafetyStatuses(
        response: JSONObject,
        now: Long,
        cacheOwnerUserId: String
    ): List<NearbyVisibleUserEntity> {
        val items = response.optJSONArray("safetyStatuses") ?: return emptyList()
        return buildList {
            for (index in 0 until items.length()) {
                items.optJSONObject(index)?.toNearbyVisibleUserEntity(now, cacheOwnerUserId)?.let(::add)
            }
        }.distinctBy { it.userId }
    }

    internal fun isEntityStale(entity: NearbyVisibleUserEntity, now: Long): Boolean {
        return entity.expiresAtEpochMillis <= now || entity.fetchedAtEpochMillis + StaleAfterMillis <= now
    }

    private suspend fun returnCachedUsers(
        cacheOwnerUserId: String,
        now: Long
    ): NearbyVisibleUsersResult {
        val cached = database.nearbyVisibleUserDao()
            .getByCacheOwner(cacheOwnerUserId)
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

    suspend fun clearLocalCache(cacheOwnerUserId: String? = null) {
        if (cacheOwnerUserId.isNullOrBlank()) {
            database.nearbyVisibleUserDao().clearAll()
        } else {
            database.nearbyVisibleUserDao().clearByCacheOwner(cacheOwnerUserId)
        }
    }

    private fun JSONObject.toNearbyVisibleUserEntity(now: Long, cacheOwnerUserId: String): NearbyVisibleUserEntity? {
        val userId = optString("userId").trim()
        if (userId.isBlank()) {
            return null
        }

        val location = optJSONObject("location")
        val latitude = location?.opt("latitude") as? Number
        val longitude = location?.opt("longitude") as? Number

        return NearbyVisibleUserEntity(
            cacheOwnerUserId = cacheOwnerUserId,
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
