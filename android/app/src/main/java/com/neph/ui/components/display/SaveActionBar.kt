package com.neph.ui.components.display

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.neph.ui.components.buttons.PrimaryButton

@Composable
fun SaveActionBar(
    onSave: () -> Unit,
    loading: Boolean = false,
    modifier: Modifier = Modifier
) {
    Row(modifier = modifier.fillMaxWidth()) {
        PrimaryButton(
            text = if (loading) "Saving..." else "Save",
            onClick = onSave,
            loading = loading
        )
    }
}
