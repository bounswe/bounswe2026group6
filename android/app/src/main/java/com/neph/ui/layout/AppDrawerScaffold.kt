package com.neph.ui.layout

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.neph.navigation.Routes
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppDrawerScaffold(
    title: String,
    currentRoute: String,
    onNavigateToRoute: (String) -> Unit,
    drawerItems: List<Routes> = Routes.drawerItems,
    modifier: Modifier = Modifier,
    onOpenSettings: (() -> Unit)? = null,
    onProfileClick: (() -> Unit)? = null,
    profileBadgeText: String = "PP",
    profileLabel: String = "Profile",
    contentMaxWidth: Dp = 960.dp,
    contentAlignment: Alignment = Alignment.TopCenter,
    content: @Composable () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                Column(modifier = Modifier.fillMaxSize()) {
                    Spacer(modifier = Modifier.height(spacing.lg))

                    Text(
                        text = "NEPH",
                        modifier = Modifier.padding(horizontal = spacing.xl),
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.primary
                    )

                    Spacer(modifier = Modifier.height(spacing.lg))

                    drawerItems.forEach { item ->
                        NavigationDrawerItem(
                            label = {
                                Text(text = item.drawerLabel.orEmpty())
                            },
                            selected = currentRoute == item.route,
                            onClick = {
                                scope.launch {
                                    drawerState.close()
                                    if (currentRoute != item.route) {
                                        onNavigateToRoute(item.route)
                                    }
                                }
                            },
                            modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding),
                            colors = NavigationDrawerItemDefaults.colors(
                                selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                                selectedTextColor = MaterialTheme.colorScheme.onPrimaryContainer,
                                unselectedTextColor = MaterialTheme.colorScheme.onSurface
                            )
                        )
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    if (onProfileClick != null) {
                        val isGuestPlaceholder = profileBadgeText.isBlank()

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    scope.launch {
                                        drawerState.close()
                                        onProfileClick()
                                    }
                                }
                                .padding(horizontal = spacing.xl, vertical = spacing.lg),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(spacing.md)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(spacing.xxxl)
                                    .background(
                                        color = if (isGuestPlaceholder) {
                                            MaterialTheme.colorScheme.surfaceVariant
                                        } else {
                                            MaterialTheme.colorScheme.primaryContainer
                                        },
                                        shape = CircleShape
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                if (profileBadgeText.isNotBlank()) {
                                    Text(
                                        text = profileBadgeText,
                                        style = MaterialTheme.typography.labelLarge,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Filled.Person,
                                        contentDescription = "Guest profile placeholder",
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            Text(
                                text = profileLabel,
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }
            }
        }
    ) {
        Scaffold(
            modifier = modifier.fillMaxSize(),
            containerColor = MaterialTheme.colorScheme.background,
            topBar = {
                Column {
                    CenterAlignedTopAppBar(
                        title = {
                            Text(
                                text = title,
                                style = MaterialTheme.typography.titleLarge
                            )
                        },
                        navigationIcon = {
                            IconButton(
                                onClick = {
                                    scope.launch {
                                        drawerState.open()
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.Menu,
                                    contentDescription = "Open menu"
                                )
                            }
                        },
                        actions = {
                            if (onOpenSettings != null) {
                                IconButton(onClick = onOpenSettings) {
                                    Icon(
                                        imageVector = Icons.Filled.Settings,
                                        contentDescription = "Open settings"
                                    )
                                }
                            }
                        },
                        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                            navigationIconContentColor = MaterialTheme.colorScheme.onSurface,
                            titleContentColor = MaterialTheme.colorScheme.onSurface,
                            actionIconContentColor = MaterialTheme.colorScheme.onSurface
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outlineVariant
                    )
                }
            }
        ) { innerPadding ->
            ScreenContainer(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .widthIn(max = contentMaxWidth)
                        .align(contentAlignment),
                    verticalArrangement = Arrangement.spacedBy(spacing.lg)
                ) {
                    content()
                }
            }
        }
    }
}