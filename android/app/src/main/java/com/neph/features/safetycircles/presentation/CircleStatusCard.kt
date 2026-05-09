package com.neph.features.safetycircles.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.neph.features.auth.data.AuthSessionStore
import com.neph.features.safetycircles.data.SafetyCircleMember
import com.neph.features.safetycircles.data.SafetyCirclesRepository
import com.neph.ui.components.buttons.TextActionButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.theme.LocalNephSpacing
import kotlinx.coroutines.CancellationException

/**
 * Compact home-screen widget showing the live status of the user's primary
 * safety circle. Members are rendered as avatar chips with a colored ring
 * indicating their latest check-in status, plus a quick summary count above.
 */
@Composable
fun CircleStatusCard(
    onOpenSafetyCircles: () -> Unit,
    onOpenLogin: () -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalNephSpacing.current
    val token = AuthSessionStore.getAccessToken()

    var loading by remember { mutableStateOf(true) }
    var circleName by remember { mutableStateOf("") }
    var members by remember { mutableStateOf<List<SafetyCircleMember>>(emptyList()) }
    var totalCircleCount by remember { mutableStateOf(0) }
    var errorMessage by remember { mutableStateOf("") }

    LaunchedEffect(token) {
        if (token.isNullOrBlank()) {
            loading = false
            return@LaunchedEffect
        }
        try {
            val circles = SafetyCirclesRepository.listCircles(token)
            totalCircleCount = circles.size
            val primary = circles.firstOrNull()
            if (primary != null) {
                val detail = SafetyCirclesRepository.getCircle(token, primary.circleId)
                circleName = detail.circle.name
                members = detail.members
            } else {
                circleName = ""
                members = emptyList()
            }
            errorMessage = ""
        } catch (cancellationException: CancellationException) {
            throw cancellationException
        } catch (_: Exception) {
            errorMessage = "Could not load circle status."
        } finally {
            loading = false
        }
    }

    val safeCount = members.count { it.status.equals("safe", ignoreCase = true) }
    val needsHelpCount = members.count {
        val s = it.status.trim().lowercase()
        s == "not_safe" || s == "needs_help" || s == "needs help"
    }
    val unknownCount = members.size - safeCount - needsHelpCount

    SectionCard(modifier = modifier) {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
            SectionHeader(
                title = if (circleName.isNotBlank()) circleName else "Safety Circle",
                subtitle = when {
                    token.isNullOrBlank() -> "Sign in to see how your circle is doing."
                    totalCircleCount == 0 -> "You haven't joined any circles yet."
                    members.isEmpty() -> "No members in this circle yet."
                    else -> "${members.size} members · tap to open"
                },
                trailing = {
                    if (members.isNotEmpty()) {
                        StatusSummary(
                            safe = safeCount,
                            needsHelp = needsHelpCount,
                            unknown = unknownCount
                        )
                    }
                }
            )

            when {
                token.isNullOrBlank() -> {
                    TextActionButton(text = "Log in", onClick = onOpenLogin)
                }

                loading -> {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = spacing.sm),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                errorMessage.isNotBlank() -> {
                    HelperText(text = errorMessage)
                    TextActionButton(text = "Open Safety Circles", onClick = onOpenSafetyCircles)
                }

                totalCircleCount == 0 || members.isEmpty() -> {
                    HelperText(
                        text = if (totalCircleCount == 0) {
                            "Create or join a circle to track your loved ones."
                        } else {
                            "Invite people to start tracking check-ins."
                        }
                    )
                    TextActionButton(text = "Open Safety Circles", onClick = onOpenSafetyCircles)
                }

                else -> {
                    LazyRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onOpenSafetyCircles() },
                        horizontalArrangement = Arrangement.spacedBy(spacing.sm)
                    ) {
                        items(members) { member ->
                            MemberStatusChip(member = member)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusSummary(safe: Int, needsHelp: Int, unknown: Int) {
    val spacing = LocalNephSpacing.current
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(spacing.sm)
    ) {
        if (safe > 0) {
            SummaryDot(count = safe, color = MaterialTheme.colorScheme.tertiary)
        }
        if (needsHelp > 0) {
            SummaryDot(count = needsHelp, color = MaterialTheme.colorScheme.error)
        }
        if (unknown > 0) {
            SummaryDot(count = unknown, color = MaterialTheme.colorScheme.outline)
        }
    }
}

@Composable
private fun SummaryDot(count: Int, color: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(color, CircleShape)
        )
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun MemberStatusChip(member: SafetyCircleMember) {
    val displayName = member.displayName?.takeIf { it.isNotBlank() } ?: "Member"
    val initial = displayName.trim().firstOrNull()?.uppercase() ?: ""
    val statusColor = when (member.status.trim().lowercase()) {
        "safe" -> MaterialTheme.colorScheme.tertiary
        "not_safe", "needs_help", "needs help" -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.outline
    }

    Column(
        modifier = Modifier.widthIn(min = 64.dp, max = 80.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .border(width = 2.5.dp, color = statusColor, shape = CircleShape)
                .padding(4.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            if (initial.isNotEmpty()) {
                Text(
                    text = initial,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    fontWeight = FontWeight.SemiBold
                )
            } else {
                Icon(
                    imageVector = Icons.Filled.Person,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
        Text(
            text = displayName.substringBefore(' '),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = statusShort(member.status),
            style = MaterialTheme.typography.labelSmall,
            color = statusColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center
        )
    }
}

private fun statusShort(status: String): String {
    return when (status.trim().lowercase()) {
        "safe" -> "Safe"
        "not_safe", "needs_help", "needs help" -> "Needs help"
        "unknown", "" -> "—"
        else -> status.replace('_', ' ').replaceFirstChar { it.uppercase() }
    }
}
