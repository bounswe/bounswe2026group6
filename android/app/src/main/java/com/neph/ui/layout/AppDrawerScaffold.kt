package com.neph.ui.layout

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.NewReleases
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.automirrored.filled.ListAlt
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemColors
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import com.neph.features.notifications.data.NotificationsBadge
import com.neph.features.onboarding.data.MobileOnboardingJourney
import com.neph.features.onboarding.data.MobileOnboardingStepId
import com.neph.features.onboarding.presentation.mobileOnboardingPulse
import com.neph.navigation.Routes
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephSpacing

internal fun sanitizeDrawerItems(drawerItems: List<Routes?>): List<Routes> {
    return drawerItems.filterNotNull()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppDrawerScaffold(
    title: String,
    currentRoute: String,
    onNavigateToRoute: (String) -> Unit,
    drawerItems: List<Routes?> = Routes.drawerItems,
    bottomNavItems: List<Routes?> = Routes.authenticatedBottomNavItems,
    showBottomNav: Boolean = true,
    modifier: Modifier = Modifier,
    onOpenSettings: (() -> Unit)? = null,
    onProfileClick: (() -> Unit)? = null,
    profileBadgeText: String = "PP",
    profileLabel: String = "Profile",
    contentMaxWidth: Dp = 960.dp,
    contentFillMaxSize: Boolean = false,
    contentScrollable: Boolean = !contentFillMaxSize,
    contentAlignment: Alignment = Alignment.TopCenter,
    alertCount: Int = 0,
    mobileOnboardingStepId: MobileOnboardingStepId? = null,
    onMobileOnboardingStepCompleted: (String?) -> Unit = {},
    topBarActions: @Composable RowScope.() -> Unit = {},
    content: @Composable () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val safeDrawerItems = sanitizeDrawerItems(drawerItems)
    val safeBottomItems = sanitizeDrawerItems(bottomNavItems)

    val badgeUnread by NotificationsBadge.unreadCount.collectAsState()
    val effectiveAlertCount = maxOf(alertCount, badgeUnread)

    var menuOpen by remember { mutableStateOf(false) }
    val isOpenMenuOnboardingTarget = mobileOnboardingStepId == MobileOnboardingStepId.OPEN_ASSIGNED_REQUESTS_MENU
    val isSelectAssignedOnboardingTarget = mobileOnboardingStepId == MobileOnboardingStepId.SELECT_ASSIGNED_REQUEST
    val isMobileOnboardingActive = mobileOnboardingStepId != null

    fun completeMobileOnboardingStep(stepId: MobileOnboardingStepId) {
        val message = MobileOnboardingJourney.stepFor(stepId, isAuthenticated = true)?.completionMessage
        onMobileOnboardingStepCompleted(message)
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            modifier = modifier.fillMaxSize(),
            containerColor = MaterialTheme.colorScheme.background,
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    },
                    actions = {
                        topBarActions()
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.background,
                        scrolledContainerColor = MaterialTheme.colorScheme.background,
                        navigationIconContentColor = MaterialTheme.colorScheme.onSurface,
                        titleContentColor = MaterialTheme.colorScheme.onSurface,
                        actionIconContentColor = MaterialTheme.colorScheme.onSurface
                    )
                )
            },
            bottomBar = {
                if (showBottomNav) {
                    val itemColors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MaterialTheme.colorScheme.onPrimary,
                        selectedTextColor = MaterialTheme.colorScheme.primary,
                        indicatorColor = MaterialTheme.colorScheme.primary,
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    NavigationBar(
                        containerColor = MaterialTheme.colorScheme.surface,
                        tonalElevation = 0.dp
                    ) {
                        // Hamburger menu — opens the slide-up panel
                        NavigationBarItem(
                            selected = menuOpen,
                            onClick = {
                                if (isMobileOnboardingActive && !isOpenMenuOnboardingTarget) {
                                    return@NavigationBarItem
                                }

                                menuOpen = !menuOpen
                                if (isOpenMenuOnboardingTarget) {
                                    completeMobileOnboardingStep(MobileOnboardingStepId.OPEN_ASSIGNED_REQUESTS_MENU)
                                }
                            },
                            modifier = Modifier
                                .testTag("mobile_onboarding_target_menu")
                                .mobileOnboardingPulse(isOpenMenuOnboardingTarget),
                            icon = {
                                Icon(
                                    imageVector = Icons.Filled.Menu,
                                    contentDescription = "Open menu"
                                )
                            },
                            label = {
                                Text(
                                    text = "Menu",
                                    style = MaterialTheme.typography.labelSmall
                                )
                            },
                            alwaysShowLabel = true,
                            colors = itemColors
                        )
                        val nonHomeItems = safeBottomItems.filter { it != Routes.Home }
                        val leadingItems = nonHomeItems.take(1)
                        val trailingItems = nonHomeItems.drop(1)

                        leadingItems.forEach { item ->
                            BottomNavRouteItem(
                                item = item,
                                currentRoute = currentRoute,
                                effectiveAlertCount = effectiveAlertCount,
                                itemColors = itemColors,
                                mobileOnboardingActive = isMobileOnboardingActive,
                                onNavigateToRoute = onNavigateToRoute
                            )
                        }

                        BottomNavRouteItem(
                            item = Routes.Home,
                            currentRoute = currentRoute,
                            effectiveAlertCount = effectiveAlertCount,
                            itemColors = itemColors,
                            mobileOnboardingActive = isMobileOnboardingActive,
                            onNavigateToRoute = onNavigateToRoute
                        )

                        trailingItems.forEach { item ->
                            BottomNavRouteItem(
                                item = item,
                                currentRoute = currentRoute,
                                effectiveAlertCount = effectiveAlertCount,
                                itemColors = itemColors,
                                mobileOnboardingActive = isMobileOnboardingActive,
                                onNavigateToRoute = onNavigateToRoute
                            )
                        }
                    }
                }
            }
        ) { innerPadding ->
            ScreenContainer(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                scrollable = false
            ) {
                val contentModifier = Modifier
                    .then(
                        if (contentFillMaxSize) {
                            Modifier.fillMaxSize()
                        } else {
                            Modifier.fillMaxWidth()
                        }
                    )
                    .widthIn(max = contentMaxWidth)
                    .align(contentAlignment)
                    .then(
                        if (contentScrollable) {
                            Modifier.verticalScroll(rememberScrollState())
                        } else {
                            Modifier
                        }
                    )

                Column(
                    modifier = contentModifier,
                    verticalArrangement = Arrangement.spacedBy(spacing.lg)
                ) {
                    content()
                }
            }
        }

        // Translucent scrim + small slide-up menu anchored bottom-left
        MenuOverlay(
            visible = menuOpen,
            onDismiss = {
                if (!isMobileOnboardingActive) {
                    menuOpen = false
                }
            },
            spacing = spacing,
            drawerItems = safeDrawerItems,
            currentRoute = currentRoute,
            onSelect = { route ->
                menuOpen = false
                if (currentRoute != route) {
                    onNavigateToRoute(route)
                }
            },
            onProfileClick = onProfileClick?.let {
                {
                    menuOpen = false
                    it()
                }
            },
            profileBadgeText = profileBadgeText,
            profileLabel = profileLabel,
            onOpenSettings = onOpenSettings?.let {
                {
                    menuOpen = false
                    it()
                }
            },
            mobileOnboardingStepId = mobileOnboardingStepId,
            onMobileOnboardingStepCompleted = ::completeMobileOnboardingStep
        )
    }
}

