package com.neph.features.assignedrequest.presentation

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
fun AssignedRequestScreen(
    onNavigateToRoute: (String) -> Unit,
    onOpenSettings: () -> Unit
) {
    val spacing = LocalNephSpacing.current

    AppDrawerScaffold(
        title = "Assigned Request",
        currentRoute = Routes.AssignedRequest.route,
        onNavigateToRoute = onNavigateToRoute,
        onOpenSettings = onOpenSettings
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(spacing.lg)) {
            SectionCard {
                SectionHeader(
                    title = "Assigned Request",
                    subtitle = "This page will show the request currently assigned to you."
                )

                Text(
                    text = "Assignment details and response actions will be added later.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun AssignedRequestScreenPreview() {
    NephTheme {
        AssignedRequestScreen(
            onNavigateToRoute = {},
            onOpenSettings = {}
        )
    }
}
