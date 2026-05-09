package com.neph.e2e

import android.content.Context
import android.os.Build
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.WorkManager
import com.neph.core.database.NephDatabaseProvider
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.onboarding.data.MobileOnboardingStore
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
                grantRuntimePermissions(context)
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
        runCatching { MobileOnboardingStore.resetForTesting() }
        runCatching { WorkManager.getInstance(context).cancelAllWork() }
        NephDatabaseProvider.resetForTesting(context)

        listOf(
            "neph_auth",
            "neph_profile",
            "neph_availability",
            "neph_guest_help_requests",
            "neph_mobile_onboarding"
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

    private fun grantRuntimePermissions(context: Context) {
        listOf(
            "android.permission.ACCESS_COARSE_LOCATION",
            "android.permission.ACCESS_FINE_LOCATION"
        ).forEach { permission ->
            runCatching {
                InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand(
                    "pm grant ${context.packageName} $permission"
                ).close()
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            runCatching {
                InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand(
                    "pm grant ${context.packageName} android.permission.POST_NOTIFICATIONS"
                ).close()
            }
        }
    }
}
