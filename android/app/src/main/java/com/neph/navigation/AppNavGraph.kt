package com.neph.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.neph.features.assignedrequest.presentation.AssignedRequestScreen
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.auth.presentation.CompleteProfileScreen
import com.neph.features.auth.presentation.ForgotPasswordScreen
import com.neph.features.auth.presentation.LoginScreen
import com.neph.features.auth.presentation.PrivacyPolicyScreen
import com.neph.features.auth.presentation.SignupScreen
import com.neph.features.auth.presentation.TermsOfServiceScreen
import com.neph.features.auth.presentation.VerifyEmailScreen
import com.neph.features.auth.presentation.WelcomeScreen
import com.neph.features.emergencyinfo.presentation.EmergencyInfoScreen
import com.neph.features.gatheringareas.presentation.GatheringAreasScreen
import com.neph.features.home.presentation.HomeScreen
import com.neph.features.myhelprequests.presentation.MyHelpRequestsScreen
import com.neph.features.news.presentation.NewsScreen
import com.neph.features.notifications.presentation.NotificationsScreen
import com.neph.features.privacysecurity.presentation.PrivacySecurityScreen
import com.neph.features.profile.data.ProfileRepository
import com.neph.features.profile.presentation.EditProfileScreen
import com.neph.features.profile.presentation.ProfileScreen
import com.neph.features.requesthelp.presentation.RequestHelpScreen
import com.neph.features.settings.presentation.SettingsScreen

