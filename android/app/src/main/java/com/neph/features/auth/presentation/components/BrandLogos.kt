package com.neph.features.auth.presentation.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/**
 * Brand-accurate provider logos used by the social auth buttons. Each logo is
 * authored as a 24x24 [ImageVector] so it can be tinted/scaled independently of
 * the surrounding button.
 */
internal object BrandLogos {

    val Google: ImageVector by lazy { buildGoogleLogo() }

    private fun buildSinglePathLogo(
        name: String,
        color: Color,
        pathData: String
    ): ImageVector {
        return ImageVector.Builder(
            name = name,
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).addPath(
            pathData = PathParser().parsePathString(pathData).toNodes(),
            fill = SolidColor(color),
            pathFillType = PathFillType.NonZero
        ).build()
    }

    private fun buildGoogleLogo(): ImageVector {
        val builder = ImageVector.Builder(
            name = "Google",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        )

        val segments = listOf(
            // Blue (right side)
            Color(0xFF4285F4) to "M21.5,12.255c0,-0.844 -0.069,-1.661 -0.205,-2.455L12,9.8v4.51h5.41" +
                "a4.625,4.625 0 0 1 -2.005,3.04v2.51h3.245c1.9,-1.75 2.985,-4.325 2.985,-7.605z",
            // Green (bottom)
            Color(0xFF34A853) to "M12,22c2.7,0 4.965,-0.895 6.62,-2.42l-3.245,-2.51c-0.9,0.6 -2.05,0.955 " +
                "-3.375,0.955 -2.595,0 -4.79,-1.755 -5.575,-4.11h-3.355v2.585A9.998,9.998 " +
                "0 0 0 12,22z",
            // Yellow (left)
            Color(0xFFFBBC05) to "M6.425,13.915a5.99,5.99 0 0 1 0,-3.825V7.505H3.07a10.001,10.001 " +
                "0 0 0 0,8.99l3.355,-2.58z",
            // Red (top)
            Color(0xFFEA4335) to "M12,5.96c1.47,-0.025 2.88,0.515 3.94,1.5l2.875,-2.84A9.55,9.55 " +
                "0 0 0 12,2 9.998,9.998 0 0 0 3.07,7.505l3.355,2.585C7.215,7.74 9.405,5.96 12,5.96z"
        )

        segments.forEach { (color, pathData) ->
            builder.addPath(
                pathData = PathParser().parsePathString(pathData).toNodes(),
                fill = SolidColor(color),
                pathFillType = PathFillType.NonZero
            )
        }

        return builder.build()
    }
}
