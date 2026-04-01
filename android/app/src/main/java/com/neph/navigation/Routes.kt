package com.neph.navigation

sealed class Routes(
    val route: String,
    val drawerLabel: String? = null
) {
    data object Home : Routes("home", "Home")
    data object News : Routes("news", "News & Announcements")
    data object RequestHelp : Routes("request_help")
    data object MyHelpRequests : Routes("my_help_requests", "My Help Requests")
    data object AssignedRequest : Routes("assigned_request", "Assigned Request")
    data object EmergencyInfo : Routes("emergency_info", "Emergency Numbers")
    data object GatheringAreas : Routes("gathering_areas", "Gathering Areas")
    data object Notifications : Routes("notifications", "Notifications")
    data object Settings : Routes("settings", "Settings")
    data object PrivacySecurity : Routes("privacy_security")
    data object Welcome : Routes("welcome")
    data object Login : Routes("login")
    data object Signup : Routes("signup")
    data object VerifyEmail : Routes("verify_email")
    data object CompleteProfile : Routes("complete_profile")
    data object ForgotPassword : Routes("forgot_password")
    data object TermsOfService : Routes("terms_of_service")
    data object PrivacyPolicy : Routes("privacy_policy")
    data object Profile : Routes("profile", "Profile")
    data object EditProfile : Routes("edit_profile")

    companion object {
        val authenticatedDrawerItems = listOf(
            Home,
            News,
            MyHelpRequests,
            AssignedRequest,
            Profile,
            EmergencyInfo,
            GatheringAreas,
            Notifications,
            Settings
        )

        val guestDrawerItems = listOf(
            Home,
            News,
            EmergencyInfo
        )

        val drawerItems = authenticatedDrawerItems
    }
}