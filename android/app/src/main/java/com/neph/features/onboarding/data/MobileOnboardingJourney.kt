package com.neph.features.onboarding.data

import com.neph.navigation.Routes

enum class MobileOnboardingStepId {
    HOME_DASHBOARD,
    REQUEST_HELP_TYPE,
    REQUEST_HELP_RISK_FIRE,
    REQUEST_HELP_CONFIRM,
    REQUEST_HELP_SEND,
    MY_HELP_REQUESTS,
    OPEN_ASSIGNED_REQUESTS_MENU,
    SELECT_ASSIGNED_REQUEST,
    ASSIGNED_REQUESTS,
    OPEN_EMERGENCY_NUMBERS_MENU,
    SELECT_EMERGENCY_NUMBERS,
    EMERGENCY_NUMBERS,
    OPEN_HELP_REQUEST_MAP_MENU,
    SELECT_HELP_REQUEST_MAP,
    HELP_REQUEST_MAP,
    OPEN_NEARBY_USERS_MENU,
    SELECT_NEARBY_USERS,
    NEARBY_USERS,
    OPEN_GATHERING_AREAS_MENU,
    SELECT_GATHERING_AREAS,
    GATHERING_AREAS,
    OPEN_SAFETY_CIRCLES_MENU,
    SELECT_SAFETY_CIRCLES,
    SAFETY_CIRCLES,
    OPEN_NOTIFICATIONS_MENU,
    SELECT_NOTIFICATIONS,
    NOTIFICATIONS,
    OPEN_SETTINGS_MENU,
    SELECT_SETTINGS,
    SETTINGS
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
    val authenticatedOnly: Boolean = false,
    val opensMenu: Boolean = false,
    val menuTargetRoute: String? = null
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
            id = MobileOnboardingStepId.MY_HELP_REQUESTS,
            route = Routes.MyHelpRequests.route,
            title = "My Help Requests",
            eyebrow = "Track your request",
            description = "After a real help request is sent, NEPH brings you here to track it. During the guide, your practice request is shown only as a temporary preview.",
            actionLabel = "Continue",
            targetHint = "Review the temporary practice request, then continue to Assigned Request.",
            completionMessage = "You saw where your own help requests appear after sending.",
            panelPlacement = MobileOnboardingPanelPlacement.BOTTOM
        ),
        menuOpenStep(
            id = MobileOnboardingStepId.OPEN_ASSIGNED_REQUESTS_MENU,
            route = Routes.MyHelpRequests.route,
            nextPageName = "Assigned Request",
            panelPlacement = MobileOnboardingPanelPlacement.CENTER
        ),
        menuSelectStep(
            id = MobileOnboardingStepId.SELECT_ASSIGNED_REQUEST,
            route = Routes.MyHelpRequests.route,
            target = Routes.AssignedRequest,
            title = "Assigned Request",
            description = "Assigned Request shows the emergency support request currently assigned to you, if there is one.",
            completionMessage = "You opened Assigned Request."
        ),
        pageStep(
            id = MobileOnboardingStepId.ASSIGNED_REQUESTS,
            route = Routes.AssignedRequest.route,
            title = "Assigned Requests",
            eyebrow = "Follow work assigned to you",
            description = "This is where assigned support requests and next actions appear. If you have an assignment, it appears here; otherwise NEPH tells you there is no assigned request right now.",
            completionMessage = "You checked whether there is an assigned request for you."
        ),
        menuOpenStep(
            id = MobileOnboardingStepId.OPEN_EMERGENCY_NUMBERS_MENU,
            route = Routes.AssignedRequest.route,
            nextPageName = "Emergency Numbers"
        ),
        menuSelectStep(
            id = MobileOnboardingStepId.SELECT_EMERGENCY_NUMBERS,
            route = Routes.AssignedRequest.route,
            target = Routes.EmergencyInfo,
            title = "Emergency Numbers",
            description = "Emergency Numbers keeps quick-call public emergency contacts close when you need immediate outside help.",
            completionMessage = "You opened Emergency Numbers."
        ),
        pageStep(
            id = MobileOnboardingStepId.EMERGENCY_NUMBERS,
            route = Routes.EmergencyInfo.route,
            title = "Emergency Numbers",
            eyebrow = "Call critical services",
            description = "Use this page to quickly reach emergency services such as 112, police, fire, and other public support lines.",
            completionMessage = "You reviewed where emergency contact numbers live."
        ),
        menuOpenStep(
            id = MobileOnboardingStepId.OPEN_HELP_REQUEST_MAP_MENU,
            route = Routes.EmergencyInfo.route,
            nextPageName = "Help Request Map"
        ),
        menuSelectStep(
            id = MobileOnboardingStepId.SELECT_HELP_REQUEST_MAP,
            route = Routes.EmergencyInfo.route,
            target = Routes.HelpRequestMap,
            title = "Help Request Map",
            description = "The map helps you understand active needs around you and where support may be required.",
            completionMessage = "You opened Help Request Map."
        ),
        pageStep(
            id = MobileOnboardingStepId.HELP_REQUEST_MAP,
            route = Routes.HelpRequestMap.route,
            title = "Help Request Map",
            eyebrow = "See needs nearby",
            description = "Use this page to view help requests on the map and orient yourself before moving toward support locations.",
            completionMessage = "You reviewed the map for nearby needs."
        ),
        menuOpenStep(
            id = MobileOnboardingStepId.OPEN_NEARBY_USERS_MENU,
            route = Routes.HelpRequestMap.route,
            nextPageName = "Nearby Users"
        ),
        menuSelectStep(
            id = MobileOnboardingStepId.SELECT_NEARBY_USERS,
            route = Routes.HelpRequestMap.route,
            target = Routes.NearbyUsers,
            title = "Nearby Users",
            description = "Nearby Users helps you understand who else is visible around you for coordination.",
            completionMessage = "You opened Nearby Users."
        ),
        pageStep(
            id = MobileOnboardingStepId.NEARBY_USERS,
            route = Routes.NearbyUsers.route,
            title = "Nearby Users",
            eyebrow = "Coordinate locally",
            description = "This page shows visible nearby people when location and account settings allow it.",
            completionMessage = "You reviewed nearby-user coordination."
        ),
        menuOpenStep(
            id = MobileOnboardingStepId.OPEN_GATHERING_AREAS_MENU,
            route = Routes.NearbyUsers.route,
            nextPageName = "Gathering Areas"
        ),
        menuSelectStep(
            id = MobileOnboardingStepId.SELECT_GATHERING_AREAS,
            route = Routes.NearbyUsers.route,
            target = Routes.GatheringAreas,
            title = "Gathering Areas",
            description = "Gathering Areas helps you find safer public places and coordination points.",
            completionMessage = "You opened Gathering Areas."
        ),
        pageStep(
            id = MobileOnboardingStepId.GATHERING_AREAS,
            route = Routes.GatheringAreas.route,
            title = "Gathering Areas",
            eyebrow = "Find safe places",
            description = "Use this page to explore nearby gathering areas and shelter-like places on the map.",
            completionMessage = "You reviewed gathering areas."
        ),
        menuOpenStep(
            id = MobileOnboardingStepId.OPEN_SAFETY_CIRCLES_MENU,
            route = Routes.GatheringAreas.route,
            nextPageName = "Safety Circles"
        ),
        menuSelectStep(
            id = MobileOnboardingStepId.SELECT_SAFETY_CIRCLES,
            route = Routes.GatheringAreas.route,
            target = Routes.SafetyCircles,
            title = "Safety Circles",
            description = "Safety Circles are private groups for checking in with trusted people.",
            completionMessage = "You opened Safety Circles."
        ),
        pageStep(
            id = MobileOnboardingStepId.SAFETY_CIRCLES,
            route = Routes.SafetyCircles.route,
            title = "Safety Circles",
            eyebrow = "Stay connected",
            description = "Use this page to create circles, invite trusted people, and coordinate check-ins.",
            completionMessage = "You reviewed safety circles."
        ),
        menuOpenStep(
            id = MobileOnboardingStepId.OPEN_NOTIFICATIONS_MENU,
            route = Routes.SafetyCircles.route,
            nextPageName = "Notifications"
        ),
        menuSelectStep(
            id = MobileOnboardingStepId.SELECT_NOTIFICATIONS,
            route = Routes.SafetyCircles.route,
            target = Routes.Notifications,
            title = "Notifications",
            description = "Notifications collect alerts, assignment updates, and coordination messages.",
            completionMessage = "You opened Notifications."
        ),
        pageStep(
            id = MobileOnboardingStepId.NOTIFICATIONS,
            route = Routes.Notifications.route,
            title = "Notifications",
            eyebrow = "Review app alerts",
            description = "Use this page to catch up on unread alerts and recent emergency coordination updates.",
            completionMessage = "You reviewed notifications."
        ),
        menuOpenStep(
            id = MobileOnboardingStepId.OPEN_SETTINGS_MENU,
            route = Routes.Notifications.route,
            nextPageName = "Settings"
        ),
        menuSelectStep(
            id = MobileOnboardingStepId.SELECT_SETTINGS,
            route = Routes.Notifications.route,
            target = Routes.Settings,
            title = "Settings",
            description = "Settings is where you can restart this guide, manage privacy and security, or sign out.",
            completionMessage = "You opened Settings."
        ),
        pageStep(
            id = MobileOnboardingStepId.SETTINGS,
            route = Routes.Settings.route,
            title = "Settings",
            eyebrow = "Manage your account",
            description = "The guide is complete. You can restart it later from Settings whenever you want to practice the core flow again.",
            actionLabel = "Finish guide",
            targetHint = "Click Finish to close the guide and return Home.",
            panelPlacement = MobileOnboardingPanelPlacement.CENTER
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
        val totalCountedSteps = available.count { !it.opensMenu }.coerceAtLeast(1)
        val currentStep = available.getOrNull(currentIndex)
        val countedStepNumber = if (currentStep?.opensMenu == true) {
            available.take(currentIndex).count { !it.opensMenu }
        } else {
            available.take(currentIndex + 1).count { !it.opensMenu }
        }.coerceIn(1, totalCountedSteps)

        return countedStepNumber to totalCountedSteps
    }

    private fun menuOpenStep(
        id: MobileOnboardingStepId,
        route: String,
        nextPageName: String,
        panelPlacement: MobileOnboardingPanelPlacement = MobileOnboardingPanelPlacement.CENTER
    ): MobileOnboardingStep {
        return MobileOnboardingStep(
            id = id,
            route = route,
            title = "Open the Menu",
            eyebrow = "Move to the next section",
            description = "Open the bottom Menu to continue to $nextPageName.",
            actionLabel = "Tap Menu",
            targetHint = "Open the menu to find $nextPageName.",
            completionMessage = "You opened the app menu.",
            usesExistingTarget = true,
            panelPlacement = panelPlacement,
            authenticatedOnly = true,
            opensMenu = true
        )
    }

    private fun menuSelectStep(
        id: MobileOnboardingStepId,
        route: String,
        target: Routes,
        title: String,
        description: String,
        completionMessage: String
    ): MobileOnboardingStep {
        return MobileOnboardingStep(
            id = id,
            route = route,
            title = title,
            eyebrow = "Choose it from the menu",
            description = description,
            actionLabel = "Tap ${target.drawerLabel ?: title}",
            targetHint = "Open ${target.drawerLabel ?: title} from the menu.",
            completionMessage = completionMessage,
            usesExistingTarget = true,
            panelPlacement = MobileOnboardingPanelPlacement.TOP,
            authenticatedOnly = true,
            menuTargetRoute = target.route
        )
    }

    private fun pageStep(
        id: MobileOnboardingStepId,
        route: String,
        title: String,
        eyebrow: String,
        description: String,
        actionLabel: String = "Continue",
        targetHint: String = "",
        completionMessage: String? = null,
        panelPlacement: MobileOnboardingPanelPlacement = MobileOnboardingPanelPlacement.CENTER
    ): MobileOnboardingStep {
        return MobileOnboardingStep(
            id = id,
            route = route,
            title = title,
            eyebrow = eyebrow,
            description = description,
            actionLabel = actionLabel,
            targetHint = targetHint,
            completionMessage = completionMessage,
            panelPlacement = panelPlacement,
            authenticatedOnly = true
        )
    }
}
