package com.neph.features.availability.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.components.selection.AppToggleSwitch
import com.neph.ui.theme.LocalNephSpacing

@Composable
fun AvailableToHelpCard(
    isAvailable: Boolean,
    loading: Boolean,
    errorMessage: String,
    infoMessage: String,
    onAvailabilityChange: (Boolean) -> Unit
) {
    val spacing = LocalNephSpacing.current

    SectionCard {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
            SectionHeader(
                title = "Available to Help",
                subtitle = if (isAvailable) {
                    "You are marked as available and can receive assignment matches."
                } else {
                    "Turn this on when you are ready to support incoming requests."
                }
            )

            AppToggleSwitch(
                checked = isAvailable,
                onCheckedChange = onAvailabilityChange,
                label = if (isAvailable) {
                    "Currently available"
                } else {
                    "Currently unavailable"
                },
                description = if (loading) "Updating your availability..." else null,
                enabled = !loading
            )

            if (errorMessage.isNotBlank()) {
                HelperText(text = errorMessage)
            }

            if (infoMessage.isNotBlank()) {
                HelperText(text = infoMessage)
            }
        }
    }
}
