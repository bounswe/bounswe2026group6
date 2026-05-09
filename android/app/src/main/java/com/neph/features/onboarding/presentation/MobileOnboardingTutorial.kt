package com.neph.features.onboarding.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import com.neph.features.onboarding.data.MobileOnboardingStep
import com.neph.ui.theme.LocalNephSpacing

@Composable
fun MobileOnboardingGuide(
    step: MobileOnboardingStep,
    stepNumber: Int,
    totalSteps: Int,
    isOnTargetRoute: Boolean,
    onNavigateToStep: () -> Unit,
    onBack: () -> Unit,
    onNext: () -> Unit,
    onSkip: () -> Unit,
    onFinish: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val isFirstStep = stepNumber <= 1
    val isLastStep = stepNumber >= totalSteps
    val progress = stepNumber.toFloat() / totalSteps.toFloat()

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.BottomCenter
    ) {
        Surface(
            modifier = Modifier
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

                Text(
                    text = step.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (!isOnTargetRoute) {
                    Text(
                        text = "This concept lives on another screen. Tap ${step.actionLabel} to continue the guided path.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

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
                }

                if (!isOnTargetRoute) {
                    Button(
                        onClick = onNavigateToStep,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("mobile_onboarding_take_me_there")
                    ) {
                        Text(step.actionLabel)
                    }
                } else if (isLastStep) {
                    Button(
                        onClick = onFinish,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("mobile_onboarding_finish")
                    ) {
                        Text("Finish")
                    }
                } else {
                    Button(
                        onClick = onNext,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("mobile_onboarding_next")
                    ) {
                        Text("Next")
                    }
                }
            }
        }
    }
}
