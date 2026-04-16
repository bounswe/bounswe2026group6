package com.neph.core.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class OfflineSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        return try {
            val retryNeeded = OfflineSyncCoordinator.sync(applicationContext)
            if (retryNeeded) Result.retry() else Result.success()
        } catch (error: Exception) {
            Log.w("NephOfflineSync", "Sync worker failed; scheduling retry.", error)
            Result.retry()
        }
    }
}
