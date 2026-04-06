package com.neph.features.privacysecurity.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme

@Composable
fun PrivacySecurityScreen(
    onNavigateBack: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    AppScaffold(
        title = "Privacy & Security",
        onNavigateBack = onNavigateBack
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(spacing.lg)
        ) {
            SectionCard {
                SectionHeader(
                    title = "Privacy & Security",
                    subtitle = "Temporary placeholder screen."
                )

                Text(
                    text = "Privacy and security controls will be added in a later step.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun PrivacySecurityScreenPreview() {
    NephTheme {
        PrivacySecurityScreen(onNavigateBack = {})
    }
}