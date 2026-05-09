package com.neph.features.onboarding.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.neph.ui.theme.LocalNephSpacing

private data class MobileOnboardingStep(
    val title: String,
    val subtitle: String,
    val description: String
)

private val mobileOnboardingSteps = listOf(
    MobileOnboardingStep(
        title = "Home Overview",
        subtitle = "Start here for the fastest snapshot.",
        description = "Use Home to see key updates, request help, mark yourself safe, and manage volunteer availability."
    ),
    MobileOnboardingStep(
        title = "News and Announcements",
        subtitle = "Follow verified updates.",
        description = "Track preparedness notes and community communication in one feed."
    ),
    MobileOnboardingStep(
        title = "Emergency Tools",
        subtitle = "Map and contacts in one flow.",
        description = "Use Emergency Numbers and the urgent help action when you need fast support."
    ),
    MobileOnboardingStep(
        title = "Help Request Map",
        subtitle = "See active help context on the map.",
        description = "View active emergency requests and understand where support may be needed."
    ),
    MobileOnboardingStep(
        title = "Gathering Areas",
        subtitle = "Find nearby safe assembly points.",
        description = "Review assembly and support points around your area."
    ),
    MobileOnboardingStep(
        title = "Your Profile and Privacy",
        subtitle = "Keep coordination data accurate.",
        description = "Update Profile and review Privacy & Security settings to control what is shared."
    )
)

@Composable
fun MobileOnboardingTutorial(
    onDismissCompleted: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    var stepIndex by remember { mutableIntStateOf(0) }
    val step = mobileOnboardingSteps[stepIndex]
    val isFirstStep = stepIndex == 0
    val isLastStep = stepIndex == mobileOnboardingSteps.lastIndex
    val progress = (stepIndex + 1).toFloat() / mobileOnboardingSteps.size.toFloat()

    AlertDialog(
        modifier = Modifier.testTag("mobile_onboarding_dialog"),
        onDismissRequest = onDismissCompleted,
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
                Text(
                    text = "Welcome to NEPH",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = step.title,
                    modifier = Modifier.testTag("mobile_onboarding_title"),
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
                Text(
                    text = step.subtitle,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = step.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
                Text(
                    text = "Step ${stepIndex + 1} of ${mobileOnboardingSteps.size}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismissCompleted,
                modifier = Modifier.testTag("mobile_onboarding_skip")
            ) {
                Text("Skip")
            }
        },
        confirmButton = {
            Row(
                modifier = Modifier.padding(start = spacing.sm),
                horizontalArrangement = Arrangement.spacedBy(spacing.xs)
            ) {
                TextButton(
                    onClick = { stepIndex = (stepIndex - 1).coerceAtLeast(0) },
                    enabled = !isFirstStep,
                    modifier = Modifier.testTag("mobile_onboarding_back")
                ) {
                    Text("Back")
                }

                if (isLastStep) {
                    Button(
                        onClick = onDismissCompleted,
                        modifier = Modifier.testTag("mobile_onboarding_finish")
                    ) {
                        Text("Finish")
                    }
                } else {
                    Button(
                        onClick = { stepIndex = (stepIndex + 1).coerceAtMost(mobileOnboardingSteps.lastIndex) },
                        modifier = Modifier.testTag("mobile_onboarding_next")
                    ) {
                        Text("Next")
                    }
                }
            }
        }
    )
}
