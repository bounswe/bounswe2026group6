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

    val Apple: ImageVector by lazy {
        buildSinglePathLogo(
            name = "Apple",
            color = Color(0xFF000000),
            pathData = "M16.365,1.43c0,1.14 -0.493,2.27 -1.177,3.08 -0.744,0.9 -1.99,1.57 " +
                "-2.987,1.57 -0.12,0 -0.23,-0.02 -0.3,-0.03 -0.01,-0.06 -0.04,-0.22 " +
                "-0.04,-0.39 0,-1.15 0.572,-2.27 1.206,-2.98 0.804,-0.94 2.142,-1.64 " +
                "3.248,-1.68 0.03,0.13 0.05,0.28 0.05,0.43zm4.565,15.71c-0.03,0.07 " +
                "-0.463,1.58 -1.518,3.12 -0.945,1.34 -1.94,2.71 -3.43,2.71 -1.517,0 " +
                "-1.9,-0.88 -3.63,-0.88 -1.698,0 -2.302,0.91 -3.67,0.91 -1.377,0 " +
                "-2.332,-1.26 -3.428,-2.8 -1.287,-1.82 -2.323,-4.63 -2.323,-7.28 0,-4.28 " +
                "2.797,-6.55 5.552,-6.55 1.448,0 2.675,0.95 3.6,0.95 0.865,0 2.222,-1.01 " +
                "3.902,-1.01 0.613,0 2.886,0.06 4.374,2.19 -0.13,0.09 -2.383,1.37 " +
                "-2.383,4.19 0,3.26 2.854,4.42 2.955,4.45z"
        )
    }

    val Facebook: ImageVector by lazy {
        buildSinglePathLogo(
            name = "Facebook",
            color = Color(0xFFFFFFFF),
            pathData = "M22.675,0H1.325C0.593,0 0,0.593 0,1.325v21.351C0,23.407 0.593,24 " +
                "1.325,24H12.82v-9.294H9.692v-3.622h3.128V8.413c0,-3.1 1.893,-4.788 " +
                "4.659,-4.788 1.325,0 2.463,0.099 2.795,0.143v3.24l-1.918,0.001c-1.504,0 " +
                "-1.795,0.715 -1.795,1.763v2.313h3.587l-0.467,3.622h-3.12V24h6.116c0.733,0 " +
                "1.325,-0.593 1.325,-1.325V1.325C24,0.593 23.407,0 22.675,0z"
        )
    }

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
