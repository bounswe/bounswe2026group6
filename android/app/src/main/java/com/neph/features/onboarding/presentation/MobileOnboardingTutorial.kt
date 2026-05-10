package com.neph.features.onboarding.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.neph.features.onboarding.data.MobileOnboardingPanelPlacement
import com.neph.features.onboarding.data.MobileOnboardingStep
import com.neph.ui.theme.LocalNephSpacing
import kotlin.math.roundToInt

@Composable
fun MobileOnboardingGuide(
    step: MobileOnboardingStep,
    stepNumber: Int,
    totalSteps: Int,
    isOnTargetRoute: Boolean,
    feedbackMessage: String?,
    onNavigateToStep: () -> Unit,
    onContinue: () -> Unit,
    onBack: () -> Unit,
    onSkip: () -> Unit,
    onFinish: () -> Unit
) {
    val spacing = LocalNephSpacing.current
    val density = LocalDensity.current
    val isFirstStep = stepNumber <= 1
    val isLastStep = stepNumber >= totalSteps
    val progress = stepNumber.toFloat() / totalSteps.toFloat()
    var dragOffsetPx by remember(step.id) { mutableStateOf(0f) }
    var panelHeightPx by remember(step.id) { mutableStateOf(0f) }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val containerHeightPx = with(density) { maxHeight.toPx() }
        val topInsetPx = with(density) { 16.dp.toPx() }
        val reservedBottomPx = with(density) { 140.dp.toPx() }
        val dragBounds = calculateGuideDragBounds(
            placement = step.panelPlacement,
            containerHeightPx = containerHeightPx,
            panelHeightPx = panelHeightPx,
            topInsetPx = topInsetPx,
            reservedBottomPx = reservedBottomPx
        )

        LaunchedEffect(dragBounds.start, dragBounds.endInclusive) {
            dragOffsetPx = dragOffsetPx.coerceIn(dragBounds.start, dragBounds.endInclusive)
        }

        Surface(
            modifier = Modifier
                .align(step.panelPlacement.panelAlignment())
                .offset { IntOffset(x = 0, y = dragOffsetPx.roundToInt()) }
                .fillMaxWidth()
                .padding(16.dp)
                .navigationBarsPadding()
                .onGloballyPositioned { coordinates ->
                    panelHeightPx = coordinates.size.height.toFloat()
                }
                .pointerInput(step.id, dragBounds.start, dragBounds.endInclusive) {
                    detectVerticalDragGestures { change, dragAmount ->
                        change.consume()
                        dragOffsetPx = (dragOffsetPx + dragAmount)
                            .coerceIn(dragBounds.start, dragBounds.endInclusive)
                    }
                }
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
                            onClick = when {
                                !isOnTargetRoute -> onNavigateToStep
                                isLastStep -> onFinish
                                else -> onContinue
                            },
                            modifier = Modifier.testTag(
                                if (!isOnTargetRoute) {
                                    "mobile_onboarding_take_me_there"
                                } else if (isLastStep) {
                                    "mobile_onboarding_finish"
                                } else {
                                    "mobile_onboarding_continue"
                                }
                            )
                        ) {
                            Text(
                                when {
                                    !isOnTargetRoute -> "Go there"
                                    isLastStep -> "Finish"
                                    else -> "Continue"
                                }
                            )
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

private fun calculateGuideDragBounds(
    placement: MobileOnboardingPanelPlacement,
    containerHeightPx: Float,
    panelHeightPx: Float,
    topInsetPx: Float,
    reservedBottomPx: Float
): ClosedFloatingPointRange<Float> {
    if (containerHeightPx <= 0f || panelHeightPx <= 0f) {
        return 0f..0f
    }

    val baseY = when (placement) {
        MobileOnboardingPanelPlacement.TOP -> topInsetPx
        MobileOnboardingPanelPlacement.CENTER -> (containerHeightPx - panelHeightPx) / 2f
        MobileOnboardingPanelPlacement.BOTTOM -> containerHeightPx - panelHeightPx - reservedBottomPx
    }.coerceAtLeast(topInsetPx)

    val minOffset = topInsetPx - baseY
    val maxOffset = (containerHeightPx - reservedBottomPx - panelHeightPx) - baseY

    return if (maxOffset < minOffset) {
        0f..0f
    } else {
        minOffset..maxOffset
    }
}
