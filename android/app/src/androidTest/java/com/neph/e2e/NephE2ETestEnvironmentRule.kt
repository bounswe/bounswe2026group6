package com.neph.e2e

import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.WorkManager
import com.neph.core.database.NephDatabaseProvider
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.availability.data.AvailabilityRepository
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.requesthelp.data.RequestHelpRepository
import org.junit.rules.TestRule
import org.junit.runner.Description
import org.junit.runners.model.Statement

class NephE2ETestEnvironmentRule(
    private val fakeBackend: FakeNephBackend,
    private val beforeLaunch: ((Context, FakeNephBackend) -> Unit)? = null
) : TestRule {
    override fun apply(base: Statement, description: Description): Statement {
        return object : Statement() {
            override fun evaluate() {
                val context = InstrumentationRegistry.getInstrumentation().targetContext

                resetAppState(context)
                fakeBackend.reset()
                fakeBackend.start()
                beforeLaunch?.invoke(context, fakeBackend)

                try {
                    base.evaluate()
                } finally {
                    fakeBackend.shutdown()
                    fakeBackend.reset()
                    resetAppState(context)
                }
            }
        }
    }

    private fun resetAppState(context: Context) {
        AuthSessionStore.resetForTesting()
        ProfileRepository.resetForTesting()
        AvailabilityRepository.resetForTesting()
        RequestHelpRepository.resetForTesting()
        runCatching { WorkManager.getInstance(context).cancelAllWork() }
        NephDatabaseProvider.resetForTesting(context)

        listOf(
            "neph_auth",
            "neph_profile",
            "neph_availability",
            "neph_guest_help_requests"
        ).forEach { prefsName ->
            runCatching {
                context.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
                    .edit()
                    .clear()
                    .commit()
            }
            runCatching { context.deleteSharedPreferences(prefsName) }
        }
    }
}
