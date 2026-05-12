package com.neph

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.tooling.preview.Preview
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.neph.core.NephAppContext
import com.neph.core.database.NephDatabaseProvider
import com.neph.core.sync.OfflineSyncScheduler
import com.neph.core.theme.ThemePreferenceStore
import com.neph.features.availability.data.AvailabilityRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.operationallocation.data.OperationalLocationRepository
import com.neph.features.operationallocation.data.OperationalLocationUpdater
import com.neph.features.profile.data.DeviceLocationProvider
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.notifications.data.PushTokenSync
import com.neph.features.notifications.data.NotificationsBadge
import com.neph.features.onboarding.data.MobileOnboardingJourney
import com.neph.features.onboarding.data.MobileOnboardingPracticeHelpRequest
import com.neph.features.onboarding.data.MobileOnboardingStepId
import com.neph.features.onboarding.data.MobileOnboardingStore
import com.neph.features.onboarding.presentation.MobileOnboardingGuide
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.features.safetystatus.data.SafetyStatusRepository
import com.neph.navigation.AppNavGraph
import com.neph.navigation.Routes
import com.neph.ui.theme.NephTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val initialLocationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = DeviceLocationProvider.hasLocationPermission(this) || grants.values.any { it }
        syncLocationPermissionPrivacy(granted)
        requestNotificationPermissionIfNeeded()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NephAppContext.initialize(applicationContext)
        NephDatabaseProvider.initialize(applicationContext)
        AuthSessionStore.initialize(applicationContext)
        MobileOnboardingStore.initialize(applicationContext)
        ThemePreferenceStore.initialize(applicationContext)
        AvailabilityRepository.initialize(applicationContext)
        OperationalLocationRepository.initialize(applicationContext)
        ProfileRepository.initialize(applicationContext)
        RequestHelpRepository.initialize(applicationContext)
        SafetyStatusRepository.initialize(applicationContext)
        if (!requestInitialLocationPermissionIfNeeded()) {
            requestNotificationPermissionIfNeeded()
        }
        PushTokenSync.syncCurrentToken()
        NotificationsBadge.hydrateIfAuthenticated()
        OfflineSyncScheduler.schedulePeriodicSync(applicationContext)
        OfflineSyncScheduler.enqueueSync(applicationContext, reason = "app-start")
        setContent {
            NephApp()
        }
        refreshOperationalLocationSilently()
    }

    override fun onResume() {
        super.onResume()
        refreshOperationalLocationSilently()
        NotificationsBadge.hydrateIfAuthenticated()
    }

    private fun refreshOperationalLocationSilently() {
        lifecycleScope.launch {
            OperationalLocationUpdater.refreshIfAllowed(applicationContext)
        }
    }

    private fun requestInitialLocationPermissionIfNeeded(): Boolean {
        val prefs = getSharedPreferences(InitialPermissionPrefsName, Context.MODE_PRIVATE)
        val alreadyPrompted = prefs.getBoolean(InitialLocationPermissionPromptedKey, false)
        val alreadyGranted = DeviceLocationProvider.hasLocationPermission(this)

        if (alreadyPrompted) {
            return false
        }

        if (alreadyGranted) {
            prefs.edit().putBoolean(InitialLocationPermissionPromptedKey, true).apply()
            syncLocationPermissionPrivacy(granted = true)
            return false
        }

        prefs.edit().putBoolean(InitialLocationPermissionPromptedKey, true).apply()
        initialLocationPermissionLauncher.launch(DeviceLocationProvider.RequiredLocationPermissions)
        return true
    }

    private fun syncLocationPermissionPrivacy(granted: Boolean) {
        lifecycleScope.launch {
            try {
                ProfileRepository.syncPrivacyDefaultsForLocationPermission(granted)
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                // Permission-derived privacy defaults are opportunistic and should not block app launch.
            }
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return
        }

        if (
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            REQUEST_POST_NOTIFICATIONS
        )
    }

    companion object {
        private const val InitialPermissionPrefsName = "neph_initial_permissions"
        private const val InitialLocationPermissionPromptedKey = "initialLocationPermissionPrompted"
        private const val REQUEST_POST_NOTIFICATIONS = 1001
    }
}

