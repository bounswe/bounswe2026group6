package com.neph.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.neph.BuildConfig

@Database(
    entities = [
        HelpRequestEntity::class,
        AvailabilityEntity::class,
        AssignedRequestEntity::class,
        SyncOperationEntity::class,
        SyncMetadataEntity::class
    ],
    version = 4,
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
    private const val DatabaseName = "neph-offline.db"
    private val Migration1To2 = object : Migration(1, 2) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL(
                "ALTER TABLE help_requests ADD COLUMN helpersJson TEXT NOT NULL DEFAULT '[]'"
            )
        }
    }
    private val Migration2To3 = object : Migration(2, 3) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL("ALTER TABLE help_requests ADD COLUMN urgencyLevel TEXT")
            database.execSQL("ALTER TABLE help_requests ADD COLUMN priorityLevel TEXT")
            database.execSQL("ALTER TABLE help_requests ADD COLUMN resolvedAt TEXT")
            database.execSQL("ALTER TABLE help_requests ADD COLUMN cancelledAt TEXT")
            database.execSQL("ALTER TABLE assigned_requests ADD COLUMN urgencyLevel TEXT")
            database.execSQL("ALTER TABLE assigned_requests ADD COLUMN priorityLevel TEXT")
            database.execSQL("ALTER TABLE assigned_requests ADD COLUMN openedAt TEXT")
        }
    }
    private val Migration3To4 = object : Migration(3, 4) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL("ALTER TABLE help_requests ADD COLUMN latitude REAL")
            database.execSQL("ALTER TABLE help_requests ADD COLUMN longitude REAL")
            database.execSQL("ALTER TABLE help_requests ADD COLUMN coordinateSource TEXT")
            database.execSQL("ALTER TABLE help_requests ADD COLUMN coordinateCapturedAt TEXT")
        }
    }

    fun initialize(context: Context) {
        getInstance(context)
    }

    fun getInstance(context: Context): NephDatabase {
        return instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                NephDatabase::class.java,
                DatabaseName
            ).addMigrations(Migration1To2, Migration2To3, Migration3To4)
                .build()
                .also { instance = it }
        }
    }

    fun requireInstance(): NephDatabase {
        return checkNotNull(instance) {
            "NephDatabaseProvider must be initialized before use."
        }
    }

    fun resetForTesting(context: Context) {
        requireDebugBuildForTestingReset()

        synchronized(this) {
            instance?.close()
            instance = null
            context.applicationContext.deleteDatabase(DatabaseName)
        }
    }

    private fun requireDebugBuildForTestingReset() {
        check(BuildConfig.DEBUG) {
            "NephDatabaseProvider.resetForTesting() is only available in debug/e2e test builds."
        }
    }
}
