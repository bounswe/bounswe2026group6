package com.neph.features.emergencyinfo.presentation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.MedicalServices
import androidx.compose.material.icons.filled.Park
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Sailing
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.neph.navigation.Routes
import com.neph.ui.components.display.IconListRow
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.components.display.StatusBadgeTone
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme

private data class EmergencyContact(
    val id: String,
    val label: String,
    val phone: String,
    val description: String,
    val icon: ImageVector,
    val tone: StatusBadgeTone
)

private val defaultEmergencyContacts = listOf(
    EmergencyContact(
        id = "e-001",
        label = "General Emergency",
        phone = "112",
        description = "All-purpose national emergency line",
        icon = Icons.Filled.Phone,
        tone = StatusBadgeTone.DANGER
    ),
    EmergencyContact(
        id = "e-002",
        label = "AFAD Disaster & Emergency",
        phone = "122",
        description = "Earthquake, flood, large-scale incidents",
        icon = Icons.Filled.MedicalServices,
        tone = StatusBadgeTone.WARNING
    ),
    EmergencyContact(
        id = "e-003",
        label = "Fire Department",
        phone = "110",
        description = "Fire, rescue, and hazardous materials",
        icon = Icons.Filled.LocalFireDepartment,
        tone = StatusBadgeTone.DANGER
    ),
    EmergencyContact(
        id = "e-004",
        label = "Coast Guard",
        phone = "158",
        description = "Maritime emergencies and rescue",
        icon = Icons.Filled.Sailing,
        tone = StatusBadgeTone.INFO
    ),
    EmergencyContact(
        id = "e-005",
        label = "Forest Fire Hotline",
        phone = "177",
        description = "Report wildfires to forestry teams",
        icon = Icons.Filled.Park,
        tone = StatusBadgeTone.SUCCESS
    ),
    EmergencyContact(
        id = "e-006",
        label = "Poison Information Center",
        phone = "114",
        description = "Toxic exposure guidance",
        icon = Icons.Filled.LocalHospital,
        tone = StatusBadgeTone.BRAND
    )
)

@Composable
fun EmergencyInfoScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: (() -> Unit)?,
    onProfileClick: () -> Unit,
    profileBadgeText: String,
    isAuthenticated: Boolean
) {
    val spacing = LocalNephSpacing.current
    val context = LocalContext.current

    fun openDialer(phone: String) {
        val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone"))
        context.startActivity(dialIntent)
    }

    AppDrawerScaffold(
        title = "Emergency Numbers",
        currentRoute = Routes.EmergencyInfo.route,
        onNavigateToRoute = onNavigateToRoute,
        drawerItems = if (isAuthenticated) {
            Routes.authenticatedDrawerItems
        } else {
            Routes.guestDrawerItems
        },
        bottomNavItems = if (isAuthenticated) {
            Routes.authenticatedBottomNavItems
        } else {
            Routes.guestBottomNavItems
        },
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = if (isAuthenticated) "Profile" else "Login / Create Account"
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.lg)) {
            SectionCard {
                SectionHeader(
                    title = "Emergency Contact List",
                    subtitle = "Tap any number to call. Available 24/7 across Türkiye."
                )

                Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
                    defaultEmergencyContacts.forEachIndexed { index, item ->
                        IconListRow(
                            icon = item.icon,
                            title = item.label,
                            supportingText = item.description,
                            trailingText = item.phone,
                            iconTone = item.tone,
                            showChevron = false,
                            onClick = { openDialer(item.phone) }
                        )

                        if (index < defaultEmergencyContacts.lastIndex) {
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        }
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun EmergencyInfoScreenPreview() {
    NephTheme {
        EmergencyInfoScreen(
            onNavigateToRoute = {},
            onOpenSettings = {},
            onProfileClick = {},
            profileBadgeText = "PP",
            isAuthenticated = true
        )
    }
}
