package com.neph.features.onboarding.data

import com.neph.navigation.Routes

enum class MobileOnboardingStepId {
    HOME_DASHBOARD,
    REQUEST_HELP_TYPE,
    REQUEST_HELP_RISK_FIRE,
    REQUEST_HELP_CONFIRM,
    REQUEST_HELP_SEND,
    OPEN_ASSIGNED_REQUESTS_MENU,
    SELECT_ASSIGNED_REQUEST,
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
    val completionMessage: String? = null,
    val usesExistingTarget: Boolean = false,
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
            completionMessage = "You opened the emergency help request flow.",
            usesExistingTarget = true,
            panelPlacement = MobileOnboardingPanelPlacement.BOTTOM
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.REQUEST_HELP_TYPE,
            route = Routes.RequestHelp.route,
            title = "Request Help",
            eyebrow = "Ask for support clearly",
            description = "Create a help request with accurate type, location, and details so responders understand what is needed. Start by choosing the type of support.",
            actionLabel = "Tap Fire Brigade",
            targetHint = "Use this chip when the emergency needs fire-related support.",
            completionMessage = "You selected Fire Brigade as the help type.",
            usesExistingTarget = true,
            panelPlacement = MobileOnboardingPanelPlacement.BOTTOM
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.REQUEST_HELP_RISK_FIRE,
            route = Routes.RequestHelp.route,
            title = "Risk Flags",
            eyebrow = "Add danger context",
            description = "Risk flags help responders understand hazards before they arrive.",
            actionLabel = "Tap Fire",
            targetHint = "Mark Fire when flames, smoke, or fire risk are part of the situation.",
            completionMessage = "You marked fire as a risk flag.",
            usesExistingTarget = true,
            panelPlacement = MobileOnboardingPanelPlacement.TOP
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.REQUEST_HELP_CONFIRM,
            route = Routes.RequestHelp.route,
            title = "Confirmation",
            eyebrow = "Confirm sharing",
            description = "Before sending, confirm the request details can be shared for emergency coordination.",
            actionLabel = "Tap the confirmation checkbox",
            targetHint = "This consent is required before NEPH can send the help request.",
            completionMessage = "You confirmed the request can be shared for emergency coordination.",
            usesExistingTarget = true,
            panelPlacement = MobileOnboardingPanelPlacement.TOP
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.REQUEST_HELP_SEND,
            route = Routes.RequestHelp.route,
            title = "Send Help Request",
            eyebrow = "Practice the final action",
            description = "The guide lets you practice the final send action without saving a real help request.",
            actionLabel = "Tap Send Help Request",
            targetHint = "During the guide, this only advances the tutorial and does not create a real request.",
            completionMessage = "Nice — that was only a practice send. No real help request was saved.",
            usesExistingTarget = true,
            panelPlacement = MobileOnboardingPanelPlacement.TOP
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.OPEN_ASSIGNED_REQUESTS_MENU,
            route = Routes.Home.route,
            title = "Open the Menu",
            eyebrow = "Find more app areas",
            description = "The bottom Menu opens the rest of the app sections you can use during coordination.",
            actionLabel = "Tap Menu",
            targetHint = "Open the menu to find Assigned Request.",
            completionMessage = "You opened the app menu.",
            usesExistingTarget = true,
            panelPlacement = MobileOnboardingPanelPlacement.TOP,
            authenticatedOnly = true
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.SELECT_ASSIGNED_REQUEST,
            route = Routes.Home.route,
            title = "Assigned Request",
            eyebrow = "Check assigned work",
            description = "Assigned Request shows the emergency support request currently assigned to you, if there is one.",
            actionLabel = "Tap Assigned Request",
            targetHint = "Open this page to see whether NEPH currently assigned you a request.",
            completionMessage = "You opened Assigned Request.",
            usesExistingTarget = true,
            panelPlacement = MobileOnboardingPanelPlacement.TOP,
            authenticatedOnly = true
        ),
        MobileOnboardingStep(
            id = MobileOnboardingStepId.ASSIGNED_REQUESTS,
            route = Routes.AssignedRequest.route,
            title = "Assigned Requests",
            eyebrow = "Follow work assigned to you",
            description = "This is where assigned support requests and next actions appear. The guide ends here.",
            actionLabel = "Finish guide",
            targetHint = "Click Finish to close the guide and continue using NEPH.",
            panelPlacement = MobileOnboardingPanelPlacement.CENTER,
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
