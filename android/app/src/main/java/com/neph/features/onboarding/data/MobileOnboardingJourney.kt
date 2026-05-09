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

enum class MobileOnboardingPanelPlacement {
    TOP,
    CENTER,
    BOTTOM
}

data class MobileOnboardingStep(
    val id: MobileOnboardingStepId,
    val route: String,
    val title: String,
    val eyebrow: String,
    val description: String,
    val actionLabel: String,
    val targetHint: String,
    val panelPlacement: MobileOnboardingPanelPlacement = MobileOnboardingPanelPlacement.BOTTOM,
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
            actionLabel = "Tap I need help now",
            targetHint = "This is the fastest emergency entry point on the home screen.",
            panelPlacement = MobileOnboardingPanelPlacement.TOP
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.REQUEST_HELP,
            route = Routes.RequestHelp.route,
            title = "Request Help",
            eyebrow = "Ask for support clearly",
            description = "Create a help request with accurate type, location, and details so responders understand what is needed.",
            actionLabel = "Tap My Help Requests",
            targetHint = "After creating or saving a request, this is where you follow its status.",
            panelPlacement = MobileOnboardingPanelPlacement.TOP
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.MY_HELP_REQUESTS,
            route = Routes.MyHelpRequests.route,
            title = "My Help Requests",
            eyebrow = "Track your requests",
            description = "Follow request status, local/offline saves, and updates after you submit or edit a request.",
            actionLabel = "Tap Help Request Map",
            targetHint = "Use the map next to understand needs around you.",
            panelPlacement = MobileOnboardingPanelPlacement.TOP
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.HELP_REQUEST_MAP,
            route = Routes.HelpRequestMap.route,
            title = "Help Request Map",
            eyebrow = "See community needs",
            description = "Use the map to understand active waiting requests around the community and where support is needed.",
            actionLabel = "Tap Gathering Areas",
            targetHint = "Switch from active requests to safe assembly/support points.",
            panelPlacement = MobileOnboardingPanelPlacement.TOP
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.GATHERING_AREAS,
            route = Routes.GatheringAreas.route,
            title = "Gathering Areas",
            eyebrow = "Find safe assembly points",
            description = "Review nearby gathering and support areas before or during an emergency.",
            actionLabel = "Tap Emergency Numbers",
            targetHint = "Keep direct emergency contacts close when app coordination is not enough.",
            panelPlacement = MobileOnboardingPanelPlacement.CENTER
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.EMERGENCY_NUMBERS,
            route = Routes.EmergencyInfo.route,
            title = "Emergency Numbers",
            eyebrow = "Fast emergency contacts",
            description = "Keep important emergency phone numbers close when you need direct help outside the app.",
            actionLabel = "Tap News & Announcements",
            targetHint = "Move to verified community updates after reviewing direct contacts.",
            panelPlacement = MobileOnboardingPanelPlacement.CENTER
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.NEWS,
            route = Routes.News.route,
            title = "News & Announcements",
            eyebrow = "Verified preparedness updates",
            description = "Read preparedness notes and community announcements without leaving NEPH.",
            actionLabel = "Tap Volunteer Availability",
            targetHint = "Authenticated users can also tell NEPH when they are ready to help.",
            panelPlacement = MobileOnboardingPanelPlacement.BOTTOM
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.VOLUNTEER_AVAILABILITY,
            route = Routes.Home.route,
            title = "Volunteer Availability",
            eyebrow = "Tell NEPH when you can help",
            description = "When you are available, NEPH can use your profile and location context for volunteer coordination.",
            actionLabel = "Tap Assigned Requests",
            targetHint = "Once available, assigned work appears in the assigned requests area.",
            panelPlacement = MobileOnboardingPanelPlacement.TOP,
            authenticatedOnly = true
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.ASSIGNED_REQUESTS,
            route = Routes.AssignedRequest.route,
            title = "Assigned Requests",
            eyebrow = "Follow work assigned to you",
            description = "If you volunteer, this is where assigned support requests and next actions appear.",
            actionLabel = "Tap Profile",
            targetHint = "Your profile and privacy settings control the coordination information others can use.",
            panelPlacement = MobileOnboardingPanelPlacement.CENTER,
            authenticatedOnly = true
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.PROFILE_PRIVACY,
            route = Routes.Profile.route,
            title = "Profile & Privacy",
            eyebrow = "Keep coordination data accurate",
            description = "Update your profile and use Privacy & Security settings to control what others can see.",
            actionLabel = "Finish guide",
            targetHint = "You have reached the end of the guided path.",
            panelPlacement = MobileOnboardingPanelPlacement.BOTTOM,
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
