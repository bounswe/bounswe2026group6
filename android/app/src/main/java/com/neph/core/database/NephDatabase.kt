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
        OperationalLocationEntity::class,
        SafetyStatusEntity::class,
        AssignedRequestEntity::class,
        NearbyVisibleUserEntity::class,
        SyncOperationEntity::class,
        SyncMetadataEntity::class
    ],
    version = 12,
    exportSchema = false
)
abstract class NephDatabase : RoomDatabase() {
    abstract fun helpRequestDao(): HelpRequestDao
    abstract fun availabilityDao(): AvailabilityDao
    abstract fun operationalLocationDao(): OperationalLocationDao
    abstract fun safetyStatusDao(): SafetyStatusDao
    abstract fun assignedRequestDao(): AssignedRequestDao
    abstract fun nearbyVisibleUserDao(): NearbyVisibleUserDao
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
    private val Migration4To5 = object : Migration(4, 5) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL(
                """
                CREATE TABLE IF NOT EXISTS operational_location (
                    `key` TEXT NOT NULL PRIMARY KEY,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    accuracyMeters REAL,
                    source TEXT NOT NULL,
                    capturedAt INTEGER NOT NULL,
                    updatedAtEpochMillis INTEGER NOT NULL,
                    syncStatus TEXT
                )
                """.trimIndent()
            )
        }
    }
    private val Migration5To6 = object : Migration(5, 6) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL("ALTER TABLE help_requests ADD COLUMN coordinateAccuracyMeters REAL")
        }
    }
    private val Migration6To7 = object : Migration(6, 7) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL(
                """
                CREATE TABLE IF NOT EXISTS safety_status (
                    `key` TEXT NOT NULL PRIMARY KEY,
                    status TEXT NOT NULL,
                    note TEXT,
                    shareLocationConsent INTEGER NOT NULL,
                    latitude REAL,
                    longitude REAL,
                    accuracyMeters REAL,
                    source TEXT,
                    capturedAt TEXT,
                    checkedAtEpochMillis INTEGER NOT NULL,
                    updatedAtEpochMillis INTEGER NOT NULL,
                    syncStatus TEXT NOT NULL,
                    pendingError TEXT,
                    lastSyncedAtEpochMillis INTEGER,
                    serverUpdatedAt TEXT
                )
                """.trimIndent()
            )
            database.execSQL(
                "CREATE INDEX IF NOT EXISTS index_safety_status_syncStatus ON safety_status (syncStatus)"
            )
        }
    }
    private val Migration7To8 = object : Migration(7, 8) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL("ALTER TABLE availability_state ADD COLUMN isAssignable INTEGER NOT NULL DEFAULT 0")
            database.execSQL("ALTER TABLE availability_state ADD COLUMN availableUntil TEXT")
            database.execSQL("ALTER TABLE availability_state ADD COLUMN locationUpdatedAt TEXT")
            database.execSQL("ALTER TABLE availability_state ADD COLUMN pauseReason TEXT NOT NULL DEFAULT 'NONE'")
        }
    }
    private val Migration8To9 = object : Migration(8, 9) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL(
                """
                CREATE TABLE IF NOT EXISTS nearby_visible_users (
                    cacheOwnerUserId TEXT NOT NULL,
                    userId TEXT NOT NULL,
                    displayName TEXT,
                    safetyStatus TEXT NOT NULL,
                    statusUpdatedAt TEXT,
                    latitude REAL,
                    longitude REAL,
                    locationCapturedAt TEXT,
                    visibilityScope TEXT,
                    fetchedAtEpochMillis INTEGER NOT NULL,
                    expiresAtEpochMillis INTEGER NOT NULL,
                    PRIMARY KEY(cacheOwnerUserId, userId)
                )
                """.trimIndent()
            )
            database.execSQL("CREATE INDEX IF NOT EXISTS index_nearby_visible_users_cacheOwnerUserId ON nearby_visible_users (cacheOwnerUserId)")
            database.execSQL("CREATE INDEX IF NOT EXISTS index_nearby_visible_users_safetyStatus ON nearby_visible_users (safetyStatus)")
            database.execSQL("CREATE INDEX IF NOT EXISTS index_nearby_visible_users_fetchedAtEpochMillis ON nearby_visible_users (fetchedAtEpochMillis)")
        }
    }
    private val Migration9To10 = object : Migration(9, 10) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL(
                """
                CREATE TABLE IF NOT EXISTS nearby_visible_users_new (
                    cacheOwnerUserId TEXT NOT NULL,
                    cacheSource TEXT NOT NULL DEFAULT 'RESIDENTIAL_PROFILE',
                    userId TEXT NOT NULL,
                    displayName TEXT,
                    safetyStatus TEXT NOT NULL,
                    statusUpdatedAt TEXT,
                    latitude REAL,
                    longitude REAL,
                    locationCapturedAt TEXT,
                    visibilityScope TEXT,
                    fetchedAtEpochMillis INTEGER NOT NULL,
                    expiresAtEpochMillis INTEGER NOT NULL,
                    PRIMARY KEY(cacheOwnerUserId, cacheSource, userId)
                )
                """.trimIndent()
            )
            database.execSQL(
                """
                INSERT INTO nearby_visible_users_new (
                    cacheOwnerUserId,
                    cacheSource,
                    userId,
                    displayName,
                    safetyStatus,
                    statusUpdatedAt,
                    latitude,
                    longitude,
                    locationCapturedAt,
                    visibilityScope,
                    fetchedAtEpochMillis,
                    expiresAtEpochMillis
                )
                SELECT
                    cacheOwnerUserId,
                    'RESIDENTIAL_PROFILE',
                    userId,
                    displayName,
                    safetyStatus,
                    statusUpdatedAt,
                    latitude,
                    longitude,
                    locationCapturedAt,
                    visibilityScope,
                    fetchedAtEpochMillis,
                    expiresAtEpochMillis
                FROM nearby_visible_users
                """.trimIndent()
            )
            database.execSQL("DROP TABLE nearby_visible_users")
            database.execSQL("ALTER TABLE nearby_visible_users_new RENAME TO nearby_visible_users")
            database.execSQL("CREATE INDEX IF NOT EXISTS index_nearby_visible_users_cacheOwnerUserId ON nearby_visible_users (cacheOwnerUserId)")
            database.execSQL("CREATE INDEX IF NOT EXISTS index_nearby_visible_users_cacheOwnerUserId_cacheSource ON nearby_visible_users (cacheOwnerUserId, cacheSource)")
            database.execSQL("CREATE INDEX IF NOT EXISTS index_nearby_visible_users_safetyStatus ON nearby_visible_users (safetyStatus)")
            database.execSQL("CREATE INDEX IF NOT EXISTS index_nearby_visible_users_fetchedAtEpochMillis ON nearby_visible_users (fetchedAtEpochMillis)")
        }
    }
    private val Migration10To11 = object : Migration(10, 11) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL("ALTER TABLE assigned_requests ADD COLUMN latitude REAL")
            database.execSQL("ALTER TABLE assigned_requests ADD COLUMN longitude REAL")
        }
    }
    private val Migration11To12 = object : Migration(11, 12) {
        override fun migrate(database: SupportSQLiteDatabase) {
            database.execSQL("ALTER TABLE help_requests ADD COLUMN shareProfileHealthInfoWithVolunteer INTEGER NOT NULL DEFAULT 0")
            database.execSQL("ALTER TABLE assigned_requests ADD COLUMN shareProfileHealthInfoWithVolunteer INTEGER NOT NULL DEFAULT 0")
            database.execSQL("ALTER TABLE assigned_requests ADD COLUMN medicalConditionsJson TEXT NOT NULL DEFAULT '[]'")
            database.execSQL("ALTER TABLE assigned_requests ADD COLUMN chronicDiseasesJson TEXT NOT NULL DEFAULT '[]'")
            database.execSQL("ALTER TABLE assigned_requests ADD COLUMN allergiesJson TEXT NOT NULL DEFAULT '[]'")
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
            ).addMigrations(
                Migration1To2,
                Migration2To3,
                Migration3To4,
                Migration4To5,
                Migration5To6,
                Migration6To7,
                Migration7To8,
                Migration8To9,
                Migration9To10,
                Migration10To11,
                Migration11To12
            )
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
