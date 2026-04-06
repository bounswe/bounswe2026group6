package com.neph.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

object NephShapeTokens {
    val Small = RoundedCornerShape(8.dp)
    val Medium = RoundedCornerShape(10.dp)
    val Large = RoundedCornerShape(14.dp)
    val ExtraLarge = RoundedCornerShape(16.dp)
    val Pill = RoundedCornerShape(999.dp)
}

val NephShapes = Shapes(
    extraSmall = NephShapeTokens.Small,
    small = NephShapeTokens.Medium,
    medium = NephShapeTokens.Large,
    large = NephShapeTokens.ExtraLarge,
    extraLarge = NephShapeTokens.ExtraLarge
)