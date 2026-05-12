package com.neph.e2e

import android.content.Context
import com.neph.core.NephAppContext
import com.neph.core.database.NephDatabaseProvider
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.auth.data.LoginDestination
import com.neph.features.onboarding.data.MobileOnboardingStepId
import com.neph.features.onboarding.data.MobileOnboardingStore
import com.neph.features.operationallocation.data.OperationalLocationRepository
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.features.safetystatus.data.SafetyStatusRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class MobileOnboardingLoginAndroidTest {
    private val fakeBackend = FakeNephBackend()

    @get:Rule
    val environmentRule = NephE2ETestEnvironmentRule(fakeBackend) { context, backend ->
        backend.seedVerifiedUser(
            email = ExistingWebProfileEmail,
            password = Password,
            profile = FakeProfileState(firstName = "Web", lastName = "Complete")
        )
        initializeLoginOnboardingDependencies(context)
    }

    @Test
    fun firstMobileLoginWithExistingWebProfile_marksGuidePending() = runBlocking {
        val destination = AuthRepository.login(
            email = ExistingWebProfileEmail,
            password = Password,
            rememberMe = false
        )

        assertEquals(LoginDestination.PROFILE, destination)
        assertTrue(MobileOnboardingStore.shouldShowForCurrentUser())
        assertEquals(
            MobileOnboardingStepId.HOME_DASHBOARD,
            MobileOnboardingStore.currentStepForCurrentUser(isAuthenticated = true)
        )
    }

    private fun initializeLoginOnboardingDependencies(context: Context) {
        NephAppContext.initialize(context)
        NephDatabaseProvider.initialize(context)
        AuthSessionStore.initialize(context)
        ProfileRepository.initialize(context)
        MobileOnboardingStore.initialize(context)
        RequestHelpRepository.initialize(context)
        OperationalLocationRepository.initialize(context)
        SafetyStatusRepository.initialize(context)
    }

    private companion object {
        const val ExistingWebProfileEmail = "web.completed.mobile@example.com"
        const val Password = "Passw0rd!"
    }
}
