package com.neph.navigation

sealed class Routes(val route: String) {
    data object Welcome : Routes("welcome")
    data object Login : Routes("login")
    data object Signup : Routes("signup")
    data object VerifyEmail : Routes("verify_email")
    data object ForgotPassword : Routes("forgot_password")
    data object TermsOfService : Routes("terms_of_service")
    data object PrivacyPolicy : Routes("privacy_policy")
    data object Privacy : Routes("privacy")
    data object Profile : Routes("profile")
    data object Security : Routes("security")
}