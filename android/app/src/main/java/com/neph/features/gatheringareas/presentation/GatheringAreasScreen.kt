package com.neph.features.gatheringareas.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.neph.navigation.Routes
import com.neph.ui.components.display.SectionCard
import com.neph.ui.components.display.SectionHeader
import com.neph.ui.layout.AppDrawerScaffold
import com.neph.ui.theme.LocalNephSpacing
import com.neph.ui.theme.NephTheme

@Composable
fun GatheringAreasScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    AppDrawerScaffold(
        title = "Gathering Areas",
        currentRoute = Routes.GatheringAreas.route,
        onNavigateToRoute = onNavigateToRoute,
        onOpenSettings = onOpenSettings
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.lg)) {
            SectionCard {
                SectionHeader(
                    title = "Gathering Areas",
                    subtitle = "This page will show safe gathering locations and related guidance."
                )

                Text(
                    text = "Location data and map integrations will be added in a later step.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun GatheringAreasScreenPreview() {
    NephTheme {
        GatheringAreasScreen(
            onNavigateToRoute = {},
            onOpenSettings = {}
        )
    }
}
