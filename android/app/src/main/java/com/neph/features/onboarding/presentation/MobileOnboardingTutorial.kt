package com.neph.features.onboarding.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.neph.features.onboarding.data.MobileOnboardingPanelPlacement
import com.neph.features.onboarding.data.MobileOnboardingStep
import com.neph.ui.theme.LocalNephSpacing

@Composable
fun MobileOnboardingGuide(
    step: MobileOnboardingStep,
    stepNumber: Int,
    totalSteps: Int,
    isOnTargetRoute: Boolean,
    feedbackMessage: String?,
    onNavigateToStep: () -> Unit,
    onBack: () -> Unit,
    onSkip: () -> Unit,
    onFinish: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val isFirstStep = stepNumber <= 1
    val progress = stepNumber.toFloat() / totalSteps.toFloat()

    Box(modifier = Modifier.fillMaxSize()) {
        Surface(
            modifier = Modifier
                .align(step.panelPlacement.panelAlignment())
                .fillMaxWidth()
                .padding(16.dp)
                .navigationBarsPadding()
                .testTag("mobile_onboarding_dialog"),
            shape = MaterialTheme.shapes.extraLarge,
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 8.dp,
            shadowElevation = 8.dp
        ) {
            Column(
                modifier = Modifier.padding(spacing.lg),
                verticalArrangement = Arrangement.spacedBy(spacing.md)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.xs)) {
                    Text(
                        text = "NEPH Guide",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = step.title,
                        modifier = Modifier.testTag("mobile_onboarding_title"),
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = step.eyebrow,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                feedbackMessage?.takeIf { it.isNotBlank() }?.let { message ->
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("mobile_onboarding_feedback"),
                        shape = MaterialTheme.shapes.medium,
                        color = MaterialTheme.colorScheme.primaryContainer
                    ) {
                        Text(
                            text = message,
                            modifier = Modifier.padding(spacing.md),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }

                Text(
                    text = step.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Text(
                    text = if (isOnTargetRoute && step.usesExistingTarget) {
                        step.actionLabel
                    } else if (!isOnTargetRoute) {
                        "Go to ${step.title}"
                    } else {
                        step.targetHint
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.testTag("mobile_onboarding_instruction")
                )

                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
                Text(
                    text = "Step $stepNumber of $totalSteps",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(spacing.xs),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(
                        onClick = onSkip,
                        modifier = Modifier.testTag("mobile_onboarding_skip")
                    ) {
                        Text("Skip tour")
                    }
                    TextButton(
                        onClick = onBack,
                        enabled = !isFirstStep,
                        modifier = Modifier.testTag("mobile_onboarding_back")
                    ) {
                        Text("Back")
                    }
                    Spacer(modifier = Modifier.weight(1f))
                    if (!isOnTargetRoute || !step.usesExistingTarget) {
                        Button(
                            onClick = if (!isOnTargetRoute) onNavigateToStep else onFinish,
                            modifier = Modifier.testTag(
                                if (!isOnTargetRoute) {
                                    "mobile_onboarding_take_me_there"
                                } else {
                                    "mobile_onboarding_finish"
                                }
                            )
                        ) {
                            Text(if (!isOnTargetRoute) "Go there" else "Finish")
                        }
                    }
                }
            }
        }
    }
}

private fun MobileOnboardingPanelPlacement.panelAlignment(): Alignment {
    return when (this) {
        MobileOnboardingPanelPlacement.TOP -> Alignment.TopCenter
        MobileOnboardingPanelPlacement.CENTER -> Alignment.Center
        MobileOnboardingPanelPlacement.BOTTOM -> Alignment.BottomCenter
    }
}
