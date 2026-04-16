package com.neph.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        HelpRequestEntity::class,
        AvailabilityEntity::class,
        AssignedRequestEntity::class,
        SyncOperationEntity::class,
        SyncMetadataEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class NephDatabase : RoomDatabase() {
    abstract fun helpRequestDao(): HelpRequestDao
    abstract fun availabilityDao(): AvailabilityDao
    abstract fun assignedRequestDao(): AssignedRequestDao
    abstract fun syncOperationDao(): SyncOperationDao
    abstract fun syncMetadataDao(): SyncMetadataDao
}

object NephDatabaseProvider {
    @Volatile private var instance: NephDatabase? = null

    fun initialize(context: Context) {
        getInstance(context)
    }

    fun getInstance(context: Context): NephDatabase {
        return instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                NephDatabase::class.java,
                "neph-offline.db"
            ).build().also { instance = it }
        }
    }

    fun requireInstance(): NephDatabase {
        return checkNotNull(instance) {
            "NephDatabaseProvider must be initialized before use."
        }
    }
}
