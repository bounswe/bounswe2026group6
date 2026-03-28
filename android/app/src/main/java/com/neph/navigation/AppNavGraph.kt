package com.neph.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.neph.features.auth.presentation.ForgotPasswordScreen
import com.neph.features.auth.presentation.LoginScreen
import com.neph.features.auth.presentation.PrivacyPolicyScreen
import com.neph.features.auth.presentation.SignupScreen
import com.neph.features.auth.presentation.TermsOfServiceScreen
import com.neph.features.auth.presentation.VerifyEmailScreen
import com.neph.features.auth.presentation.WelcomeScreen
import com.neph.features.privacy.presentation.PrivacyScreen
import com.neph.features.profile.presentation.ProfileScreen

@Composable
fun AppNavGraph(
    navController: NavHostController,
    startDestination: String = Routes.Welcome.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Routes.Welcome.route) {
            WelcomeScreen(
                onNavigateToLogin = {
                    navController.navigate(Routes.Login.route)
                },
                onNavigateToSignup = {
                    navController.navigate(Routes.Signup.route)
                },
                onContinueAsGuest = {
                    navController.navigate(Routes.Login.route)
                }
            )
        }

        composable(Routes.Login.route) {
            LoginScreen(
                onNavigateToSignup = {
                    navController.navigate(Routes.Signup.route)
                },
                onLoginSuccess = {
                    navController.navigate(Routes.Profile.route) {
                        popUpTo(Routes.Welcome.route) { inclusive = false }
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
                    navController.navigate(Routes.VerifyEmail.route)
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
                onVerificationSuccess = {
                    navController.navigate(Routes.Profile.route) {
                        popUpTo(Routes.Welcome.route) { inclusive = false }
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

        composable(Routes.Profile.route) {
            ProfileScreen(
                onNavigateToPrivacy = {
                    navController.navigate(Routes.Privacy.route)
                },
                onNavigateToSecurity = {
                    navController.navigate(Routes.Security.route)
                },
                onLogout = {
                    navController.navigate(Routes.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.Privacy.route) {
            PrivacyScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.Security.route) {
            SecurityPlaceholderScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }
    }
}