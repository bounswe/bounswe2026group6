package com.neph.features.safetycircles.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.neph.core.format.formatTimestampWithRelativeDay
import com.neph.core.network.ApiException
import com.neph.features.auth.data.AuthRepository
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.profile.data.DeviceLocationProvider
import com.neph.features.safetycircles.data.SafetyCircleDetail
import com.neph.features.safetycircles.data.SafetyCircleInvite
import com.neph.features.safetycircles.data.SafetyCircleMember
import com.neph.features.safetycircles.data.SafetyCircleSummary
import com.neph.features.safetycircles.data.SafetyCirclesRepository
import com.neph.features.onboarding.data.MobileOnboardingStepId
import com.neph.navigation.Routes
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.buttons.SecondaryButton
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun SafetyCirclesScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: () -> Unit,
    onProfileClick: () -> Unit,
    onNavigateToLogin: () -> Unit,
    profileBadgeText: String,
    modifier: Modifier = Modifier,
    mobileOnboardingStepId: MobileOnboardingStepId? = null,
    onMobileOnboardingStepCompleted: (String?) -> Unit = {}
) {
    val spacing = LocalNephSpacing.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val token = AuthSessionStore.getAccessToken()
    var circles by remember { mutableStateOf<List<SafetyCircleSummary>>(emptyList()) }
    var invites by remember { mutableStateOf<List<SafetyCircleInvite>>(emptyList()) }
    var selectedCircleId by remember { mutableStateOf<String?>(null) }
    var detail by remember { mutableStateOf<SafetyCircleDetail?>(null) }
    var newCircleName by remember { mutableStateOf("") }
    var invitee by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var actionLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }
    var infoMessage by remember { mutableStateOf("") }
    var pendingCheckIn by remember { mutableStateOf<Pair<String, String>?>(null) }
    var pendingDeleteCircleId by remember { mutableStateOf<String?>(null) }
    var pendingTransferOwnership by remember { mutableStateOf<Pair<String, SafetyCircleMember>?>(null) }

    fun handleAuthError(error: ApiException): Boolean {
        if (error.status != 401) return false
        AuthRepository.logout()
        errorMessage = "Session expired. Please log in again."
        onNavigateToLogin()
        return true
    }

    fun refresh() {
        val safeToken = token
        if (safeToken.isNullOrBlank()) {
            onNavigateToLogin()
            return
        }

        loading = true
        errorMessage = ""
        scope.launch {
            try {
                val nextCircles = SafetyCirclesRepository.listCircles(safeToken)
                val nextInvites = SafetyCirclesRepository.listInvites(safeToken)
                circles = nextCircles
                invites = nextInvites.filter { it.status == "pending" }
                val nextSelectedId = selectedCircleId ?: nextCircles.firstOrNull()?.circleId
                selectedCircleId = nextSelectedId
                detail = nextSelectedId?.let { SafetyCirclesRepository.getCircle(safeToken, it) }
            } catch (error: ApiException) {
                if (!handleAuthError(error)) {
                    errorMessage = error.message.ifBlank { "Could not load safety circles. Please retry." }
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                errorMessage = "Could not load safety circles. Please retry."
            } finally {
                loading = false
            }
        }
    }

    fun runAction(successMessage: String, action: suspend (String) -> Unit) {
        val safeToken = token
        if (safeToken.isNullOrBlank()) {
            onNavigateToLogin()
            return
        }

        actionLoading = true
        errorMessage = ""
        infoMessage = ""
        scope.launch {
            try {
                action(safeToken)
                if (infoMessage.isBlank()) {
                    infoMessage = successMessage
                }
                refresh()
            } catch (error: ApiException) {
                if (!handleAuthError(error)) {
                    errorMessage = error.message.ifBlank { "Action failed. Please retry." }
                }
            } catch (cancellationException: CancellationException) {
                throw cancellationException
            } catch (_: Exception) {
                errorMessage = "Action failed. Please retry."
            } finally {
                actionLoading = false
            }
        }
    }

    fun submitCheckIn(circleId: String, status: String, shareLocation: Boolean) {
        runAction(
            successMessage = if (status == "safe") "You are marked safe." else "You are marked as needing help."
        ) { safeToken ->
            val locationAttempt = if (shareLocation) {
                DeviceLocationProvider.captureCurrentLocationForSharing(
                    context = context,
                    sharingEnabled = true
                )
            } else {
                null
            }
            val sharedLocation = locationAttempt?.location
            SafetyCirclesRepository.checkIn(
                token = safeToken,
                circleId = circleId,
                status = status,
                location = sharedLocation,
                shareLocationConsent = shareLocation && sharedLocation != null
            )
            if (shareLocation && sharedLocation == null) {
                infoMessage = "Check-in saved. Location was not shared because permission or location was unavailable."
            }
        }
    }

    LaunchedEffect(Unit) {
        refresh()
    }

    pendingCheckIn?.let { (circleId, status) ->
        AlertDialog(
            onDismissRequest = { pendingCheckIn = null },
            title = {
                Text(text = "Share location with this check-in?")
            },
            text = {
                Text(
                    text = "Your circle can see your status without location. Share location only if you want trusted members allowed by privacy settings to see where this check-in came from."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        pendingCheckIn = null
                        submitCheckIn(circleId, status, shareLocation = true)
                    }
                ) {
                    Text("Share location")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        pendingCheckIn = null
                        submitCheckIn(circleId, status, shareLocation = false)
                    }
                ) {
                    Text("Without location")
                }
            }
        )
    }

    pendingDeleteCircleId?.let { circleId ->
        AlertDialog(
            onDismissRequest = { pendingDeleteCircleId = null },
            title = {
                Text(text = "Delete safety circle?")
            },
            text = {
                Text(text = "This removes the circle, invites, and memberships for everyone.")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        pendingDeleteCircleId = null
                        runAction("Circle deleted.") { safeToken ->
                            SafetyCirclesRepository.deleteCircle(safeToken, circleId)
                            selectedCircleId = null
                            detail = null
                        }
                    }
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDeleteCircleId = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    pendingTransferOwnership?.let { (circleId, member) ->
        AlertDialog(
            onDismissRequest = { pendingTransferOwnership = null },
            title = {
                Text(text = "Transfer ownership?")
            },
            text = {
                Text(text = "This will make ${member.displayName ?: member.userId} the owner of this safety circle.")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        pendingTransferOwnership = null
                        runAction("Ownership transferred.") { safeToken ->
                            SafetyCirclesRepository.transferOwnership(
                                token = safeToken,
                                circleId = circleId,
                                nextOwnerUserId = member.userId
                            )
                        }
                    }
                ) {
                    Text("Transfer")
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingTransferOwnership = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    AppDrawerScaffold(
        title = "Safety Circles",
        currentRoute = Routes.SafetyCircles.route,
        onNavigateToRoute = onNavigateToRoute,
        drawerItems = Routes.authenticatedDrawerItems,
        modifier = modifier,
        onOpenSettings = onOpenSettings,
        onProfileClick = onProfileClick,
        profileBadgeText = profileBadgeText,
        profileLabel = "Profile",
        contentMaxWidth = 560.dp,
        contentAlignment = Alignment.TopCenter,
        mobileOnboardingStepId = mobileOnboardingStepId,
        onMobileOnboardingStepCompleted = onMobileOnboardingStepCompleted
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                    SectionHeader(
                        title = "Create Circle",
                        subtitle = "Start with family, neighbors, or a trusted group."
                    )
                    OutlinedTextField(
                        value = newCircleName,
                        onValueChange = { newCircleName = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Circle name") },
                        singleLine = true
                    )
                    PrimaryButton(
                        text = "Create circle",
                        onClick = {
                            val name = newCircleName.trim()
                            if (name.isBlank()) {
                                errorMessage = "Circle name is required."
                            } else {
                                runAction("Circle created.") { safeToken ->
                                    val circle = SafetyCirclesRepository.createCircle(safeToken, name)
                                    selectedCircleId = circle.circleId
                                    newCircleName = ""
                                }
                            }
                        },
                        loading = actionLoading,
                        enabled = !actionLoading
                    )
                }
            }

            if (invites.isNotEmpty()) {
                SectionCard {
                    Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                        SectionHeader(
                            title = "Invites",
                            subtitle = "Accept only circles you recognize."
                        )
                        invites.forEach { invite ->
                            InviteRow(
                                invite = invite,
                                actionLoading = actionLoading,
                                onAccept = {
                                    runAction("Invite accepted.") { safeToken ->
                                        SafetyCirclesRepository.respondToInvite(safeToken, invite.inviteId, accept = true)
                                    }
                                },
                                onReject = {
                                    runAction("Invite rejected.") { safeToken ->
                                        SafetyCirclesRepository.respondToInvite(safeToken, invite.inviteId, accept = false)
                                    }
                                }
                            )
                        }
                    }
                }
            }

            SectionCard {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                    SectionHeader(
                        title = "My Circles",
                        subtitle = if (circles.isEmpty()) "No circles yet." else "Choose a circle to view members."
                    )
                    circles.forEach { circle ->
                        AssistChip(
                            onClick = {
                                selectedCircleId = circle.circleId
                                runAction("") { safeToken ->
                                    detail = SafetyCirclesRepository.getCircle(safeToken, circle.circleId)
                                }
                            },
                            label = {
                                Text(
                                    text = "${circle.name} (${circle.memberCount})",
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        )
                    }
                }
            }

            detail?.let { circleDetail ->
                val isOwner = circleDetail.currentUserRole == "owner"
                SectionCard {
                    Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
                        SectionHeader(
                            title = circleDetail.circle.name,
                            subtitle = "Members can see each other's latest check-in."
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(spacing.sm)
                        ) {
                            PrimaryButton(
                                text = "I am safe",
                                onClick = {
                                    pendingCheckIn = circleDetail.circle.circleId to "safe"
                                },
                                modifier = Modifier.weight(1f),
                                enabled = !actionLoading
                            )
                            SecondaryButton(
                                text = "Needs help",
                                onClick = {
                                    pendingCheckIn = circleDetail.circle.circleId to "not_safe"
                                },
                                modifier = Modifier.weight(1f),
                                enabled = !actionLoading
                            )
                        }
                        OutlinedTextField(
                            value = invitee,
                            onValueChange = { invitee = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Invite by email or user ID") },
                            singleLine = true
                        )
                        SecondaryButton(
                            text = "Send invite",
                            onClick = {
                                val target = invitee.trim()
                                if (target.isBlank()) {
                                    errorMessage = "Invitee email or user ID is required."
                                } else {
                                    runAction("Invite sent.") { safeToken ->
                                        SafetyCirclesRepository.invite(safeToken, circleDetail.circle.circleId, target)
                                        invitee = ""
                                    }
                                }
                            },
                            enabled = !actionLoading
                        )
                        if (circleDetail.members.size <= 1) {
                            Text(
                                text = "No accepted members yet.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        circleDetail.members.forEach { member ->
                            MemberRow(
                                member = member,
                                actionLoading = actionLoading,
                                showTransferAction = isOwner && member.role != "owner",
                                onTransferOwnership = {
                                    pendingTransferOwnership = circleDetail.circle.circleId to member
                                }
                            )
                        }
                        if (isOwner) {
                            Text(
                                text = "Owners can delete the circle or transfer ownership to a member.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            SecondaryButton(
                                text = "Delete circle",
                                onClick = {
                                    pendingDeleteCircleId = circleDetail.circle.circleId
                                },
                                enabled = !actionLoading
                            )
                        } else {
                            SecondaryButton(
                                text = "Leave circle",
                                onClick = {
                                    runAction("You left the circle.") { safeToken ->
                                        SafetyCirclesRepository.leave(safeToken, circleDetail.circle.circleId)
                                        selectedCircleId = null
                                        detail = null
                                    }
                                },
                                enabled = !actionLoading
                            )
                        }
                    }
                }
            }

            if (errorMessage.isNotBlank()) {
                Text(
                    text = "$errorMessage Please retry.",
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }

            if (infoMessage.isNotBlank()) {
                Text(
                    text = infoMessage,
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun InviteRow(
    invite: SafetyCircleInvite,
    actionLoading: Boolean,
    onAccept: () -> Unit,
    onReject: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = invite.circleName ?: "Safety Circle",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = invite.inviterDisplayName ?: "Trusted circle invite",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        TextButton(onClick = onReject, enabled = !actionLoading) {
            Text("Reject")
        }
        TextButton(onClick = onAccept, enabled = !actionLoading) {
            Text("Accept")
        }
    }
}

@Composable
private fun MemberRow(
    member: SafetyCircleMember,
    actionLoading: Boolean,
    showTransferAction: Boolean,
    onTransferOwnership: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
    ) {
        Text(
            text = member.displayName ?: member.userId,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = listOf(
                formatSafetyStatus(member.status),
                member.emergencyContactPhone?.let { "Contact: $it" },
                formatLastCheckedInLabel(member.lastCheckedInAt),
                if (member.hasSharedLocation) "Location shared" else null
            ).filterNotNull().joinToString(" · "),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        if (!member.note.isNullOrBlank()) {
            Text(
                text = member.note,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        if (showTransferAction) {
            TextButton(
                onClick = onTransferOwnership,
                enabled = !actionLoading
            ) {
                Text("Make owner")
            }
        }
    }
}

private fun formatSafetyStatus(status: String): String {
    return when (status.trim().lowercase()) {
        "safe" -> "Safe"
        "not_safe" -> "Needs help"
        else -> "No response"
    }
}

internal fun formatLastCheckedInLabel(
    rawTimestamp: String?,
    zoneId: ZoneId = ZoneId.systemDefault(),
    nowInstant: Instant = Instant.now()
): String? {
    val formatted = formatTimestampWithRelativeDay(
        raw = rawTimestamp,
        fallbackFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy, HH:mm"),
        timeFormatter = DateTimeFormatter.ofPattern("HH:mm"),
        zoneId = zoneId,
        nowInstant = nowInstant
    ) ?: return null
    return "Last checked in: $formatted"
}