@Composable
fun NephApp() {
    val themeMode by ThemePreferenceStore.themeModeFlow.collectAsState()
    val darkThemeEnabled = ThemePreferenceStore.resolveDarkTheme(
        themeMode = themeMode,
        systemDarkTheme = isSystemInDarkTheme()
    )

    NephTheme(darkTheme = darkThemeEnabled) {
        val activity = LocalActivity.current
        val navController = rememberNavController()
        val currentBackStackEntry by navController.currentBackStackEntryAsState()
        val currentRoute = currentBackStackEntry?.destination?.route
        val accessToken by AuthSessionStore.accessTokenFlow.collectAsState()
        val mobileOnboardingRevision by MobileOnboardingStore.revisionFlow.collectAsState()
        val isAuthenticated = !accessToken.isNullOrBlank()
        var showMobileOnboarding by remember { mutableStateOf(false) }
        var activeMobileOnboardingStepId by remember { mutableStateOf<MobileOnboardingStepId?>(null) }
        var mobileOnboardingFeedback by remember { mutableStateOf<String?>(null) }
        var mobileOnboardingPracticeHelpRequest by remember {
            mutableStateOf<MobileOnboardingPracticeHelpRequest?>(null)
        }
        var showExitDialog by remember { mutableStateOf(false) }
        val canPopBackStack = navController.previousBackStackEntry != null
        val shouldConfirmExit = !canPopBackStack && (
            currentRoute == Routes.Home.route || currentRoute == Routes.Welcome.route
        )

        fun navigateForMobileOnboarding(route: String) {
            navController.navigate(route) {
                launchSingleTop = true
                restoreState = true
            }
        }

        fun setMobileOnboardingStep(stepId: MobileOnboardingStepId) {
            activeMobileOnboardingStepId = stepId
            MobileOnboardingStore.setCurrentStepForCurrentUser(stepId)
            MobileOnboardingJourney.stepFor(stepId, isAuthenticated)?.let { step ->
                val routeBase = currentRoute?.substringBefore('?')
                if (routeBase != step.route) {
                    navigateForMobileOnboarding(step.route)
                }
            }
        }

        fun restartMobileOnboarding() {
            MobileOnboardingStore.restartForCurrentUser()
            val firstStep = MobileOnboardingJourney.firstStep(isAuthenticated = true)
            activeMobileOnboardingStepId = firstStep.id
            mobileOnboardingFeedback = null
            mobileOnboardingPracticeHelpRequest = null
            showMobileOnboarding = true
            navigateForMobileOnboarding(firstStep.route)
        }

        fun showPendingMobileOnboardingAfterLogin() {
            val shouldShow = MobileOnboardingStore.shouldShowForCurrentUser()
            showMobileOnboarding = shouldShow
            activeMobileOnboardingStepId = if (shouldShow) {
                MobileOnboardingStore.currentStepForCurrentUser(isAuthenticated = true)
            } else {
                mobileOnboardingFeedback = null
                null
            }
            activeMobileOnboardingStepId
                ?.let { MobileOnboardingJourney.stepFor(it, isAuthenticated = true) }
                ?.let { step -> navigateForMobileOnboarding(step.route) }
        }

        fun closeMobileOnboardingAndReturnHome() {
            MobileOnboardingStore.markSeenForCurrentUser()
            showMobileOnboarding = false
            activeMobileOnboardingStepId = null
            mobileOnboardingFeedback = null
            mobileOnboardingPracticeHelpRequest = null
            navController.navigate(Routes.Home.route) {
                popUpTo(navController.graph.id) { inclusive = true }
                launchSingleTop = true
            }
        }

        fun completeMobileOnboardingStep(message: String?) {
            val currentStepId = activeMobileOnboardingStepId ?: return
            mobileOnboardingFeedback = message
            val nextStep = MobileOnboardingJourney.nextStep(currentStepId, isAuthenticated)
            if (nextStep == null) {
                closeMobileOnboardingAndReturnHome()
            } else {
                setMobileOnboardingStep(nextStep.id)
            }
        }

        fun updateMobileOnboardingFeedback(message: String?) {
            if (showMobileOnboarding) {
                mobileOnboardingFeedback = message
            }
        }

        fun updateMobileOnboardingPracticeHelpRequest(request: MobileOnboardingPracticeHelpRequest?) {
            if (showMobileOnboarding) {
                mobileOnboardingPracticeHelpRequest = request
            }
        }

        LaunchedEffect(accessToken, currentRoute, mobileOnboardingRevision) {
            val shouldShow = shouldShowMobileOnboardingForRoute(currentRoute)
            showMobileOnboarding = shouldShow
            activeMobileOnboardingStepId = if (shouldShow) {
                MobileOnboardingStore.currentStepForCurrentUser(isAuthenticated)
            } else {
                mobileOnboardingFeedback = null
                null
            }
        }

        LaunchedEffect(showMobileOnboarding, activeMobileOnboardingStepId, currentRoute, isAuthenticated) {
            val step = activeMobileOnboardingStepId?.let { MobileOnboardingJourney.stepFor(it, isAuthenticated) }
            val routeBase = currentRoute?.substringBefore('?')
            if (showMobileOnboarding && step != null && routeBase != step.route) {
                navigateForMobileOnboarding(step.route)
            }
        }

        BackHandler(enabled = canPopBackStack || shouldConfirmExit) {
            if (canPopBackStack) {
                navController.popBackStack()
            } else if (shouldConfirmExit) {
                showExitDialog = true
            }
        }

        if (showExitDialog) {
            AlertDialog(
                onDismissRequest = { showExitDialog = false },
                title = { Text("Exit NEPH?") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showExitDialog = false
                            activity?.finish()
                        }
                    ) {
                        Text("Exit")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showExitDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }

        val initialStartDestination = remember {
            when {
                !AuthSessionStore.getAccessToken().isNullOrBlank() -> Routes.Home.route
                AuthSessionStore.isGuestMode() && RequestHelpRepository.shouldOpenGuestRequestsOnStart() -> {
                    Routes.MyHelpRequests.route
                }
                AuthSessionStore.isGuestMode() -> Routes.Home.route
                else -> Routes.Welcome.route
            }
        }

        AppNavGraph(
            navController = navController,
            startDestination = initialStartDestination,
            onRestartMobileOnboarding = ::restartMobileOnboarding,
            onAuthenticatedLoginCompleted = ::showPendingMobileOnboardingAfterLogin,
            mobileOnboardingStepId = activeMobileOnboardingStepId.takeIf { showMobileOnboarding },
            onMobileOnboardingStepCompleted = ::completeMobileOnboardingStep,
            onMobileOnboardingFeedbackChanged = ::updateMobileOnboardingFeedback,
            mobileOnboardingPracticeHelpRequest = mobileOnboardingPracticeHelpRequest,
            onMobileOnboardingPracticeHelpRequestChanged = ::updateMobileOnboardingPracticeHelpRequest
        )

        val activeStepId = activeMobileOnboardingStepId
        val activeStep = activeStepId?.let { MobileOnboardingJourney.stepFor(it, isAuthenticated) }
        val activeRouteBase = currentRoute?.substringBefore('?')
        if (
            showMobileOnboarding &&
            activeStepId != null &&
            activeStep != null &&
            activeRouteBase == activeStep.route
        ) {
            val (stepNumber, totalSteps) = MobileOnboardingJourney.progressFor(activeStepId, isAuthenticated)
            MobileOnboardingGuide(
                step = activeStep,
                stepNumber = stepNumber,
                totalSteps = totalSteps,
                isOnTargetRoute = true,
                feedbackMessage = mobileOnboardingFeedback,
                onNavigateToStep = {
                    navigateForMobileOnboarding(activeStep.route)
                },
                onContinue = {
                    completeMobileOnboardingStep(activeStep.completionMessage)
                },
                onBack = {
                    MobileOnboardingJourney.previousStep(activeStepId, isAuthenticated)?.let { previousStep ->
                        setMobileOnboardingStep(previousStep.id)
                        mobileOnboardingFeedback = null
                    }
                },
                onSkip = ::closeMobileOnboardingAndReturnHome,
                onFinish = ::closeMobileOnboardingAndReturnHome
            )
        }
    }
}

private fun shouldShowMobileOnboardingForRoute(currentRoute: String?): Boolean {
    if (currentRoute.isNullOrBlank()) {
        return false
    }

    val routeBase = currentRoute.substringBefore('?')
    val onboardingSuppressedRoutes = setOf(
        Routes.Welcome.route,
        Routes.Login.route,
        Routes.Signup.route,
        Routes.VerifyEmail.route,
        Routes.CompleteProfile.route,
        Routes.ForgotPassword.route,
        Routes.ResetPassword.route,
        Routes.TermsOfService.route,
        Routes.PrivacyPolicy.route
    )

    if (routeBase in onboardingSuppressedRoutes) {
        return false
    }

    return MobileOnboardingStore.shouldShowForCurrentUser()
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
fun NephAppPreview() {
    NephApp()
}
