package com.neph.features.auth.presentation.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.neph.ui.theme.LocalNephSpacing

enum class SocialAuthMode {
    LOGIN,
    SIGNUP
}

@Composable
fun SocialAuthButtons(
    mode: SocialAuthMode,
    onGoogleClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalNephSpacing.current
    val verb = if (mode == SocialAuthMode.LOGIN) "Continue" else "Sign up"

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(spacing.sm)
    ) {
        BrandAuthButton(
            text = "$verb with Google",
            onClick = onGoogleClick,
            background = Color(0xFFFFFFFF),
            contentColor = Color(0xFF1F1F1F),
            border = BorderStroke(1.dp, Color(0xFFDADCE0)),
            logo = BrandLogos.Google,
            logoTint = Color.Unspecified
        )
    }
}

@Composable
private fun BrandAuthButton(
    text: String,
    onClick: () -> Unit,
    background: Color,
    contentColor: Color,
    border: BorderStroke?,
    logo: ImageVector,
    logoTint: Color
) {
    val spacing = LocalNephSpacing.current

    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = background,
            contentColor = contentColor
        ),
        border = border,
        contentPadding = PaddingValues(
            horizontal = spacing.lg,
            vertical = spacing.sm
        )
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            Box(
                modifier = Modifier.size(22.dp),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = logo,
                    contentDescription = null,
                    tint = logoTint
                )
            }
            Text(
                text = text,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                color = contentColor
            )
        }
    }
}