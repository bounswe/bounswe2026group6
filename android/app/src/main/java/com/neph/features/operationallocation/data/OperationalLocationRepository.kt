package com.neph.features.operationallocation.data

import android.content.Context
import android.util.Log
import com.neph.core.NephAppContext
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.database.OperationalLocationEntity
import com.neph.core.network.ApiException
import com.neph.core.network.JsonHttpClient
import com.neph.core.sync.SyncStatus
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.profile.data.CurrentDeviceLocation
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class OperationalLocation(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float?,
    val source: String,
    val capturedAt: Long,
    val updatedAtEpochMillis: Long,
    val syncStatus: String?
)

object OperationalLocationRepository {
    private const val Tag = "OperationalLocationRepo"
    const val OPERATIONAL_LOCATION_REFRESH_THROTTLE: Long = 30 * 60 * 1000
    private const val BackendPath = "/operational-location/me"
    private const val DefaultSource = "gps"

    private val database get() = NephDatabaseProvider.requireInstance()

    fun initialize(context: Context) {
        NephAppContext.initialize(context.applicationContext)
        NephDatabaseProvider.initialize(context.applicationContext)
    }

    suspend fun getLatestLocation(): OperationalLocation? {
        return database.operationalLocationDao().getLatest()?.toModel()
    }

    suspend fun shouldRefresh(nowEpochMillis: Long = System.currentTimeMillis()): Boolean {
        val latest = getLatestLocation() ?: return true
        return nowEpochMillis - latest.updatedAtEpochMillis >= OPERATIONAL_LOCATION_REFRESH_THROTTLE
    }

    suspend fun saveLocationLocally(
        location: CurrentDeviceLocation,
        syncStatus: String? = null,
        updatedAtEpochMillis: Long = System.currentTimeMillis()
    ): OperationalLocation {
        val operationalLocation = OperationalLocation(
            latitude = location.latitude,
            longitude = location.longitude,
            accuracyMeters = location.accuracyMeters?.toFloat(),
            source = location.source.ifBlank { DefaultSource },
            capturedAt = parseCapturedAtMillis(location.capturedAt) ?: updatedAtEpochMillis,
            updatedAtEpochMillis = updatedAtEpochMillis,
            syncStatus = syncStatus
        )
        database.operationalLocationDao().upsert(operationalLocation.toEntity())
        return operationalLocation
    }

    suspend fun saveAndSyncIfAuthenticated(location: CurrentDeviceLocation): OperationalLocation {
        val token = AuthSessionStore.getAccessToken()
        val isGuest = AuthSessionStore.isGuestMode()
        val local = saveLocationLocally(
            location = location,
            syncStatus = if (token.isNullOrBlank() || isGuest) null else SyncStatus.PENDING_UPDATE
        )

        if (token.isNullOrBlank() || isGuest) {
            return local
        }

        return syncLocation(local, token)
    }

    suspend fun syncPendingIfAuthenticated() {
        val token = AuthSessionStore.getAccessToken()
        if (token.isNullOrBlank() || AuthSessionStore.isGuestMode()) {
            return
        }

        val latest = getLatestLocation() ?: return
        if (latest.syncStatus == SyncStatus.PENDING_UPDATE || latest.syncStatus == SyncStatus.FAILED) {
            syncLocation(latest, token)
        }
    }

    private suspend fun syncLocation(location: OperationalLocation, token: String): OperationalLocation {
        return try {
            JsonHttpClient.request(
                path = BackendPath,
                method = "PATCH",
                token = token,
                body = location.toRequestBody()
            )
            val synced = location.copy(
                syncStatus = SyncStatus.SYNCED,
                updatedAtEpochMillis = System.currentTimeMillis()
            )
            database.operationalLocationDao().upsert(synced.toEntity())
            synced
        } catch (error: ApiException) {
            Log.w(Tag, "Operational location sync failed.", error)
            markSyncStatus(location, SyncStatus.PENDING_UPDATE)
        } catch (error: Exception) {
            Log.w(Tag, "Operational location sync failed.", error)
            markSyncStatus(location, SyncStatus.PENDING_UPDATE)
        }
    }

    private suspend fun markSyncStatus(
        location: OperationalLocation,
        syncStatus: String
    ): OperationalLocation {
        val pending = location.copy(
            syncStatus = syncStatus,
            updatedAtEpochMillis = System.currentTimeMillis()
        )
        database.operationalLocationDao().upsert(pending.toEntity())
        return pending
    }

    private fun OperationalLocation.toRequestBody(): JSONObject {
        return JSONObject()
            .put("latitude", latitude)
            .put("longitude", longitude)
            .apply {
                if (accuracyMeters != null) {
                    put("accuracyMeters", accuracyMeters.toDouble())
                } else {
                    put("accuracyMeters", JSONObject.NULL)
                }
                put("source", source)
                put("capturedAt", toIsoUtc(capturedAt))
            }
    }

    private fun OperationalLocation.toEntity(): OperationalLocationEntity {
        return OperationalLocationEntity(
            latitude = latitude,
            longitude = longitude,
            accuracyMeters = accuracyMeters,
            source = source,
            capturedAt = capturedAt,
            updatedAtEpochMillis = updatedAtEpochMillis,
            syncStatus = syncStatus
        )
    }

    private fun OperationalLocationEntity.toModel(): OperationalLocation {
        return OperationalLocation(
            latitude = latitude,
            longitude = longitude,
            accuracyMeters = accuracyMeters,
            source = source,
            capturedAt = capturedAt,
            updatedAtEpochMillis = updatedAtEpochMillis,
            syncStatus = syncStatus
        )
    }

    private fun parseCapturedAtMillis(value: String): Long? {
        return runCatching {
            isoFormatter().parse(value)?.time
        }.getOrNull()
    }

    private fun toIsoUtc(timestampMillis: Long): String {
        return isoFormatter().format(Date(timestampMillis))
    }

    private fun isoFormatter(): SimpleDateFormat {
        return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
    }
}