@Composable
private fun RowScope.BottomNavRouteItem(
    item: Routes,
    currentRoute: String,
    effectiveAlertCount: Int,
    itemColors: NavigationBarItemColors,
    mobileOnboardingActive: Boolean,
    onNavigateToRoute: (String) -> Unit
) {
    val selected = currentRoute == item.route
    val isAlerts = item == Routes.Notifications
    NavigationBarItem(
        selected = selected,
        onClick = {
            if (mobileOnboardingActive) {
                return@NavigationBarItem
            }

            if (currentRoute != item.route) {
                onNavigateToRoute(item.route)
            }
        },
        icon = {
            if (isAlerts && effectiveAlertCount > 0) {
                BadgedBox(
                    badge = {
                        Badge {
                            Text(
                                text = if (effectiveAlertCount > 99) "99+" else effectiveAlertCount.toString()
                            )
                        }
                    }
                ) {
                    Icon(
                        imageVector = bottomNavIconFor(item),
                        contentDescription = item.drawerLabel ?: item.route
                    )
                }
            } else {
                Icon(
                    imageVector = bottomNavIconFor(item),
                    contentDescription = item.drawerLabel ?: item.route
                )
            }
        },
        label = {
            Text(
                text = bottomNavShortLabel(item),
                style = MaterialTheme.typography.labelSmall
            )
        },
        alwaysShowLabel = true,
        colors = itemColors
    )
}

