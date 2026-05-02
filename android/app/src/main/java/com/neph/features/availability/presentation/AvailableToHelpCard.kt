package com.neph.features.availability.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.components.selection.AppToggleSwitch
import com.neph.ui.theme.LocalNephSpacing
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

enum class AvailabilitySyncIndicator {
    NONE,
    SYNCING,
    SYNCED,
    FAILED
}

@Composable
fun AvailableToHelpCard(
    isAvailable: Boolean,
    loading: Boolean,
    errorMessage: String,
    infoMessage: String,
    syncMessage: String = "",
    syncIndicator: AvailabilitySyncIndicator = AvailabilitySyncIndicator.NONE,
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
                description = null,
                enabled = !loading
            )

            AvailabilitySyncStatusRow(
                indicator = syncIndicator,
                message = errorMessage.ifBlank { syncMessage }
            )

            if (errorMessage.isNotBlank() && syncIndicator != AvailabilitySyncIndicator.FAILED) {
                HelperText(text = errorMessage)
            }

            if (infoMessage.isNotBlank()) {
                HelperText(text = infoMessage)
            }

            if (syncMessage.isNotBlank() && syncIndicator == AvailabilitySyncIndicator.NONE) {
                HelperText(text = syncMessage)
            }
        }
    }
}

@Composable
private fun AvailabilitySyncStatusRow(
    indicator: AvailabilitySyncIndicator,
    message: String
) {
    if (indicator == AvailabilitySyncIndicator.NONE) {
        return
    }

    val spacing = LocalNephSpacing.current
    Row(
        horizontalArrangement = Arrangement.spacedBy(spacing.xs),
        verticalAlignment = Alignment.CenterVertically
    ) {
        when (indicator) {
            AvailabilitySyncIndicator.SYNCING -> CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                strokeWidth = 2.dp
            )
            AvailabilitySyncIndicator.SYNCED -> Icon(
                imageVector = Icons.Filled.CheckCircle,
                contentDescription = "Availability synced",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(18.dp)
            )
            AvailabilitySyncIndicator.FAILED -> Icon(
                imageVector = Icons.Filled.Error,
                contentDescription = "Availability sync failed",
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(18.dp)
            )
            AvailabilitySyncIndicator.NONE -> Unit
        }

        if (indicator == AvailabilitySyncIndicator.FAILED && message.isNotBlank()) {
            Text(
                text = message,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}
