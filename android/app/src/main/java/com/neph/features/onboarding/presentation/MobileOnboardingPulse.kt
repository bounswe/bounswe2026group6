package com.neph.features.onboarding.presentation

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun Modifier.mobileOnboardingPulse(enabled: Boolean): Modifier {
    if (!enabled) return this

    val infiniteTransition = rememberInfiniteTransition(label = "mobile-onboarding-existing-control-pulse")
    val scale = infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = keyframes {
                durationMillis = 1300
                1f at 0
                1.06f at 180
                0.98f at 360
                1.04f at 540
                1f at 760
                1f at 1300
            },
            repeatMode = RepeatMode.Restart
        ),
        label = "mobile-onboarding-heart-bump"
    ).value

    return this
        .scale(scale)
        .border(
            width = 3.dp,
            color = Color(0xFFFF5A7A),
            shape = RoundedCornerShape(28.dp)
        )
}
