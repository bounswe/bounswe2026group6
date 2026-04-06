package com.neph.ui.components.inputs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.neph.ui.theme.LocalNephSpacing

@Composable
fun VerificationCodeField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    length: Int = 6,
    enabled: Boolean = true
) {
    val spacing = LocalNephSpacing.current
    val focusRequesters = List(length) { FocusRequester() }

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(spacing.xs)
    ) {
        repeat(length) { index ->
            val char = value.getOrNull(index)?.toString().orEmpty()

            OutlinedTextField(
                value = char,
                onValueChange = { input ->
                    if (!enabled) return@OutlinedTextField

                    val digit = input.takeLast(1).filter { it.isDigit() }
                    val current = value.padEnd(length, ' ').toMutableList()

                    current[index] = if (digit.isNotEmpty()) digit[0] else ' '
                    val newValue = current.joinToString("").trimEnd()

                    onValueChange(newValue)

                    if (digit.isNotEmpty() && index < length - 1) {
                        focusRequesters[index + 1].requestFocus()
                    }
                },
                modifier = Modifier
                    .width(44.dp)
                    .focusRequester(focusRequesters[index]),
                enabled = enabled,
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge.copy(
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center
                ),
                placeholder = {
                    Text(
                        text = "•",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                shape = MaterialTheme.shapes.small,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                    disabledBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                    disabledContainerColor = MaterialTheme.colorScheme.surface,
                    focusedTextColor = MaterialTheme.colorScheme.onSurface,
                    unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                    disabledTextColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            )
        }
    }
}