@Composable
private fun BoxScope.MenuOverlay(
    visible: Boolean,
    onDismiss: () -> Unit,
    spacing: NephSpacing,
    drawerItems: List<Routes>,
    currentRoute: String,
    onSelect: (String) -> Unit,
    onProfileClick: (() -> Unit)?,
    profileBadgeText: String,
    profileLabel: String,
    onOpenSettings: (() -> Unit)?,
    mobileOnboardingStepId: MobileOnboardingStepId?,
    onMobileOnboardingStepCompleted: (MobileOnboardingStepId) -> Unit
) {
    val isSelectAssignedOnboardingTarget = mobileOnboardingStepId == MobileOnboardingStepId.SELECT_ASSIGNED_REQUEST
    val isMobileOnboardingActive = mobileOnboardingStepId != null

    // Translucent scrim — taps outside dismiss
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(),
        exit = fadeOut(),
        modifier = Modifier.fillMaxSize()
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.18f))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onDismiss
                )
        )
    }

    // Floating translucent panel anchored bottom-start, above bottom nav
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn() + slideInVertically(initialOffsetY = { it / 2 }),
        exit = fadeOut() + slideOutVertically(targetOffsetY = { it / 2 }),
        modifier = Modifier
            .align(Alignment.BottomStart)
            .navigationBarsPadding()
            .padding(start = spacing.md, end = spacing.md, bottom = 88.dp)
    ) {
        Column(
            modifier = Modifier
                .width(260.dp)
                .background(
                    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f),
                    shape = RoundedCornerShape(20.dp)
                )
                .padding(vertical = spacing.sm)
        ) {
            if (onProfileClick != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onProfileClick() }
                        .padding(horizontal = spacing.md, vertical = spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(spacing.md)
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .background(
                                color = MaterialTheme.colorScheme.primaryContainer,
                                shape = CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (profileBadgeText.isNotBlank()) {
                            Text(
                                text = profileBadgeText,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Filled.Person,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                    Text(
                        text = profileLabel,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
                HorizontalDivider(
                    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
                    modifier = Modifier.padding(horizontal = spacing.md)
                )
            }

            drawerItems.forEach { item ->
                MenuRow(
                    icon = bottomNavIconFor(item),
                    label = item.drawerLabel.orEmpty(),
                    selected = currentRoute == item.route,
                    onClick = {
                        if (isSelectAssignedOnboardingTarget && item == Routes.AssignedRequest) {
                            onMobileOnboardingStepCompleted(MobileOnboardingStepId.SELECT_ASSIGNED_REQUEST)
                        }
                        onSelect(item.route)
                    },
                    enabled = !isMobileOnboardingActive ||
                        (isSelectAssignedOnboardingTarget && item == Routes.AssignedRequest),
                    modifier = Modifier
                        .then(
                            if (item == Routes.AssignedRequest) {
                                Modifier.testTag("mobile_onboarding_target_assigned_request_menu")
                            } else {
                                Modifier
                            }
                        )
                        .mobileOnboardingPulse(isSelectAssignedOnboardingTarget && item == Routes.AssignedRequest),
                    spacing = spacing
                )
            }

            if (onOpenSettings != null) {
                HorizontalDivider(
                    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
                    modifier = Modifier.padding(horizontal = spacing.md)
                )
                MenuRow(
                    icon = Icons.Filled.Settings,
                    label = "Settings",
                    selected = false,
                    onClick = onOpenSettings,
                    enabled = !isMobileOnboardingActive,
                    spacing = spacing
                )
            }
        }
    }
}

@Composable
private fun MenuRow(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    spacing: NephSpacing
) {
    val contentColor = if (selected) {
        MaterialTheme.colorScheme.primary
    } else if (!enabled) {
        MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.42f)
    } else {
        MaterialTheme.colorScheme.onSurface
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(enabled = enabled) { onClick() }
            .padding(horizontal = spacing.md, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(spacing.md)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = contentColor,
            modifier = Modifier.size(20.dp)
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = contentColor
        )
        Spacer(modifier = Modifier.weight(1f))
        if (selected) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .background(
                        color = MaterialTheme.colorScheme.primary,
                        shape = CircleShape
                    )
            )
        }
    }
}

private fun bottomNavIconFor(item: Routes): ImageVector {
    return when (item) {
        Routes.Home -> Icons.Filled.Home
        Routes.News -> Icons.Filled.NewReleases
        Routes.MyHelpRequests -> Icons.AutoMirrored.Filled.HelpOutline
        Routes.AssignedRequest -> Icons.AutoMirrored.Filled.Assignment
        Routes.EmergencyInfo -> Icons.Filled.Phone
        Routes.HelpRequestMap -> Icons.Filled.Map
        Routes.NearbyUsers -> Icons.Filled.Group
        Routes.GatheringAreas -> Icons.Filled.LocalHospital
        Routes.SafetyCircles -> Icons.Filled.Shield
        Routes.Notifications -> Icons.Filled.Notifications
        Routes.Profile -> Icons.Filled.Person
        Routes.Settings -> Icons.Filled.Settings
        else -> Icons.AutoMirrored.Filled.ListAlt
    }
}

private fun bottomNavShortLabel(item: Routes): String {
    return when (item) {
        Routes.Home -> "Home"
        Routes.News -> "News"
        Routes.MyHelpRequests -> "Requests"
        Routes.AssignedRequest -> "Assigned"
        Routes.EmergencyInfo -> "Emergency"
        Routes.HelpRequestMap -> "Map"
        Routes.NearbyUsers -> "Nearby"
        Routes.GatheringAreas -> "Gathering"
        Routes.SafetyCircles -> "Circles"
        Routes.Notifications -> "Alerts"
        Routes.Profile -> "Profile"
        Routes.Settings -> "Settings"
        else -> item.drawerLabel ?: item.route
    }
}
