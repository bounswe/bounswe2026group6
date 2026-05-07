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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.neph.features.availability.data.AvailabilityPauseReason
import com.neph.features.availability.data.AvailabilityState
import com.neph.ui.components.buttons.PrimaryButton
import com.neph.ui.components.display.HelperText
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.components.selection.AppToggleSwitch
import com.neph.ui.theme.LocalNephSpacing

enum class AvailabilitySyncIndicator {
    NONE,
    SYNCING,
    SYNCED,
    FAILED
}

@Composable
fun AvailableToHelpCard(
    availabilityState: AvailabilityState,
    loading: Boolean,
    errorMessage: String,
    infoMessage: String,
    syncMessage: String = "",
    syncIndicator: AvailabilitySyncIndicator = AvailabilitySyncIndicator.NONE,
    onRefreshLocationAndBecomeAvailable: () -> Unit,
    onAvailabilityChange: (Boolean) -> Unit
) {
    val spacing = LocalNephSpacing.current
    val pauseReason = AvailabilityPauseReason.fromBackend(availabilityState.pauseReason)
    val isPaused = availabilityState.isAvailable &&
        !availabilityState.isAssignable &&
        pauseReason != AvailabilityPauseReason.NONE

    SectionCard {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.md)) {
            SectionHeader(
                title = "Available to Help",
                subtitle = availabilityStatusMessage(availabilityState, syncIndicator, pauseReason)
            )

            AppToggleSwitch(
                checked = availabilityState.isAvailable,
                onCheckedChange = onAvailabilityChange,
                label = if (availabilityState.isAssignable) {
                    "Available and assignable"
                } else if (availabilityState.isAvailable) {
                    "Available but paused"
                } else {
                    "Currently unavailable"
                },
                description = null,
                enabled = !loading
            )

            if (isPaused) {
                PrimaryButton(
                    text = "Refresh location and become available",
                    onClick = onRefreshLocationAndBecomeAvailable,
                    loading = loading,
                    enabled = !loading
                )
            }

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

private fun availabilityStatusMessage(
    state: AvailabilityState,
    syncIndicator: AvailabilitySyncIndicator,
    pauseReason: AvailabilityPauseReason
): String {
    if (!state.isAvailable) {
        return "Turn this on when you are ready to support incoming requests."
    }

    if (state.isPendingSync || syncIndicator == AvailabilitySyncIndicator.SYNCING) {
        return "Availability is saved locally and will sync shortly."
    }

    if (state.isAssignable) {
        return "You are available and can receive assignment matches."
    }

    return when (pauseReason) {
        AvailabilityPauseReason.LOCATION_STALE ->
            "Location refresh required. Your last location is no longer fresh enough for matching."
        AvailabilityPauseReason.LOCATION_MISSING ->
            "Location refresh required. We need your current location before matching you."
        AvailabilityPauseReason.AVAILABILITY_EXPIRED ->
            "Availability expired. Refresh your location to become available again."
        AvailabilityPauseReason.NONE ->
            "Availability is paused until your state syncs."
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