@Composable
fun AppNavGraph(
    navController: NavHostController,
    startDestination: String = Routes.Welcome.route
) {
    fun isAuthenticated(): Boolean = AuthSessionStore.getAccessToken().isNullOrBlank().not()

    fun navigateToLogin() {
        navController.navigate(Routes.Login.route) {
            launchSingleTop = true
        }
    }

    fun canAccessRoute(route: String): Boolean {
        if (isAuthenticated()) return true

        return route in setOf(
            Routes.Home.route,
            Routes.News.route,
            Routes.EmergencyInfo.route,
            Routes.RequestHelp.route,
            Routes.Welcome.route,
            Routes.Login.route,
            Routes.Signup.route,
            Routes.VerifyEmail.route,
            Routes.ForgotPassword.route,
            Routes.TermsOfService.route,
            Routes.PrivacyPolicy.route
        )
    }

    fun navigateToDrawerRoute(route: String) {
        if (!canAccessRoute(route)) {
            navigateToLogin()
            return
        }

        navController.navigate(route) {
            popUpTo(Routes.Home.route) {
                saveState = true
            }
            launchSingleTop = true
            restoreState = true
        }
    }

    fun resolveProfileBadgeText(authenticated: Boolean): String {
        if (!authenticated) return ""

        val fullName = ProfileRepository.getProfile().fullName.orEmpty().trim()
        if (fullName.isBlank()) return "PP"

        val parts = fullName.split(Regex("\\s+")).filter { it.isNotBlank() }
        val initials = when {
            parts.isEmpty() -> ""
            parts.size == 1 -> parts.first().take(2)
            else -> "${parts.first().first()}${parts.last().first()}"
        }

        return initials.uppercase().ifBlank { "PP" }
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Routes.Home.route) {
            val authenticated = isAuthenticated()
            val profileBadgeText = resolveProfileBadgeText(authenticated)

            HomeScreen(
                onRequestHelp = {
                    navController.navigate(Routes.RequestHelp.route)
                },
                onNavigateToRoute = ::navigateToDrawerRoute,
                onOpenSettings = if (authenticated) {
                    { navigateToDrawerRoute(Routes.Settings.route) }
                } else {
                    null
                },
                onProfileClick = {
                    if (authenticated) {
                        navigateToDrawerRoute(Routes.Profile.route)
                    } else {
                        navigateToLogin()
                    }
                },
                profileBadgeText = profileBadgeText,
                isAuthenticated = authenticated
            )
        }

        composable(Routes.News.route) {
            val authenticated = isAuthenticated()
            val profileBadgeText = resolveProfileBadgeText(authenticated)

            NewsScreen(
                onNavigateToRoute = ::navigateToDrawerRoute,
                onOpenSettings = if (authenticated) {
                    { navigateToDrawerRoute(Routes.Settings.route) }
                } else {
                    null
                },
                onProfileClick = {
                    if (authenticated) {
                        navigateToDrawerRoute(Routes.Profile.route)
                    } else {
                        navigateToLogin()
                    }
                },
                profileBadgeText = profileBadgeText,
                isAuthenticated = authenticated
            )
        }

        composable(Routes.MyHelpRequests.route) {
            MyHelpRequestsScreen(
                onNavigateToRoute = ::navigateToDrawerRoute,
                onOpenSettings = {
                    navigateToDrawerRoute(Routes.Settings.route)
                }
            )
        }

        composable(Routes.AssignedRequest.route) {
            AssignedRequestScreen(
                onNavigateToRoute = ::navigateToDrawerRoute,
                onOpenSettings = {
                    navigateToDrawerRoute(Routes.Settings.route)
                }
            )
        }

        composable(Routes.Profile.route) {
            ProfileScreen(
                onNavigateToRoute = ::navigateToDrawerRoute,
                onOpenSettings = {
                    navigateToDrawerRoute(Routes.Settings.route)
                },
                onNavigateToCompleteProfile = {
                    navController.navigate(Routes.CompleteProfile.route) {
                        launchSingleTop = true
                    }
                },
                onNavigateToEditProfile = {
                    navController.navigate(Routes.EditProfile.route)
                },
                onLogout = {
                    navController.navigate(Routes.Welcome.route) {
                        popUpTo(navController.graph.id) { inclusive = true }
                        launchSingleTop = true
                    }
                }
            )
        }

        composable(Routes.EmergencyInfo.route) {
            val authenticated = isAuthenticated()
            val profileBadgeText = resolveProfileBadgeText(authenticated)

            EmergencyInfoScreen(
                onNavigateToRoute = ::navigateToDrawerRoute,
                onOpenSettings = if (authenticated) {
                    { navigateToDrawerRoute(Routes.Settings.route) }
                } else {
                    null
                },
                onProfileClick = {
                    if (authenticated) {
                        navigateToDrawerRoute(Routes.Profile.route)
                    } else {
                        navigateToLogin()
                    }
                },
                profileBadgeText = profileBadgeText,
                isAuthenticated = authenticated
            )
        }

        composable(Routes.GatheringAreas.route) {
            GatheringAreasScreen(
                onNavigateToRoute = ::navigateToDrawerRoute,
                onOpenSettings = {
                    navigateToDrawerRoute(Routes.Settings.route)
                }
            )
        }

        composable(Routes.Notifications.route) {
            NotificationsScreen(
                onNavigateToRoute = ::navigateToDrawerRoute,
                onOpenSettings = {
                    navigateToDrawerRoute(Routes.Settings.route)
                }
            )
        }

        composable(Routes.Settings.route) {
            SettingsScreen(
                onNavigateToRoute = ::navigateToDrawerRoute,
                onNavigateToPrivacySecurity = {
                    navController.navigate(Routes.PrivacySecurity.route)
                },
                onLogout = {
                    AuthRepository.logout()
                    navController.navigate(Routes.Welcome.route) {
                        popUpTo(navController.graph.id) { inclusive = true }
                        launchSingleTop = true
                    }
                }
            )
        }

        composable(Routes.PrivacySecurity.route) {
            PrivacySecurityScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.RequestHelp.route) {
            RequestHelpScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.Welcome.route) {
            WelcomeScreen(
                onNavigateToLogin = {
                    navController.navigate(Routes.Login.route)
                },
                onNavigateToSignup = {
                    navController.navigate(Routes.Signup.route)
                },
                onContinueAsGuest = {
                    navController.navigate(Routes.Home.route) {
                        popUpTo(Routes.Welcome.route) { inclusive = true }
                        launchSingleTop = true
                    }
                }
            )
        }

        composable(Routes.Login.route) {
            LoginScreen(
                onNavigateToSignup = {
                    navController.navigate(Routes.Signup.route)
                },
                onLoginSuccess = {
                    navController.navigate(Routes.Home.route) {
                        popUpTo(Routes.Welcome.route) { inclusive = true }
                        launchSingleTop = true
                    }
                },
                onProfileCompletionRequired = {
                    navController.navigate(Routes.CompleteProfile.route) {
                        popUpTo(Routes.Welcome.route) { inclusive = false }
                        launchSingleTop = true
                    }
                },
                onEmailVerificationRequired = {
                    navController.navigate(Routes.VerifyEmail.route) {
                        launchSingleTop = true
                    }
                },
                onNavigateToForgotPassword = {
                    navController.navigate(Routes.ForgotPassword.route)
                }
            )
        }

        composable(Routes.Signup.route) {
            SignupScreen(
                onNavigateToLogin = {
                    navController.popBackStack()
                },
                onSignupSuccess = {
                    navController.navigate(Routes.VerifyEmail.route) {
                        launchSingleTop = true
                    }
                },
                onNavigateToTerms = {
                    navController.navigate(Routes.TermsOfService.route)
                },
                onNavigateToPrivacy = {
                    navController.navigate(Routes.PrivacyPolicy.route)
                }
            )
        }

        composable(Routes.VerifyEmail.route) {
            VerifyEmailScreen(
                onContinueToLogin = {
                    navController.navigate(Routes.CompleteProfile.route) {
                        popUpTo(Routes.Welcome.route) { inclusive = false }
                        launchSingleTop = true
                    }
                },
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.CompleteProfile.route) {
            CompleteProfileScreen(
                onComplete = {
                    navController.navigate(Routes.Home.route) {
                        popUpTo(Routes.Welcome.route) { inclusive = true }
                        launchSingleTop = true
                    }
                },
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.ForgotPassword.route) {
            ForgotPasswordScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.TermsOfService.route) {
            TermsOfServiceScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.PrivacyPolicy.route) {
            PrivacyPolicyScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.EditProfile.route) {
            EditProfileScreen(
                onSave = { navController.popBackStack() },
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}