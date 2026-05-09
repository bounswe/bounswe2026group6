package com.neph.features.onboarding.presentation

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
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
    val panelAlignment = step.panelPlacement.panelAlignment()
    val targetAlignment = step.panelPlacement.targetAlignment()
    val blockerInteractionSource = remember { MutableInteractionSource() }

    Box(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.44f))
                .clickable(
                    interactionSource = blockerInteractionSource,
                    indication = null,
                    onClick = {}
                )
                .testTag("mobile_onboarding_blocker")
        )

        PulsingTargetButton(
            label = when {
                !isOnTargetRoute -> "Go to ${step.title}"
                isLastStep -> step.actionLabel
                else -> step.actionLabel
            },
            hint = if (isOnTargetRoute) step.targetHint else "First move to this screen, then follow the highlighted action.",
            buttonTestTag = when {
                !isOnTargetRoute -> "mobile_onboarding_take_me_there"
                isLastStep -> "mobile_onboarding_finish"
                else -> "mobile_onboarding_next"
            },
            modifier = Modifier
                .align(targetAlignment)
                .padding(24.dp)
                .testTag("mobile_onboarding_target_action"),
            onClick = when {
                !isOnTargetRoute -> onNavigateToStep
                isLastStep -> onFinish
                else -> onNext
            }
        )

        Surface(
            modifier = Modifier
                .align(panelAlignment)
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

                Text(
                    text = if (isOnTargetRoute) {
                        "Tap the pulsing highlighted action to continue. Other screen actions are temporarily disabled during the guide."
                    } else {
                        "Tap the pulsing highlighted action to move to the right screen first."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
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
                    Text(
                        text = "Use the pulse",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun PulsingTargetButton(
    label: String,
    hint: String,
    buttonTestTag: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val infiniteTransition = rememberInfiniteTransition(label = "mobile-onboarding-pulse")
    val scale = infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = keyframes {
                durationMillis = 1300
                1f at 0
                1.08f at 180
                0.98f at 360
                1.05f at 540
                1f at 760
                1f at 1300
            },
            repeatMode = RepeatMode.Restart
        ),
        label = "mobile-onboarding-heart-bump"
    ).value

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .scale(scale),
        shape = MaterialTheme.shapes.extraLarge,
        color = MaterialTheme.colorScheme.primaryContainer,
        tonalElevation = 10.dp,
        shadowElevation = 12.dp
    ) {
        Column(
            modifier = Modifier.padding(spacing.md),
            verticalArrangement = Arrangement.spacedBy(spacing.sm)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(spacing.sm)
            ) {
                Surface(
                    modifier = Modifier.size(36.dp),
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primary
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        androidx.compose.material3.Icon(
                            imageVector = Icons.Filled.Favorite,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = label,
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = hint,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.78f)
                    )
                }
            }
            Button(
                onClick = onClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag(buttonTestTag)
            ) {
                Text(label)
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

private fun MobileOnboardingPanelPlacement.targetAlignment(): Alignment {
    return when (this) {
        MobileOnboardingPanelPlacement.TOP -> Alignment.BottomCenter
        MobileOnboardingPanelPlacement.CENTER -> Alignment.BottomCenter
        MobileOnboardingPanelPlacement.BOTTOM -> Alignment.TopCenter
    }
}
