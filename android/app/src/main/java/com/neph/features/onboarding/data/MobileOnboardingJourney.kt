package com.neph.features.onboarding.data

import com.neph.navigation.Routes

enum class MobileOnboardingStepId {
    HOME_DASHBOARD,
    REQUEST_HELP,
    MY_HELP_REQUESTS,
    HELP_REQUEST_MAP,
    GATHERING_AREAS,
    EMERGENCY_NUMBERS,
    NEWS,
    VOLUNTEER_AVAILABILITY,
    ASSIGNED_REQUESTS,
    PROFILE_PRIVACY
}

data class MobileOnboardingStep(
    val id: MobileOnboardingStepId,
    val route: String,
    val title: String,
    val eyebrow: String,
    val description: String,
    val actionLabel: String,
    val authenticatedOnly: Boolean = false
)

object MobileOnboardingJourney {
    private val steps = listOf(
        MobileOnboardingStep(
            id = MobileOnboardingStepId.HOME_DASHBOARD,
            route = Routes.Home.route,
            title = "Home Dashboard",
            eyebrow = "Your command center",
            description = "Start here to request help, mark yourself safe, review updates, and manage your volunteer status.",
            actionLabel = "Go to Home"
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.REQUEST_HELP,
            route = Routes.RequestHelp.route,
            title = "Request Help",
            eyebrow = "Ask for support clearly",
            description = "Create a help request with accurate type, location, and details so responders understand what is needed.",
            actionLabel = "Open Request Help"
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.MY_HELP_REQUESTS,
            route = Routes.MyHelpRequests.route,
            title = "My Help Requests",
            eyebrow = "Track your requests",
            description = "Follow request status, local/offline saves, and updates after you submit or edit a request.",
            actionLabel = "Open My Requests"
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.HELP_REQUEST_MAP,
            route = Routes.HelpRequestMap.route,
            title = "Help Request Map",
            eyebrow = "See community needs",
            description = "Use the map to understand active waiting requests around the community and where support is needed.",
            actionLabel = "Open Help Map"
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.GATHERING_AREAS,
            route = Routes.GatheringAreas.route,
            title = "Gathering Areas",
            eyebrow = "Find safe assembly points",
            description = "Review nearby gathering and support areas before or during an emergency.",
            actionLabel = "Open Gathering Areas"
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.EMERGENCY_NUMBERS,
            route = Routes.EmergencyInfo.route,
            title = "Emergency Numbers",
            eyebrow = "Fast emergency contacts",
            description = "Keep important emergency phone numbers close when you need direct help outside the app.",
            actionLabel = "Open Emergency Numbers"
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.NEWS,
            route = Routes.News.route,
            title = "News & Announcements",
            eyebrow = "Verified preparedness updates",
            description = "Read preparedness notes and community announcements without leaving NEPH.",
            actionLabel = "Open News"
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.VOLUNTEER_AVAILABILITY,
            route = Routes.Home.route,
            title = "Volunteer Availability",
            eyebrow = "Tell NEPH when you can help",
            description = "When you are available, NEPH can use your profile and location context for volunteer coordination.",
            actionLabel = "Return to Home",
            authenticatedOnly = true
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.ASSIGNED_REQUESTS,
            route = Routes.AssignedRequest.route,
            title = "Assigned Requests",
            eyebrow = "Follow work assigned to you",
            description = "If you volunteer, this is where assigned support requests and next actions appear.",
            actionLabel = "Open Assigned Requests",
            authenticatedOnly = true
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.PROFILE_PRIVACY,
            route = Routes.Profile.route,
            title = "Profile & Privacy",
            eyebrow = "Keep coordination data accurate",
            description = "Update your profile and use Privacy & Security settings to control what others can see.",
            actionLabel = "Open Profile",
            authenticatedOnly = true
        )
    )

    fun availableSteps(isAuthenticated: Boolean): List<MobileOnboardingStep> {
        return steps.filter { !it.authenticatedOnly || isAuthenticated }
    }

    fun firstStep(isAuthenticated: Boolean): MobileOnboardingStep {
        return availableSteps(isAuthenticated).first()
    }

    fun stepFor(id: MobileOnboardingStepId, isAuthenticated: Boolean): MobileOnboardingStep? {
        return availableSteps(isAuthenticated).firstOrNull { it.id == id }
    }

    fun nextStep(currentId: MobileOnboardingStepId, isAuthenticated: Boolean): MobileOnboardingStep? {
        val available = availableSteps(isAuthenticated)
        val currentIndex = available.indexOfFirst { it.id == currentId }
        if (currentIndex == -1) return available.firstOrNull()
        return available.getOrNull(currentIndex + 1)
    }

    fun previousStep(currentId: MobileOnboardingStepId, isAuthenticated: Boolean): MobileOnboardingStep? {
        val available = availableSteps(isAuthenticated)
        val currentIndex = available.indexOfFirst { it.id == currentId }
        if (currentIndex <= 0) return null
        return available[currentIndex - 1]
    }

    fun progressFor(currentId: MobileOnboardingStepId, isAuthenticated: Boolean): Pair<Int, Int> {
        val available = availableSteps(isAuthenticated)
        val currentIndex = available.indexOfFirst { it.id == currentId }.takeIf { it >= 0 } ?: 0
        return currentIndex + 1 to available.size
    }
}
