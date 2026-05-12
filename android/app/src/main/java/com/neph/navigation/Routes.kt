package com.neph.navigation

sealed class Routes(
    val route: String,
    val drawerLabel: String? = null
) {
    data object Home : Routes("home", "Home")
    data object News : Routes("news", "News & Announcements")
    data object NewsDetail : Routes("news_detail", "Announcement")
    data object RequestHelp : Routes("request_help")
    data object MyHelpRequests : Routes("my_help_requests", "My Help Requests")
    data object AssignedRequest : Routes("assigned_request", "Assigned Request")
    data object EmergencyInfo : Routes("emergency_info", "Emergency Numbers")
    data object HelpRequestMap : Routes("help_request_map", "Help Request Map")
    data object NearbyUsers : Routes("nearby_users", "Nearby Users")
    data object GatheringAreas : Routes("gathering_areas", "Gathering Areas")
    data object SafetyCircles : Routes("safety_circles", "Safety Circles")
    data object Notifications : Routes("notifications", "Notifications")
    data object Settings : Routes("settings", "Settings")
    data object PrivacySecurity : Routes("privacy_security")
    data object Welcome : Routes("welcome")
    data object Login : Routes("login")
    data object Signup : Routes("signup")
    data object VerifyEmail : Routes("verify_email")
    data object CompleteProfile : Routes("complete_profile")
    data object ForgotPassword : Routes("forgot_password")
    data object ResetPassword : Routes("reset_password")
    data object TermsOfService : Routes("terms_of_service")
    data object PrivacyPolicy : Routes("privacy_policy")
    data object Profile : Routes("profile", "Profile")
    data object EditProfile : Routes("edit_profile")

    companion object {
        const val RequestHelpDraftArg = "draftLocalId"

        fun requestHelpWithDraft(localId: String): String = "${RequestHelp.route}?$RequestHelpDraftArg=$localId"

        const val NewsAnnouncementIdArg = "announcementId"

        fun newsDetail(announcementId: String): String =
            "${NewsDetail.route}/$announcementId"

        val authenticatedDrawerItems = listOf(
            Home,
            News,
            MyHelpRequests,
            AssignedRequest,
            EmergencyInfo,
            HelpRequestMap,
            NearbyUsers,
            GatheringAreas,
            SafetyCircles,
            Notifications
        )

        val guestDrawerItems = listOf(
            Home,
            News,
            MyHelpRequests,
            EmergencyInfo,
            HelpRequestMap,
            GatheringAreas
        )

        val drawerItems = authenticatedDrawerItems

        // Primary destinations exposed in the bottom NavigationBar.
        // Layout: [Menu] · Requests · Home · Map · Alerts
        // The Menu (hamburger) item is rendered separately by the scaffold and
        // opens an upward-sliding panel containing News and the remaining
        // drawer destinations. Alerts (Notifications) shows a badge for new
        // unread items.
        val authenticatedBottomNavItems = listOf(
            MyHelpRequests,
            Home,
            HelpRequestMap,
            Notifications
        )

        val guestBottomNavItems = listOf(
            MyHelpRequests,
            Home,
            HelpRequestMap,
            Notifications
        )
    }
}
