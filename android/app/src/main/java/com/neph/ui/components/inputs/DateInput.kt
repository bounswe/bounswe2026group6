package com.neph.ui.components.inputs

import android.app.DatePickerDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.neph.ui.theme.LocalNephSpacing
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

private const val DATE_FORMAT_PATTERN = "yyyy-MM-dd"

/**
 * Displays raw digits (max 8) as YYYY-MM-DD with dashes injected at positions 4 and 6.
 * Uses VisualTransformation so cursor mapping is exact — typing never shifts.
 */
private val DateVisualTransformation = VisualTransformation { annotated ->
    val digits = annotated.text.take(8)
    val out = buildString {
        for ((i, c) in digits.withIndex()) {
            if (i == 4 || i == 6) append('-')
            append(c)
        }
    }
    val offsetMapping = object : OffsetMapping {
        override fun originalToTransformed(offset: Int): Int = when {
            offset <= 4 -> offset
            offset <= 6 -> offset + 1
            else -> offset + 2
        }
        override fun transformedToOriginal(offset: Int): Int = when {
            offset <= 4 -> offset
            offset <= 7 -> offset - 1
            else -> offset - 2
        }
    }
    TransformedText(AnnotatedString(out), offsetMapping)
}

/** Extracts digits from a YYYY-MM-DD (or partial) string. */
private fun toDigits(formatted: String): String =
    formatted.filter(Char::isDigit).take(8)

/** Converts 8 raw digits back to a formatted YYYY-MM-DD string (or shorter partial). */
private fun toFormatted(digits: String): String = buildString {
    for ((i, c) in digits.take(8).withIndex()) {
        if (i == 4 || i == 6) append('-')
        append(c)
    }
}

/**
 * Input for ISO date values (YYYY-MM-DD).
 *
 * Supports both manual typing (with auto-inserted dashes via VisualTransformation,
 * so cursor never shifts) and a calendar picker via the trailing icon.
 * Both paths emit the same normalized YYYY-MM-DD string through [onValueChange].
 */
@Composable
fun DateInput(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    placeholder: String? = "YYYY-MM-DD",
    error: String? = null,
    maxIsToday: Boolean = true,
    testTag: String? = null
) {
    val spacing = LocalNephSpacing.current
    val context = LocalContext.current
    val isError = !error.isNullOrBlank()

    // TextField stores raw digits; we convert incoming formatted value to digits
    val digits = toDigits(value)

    fun openPicker() {
        val parser = SimpleDateFormat(DATE_FORMAT_PATTERN, Locale.US).apply { isLenient = false }
        val initialCalendar = Calendar.getInstance().apply {
            runCatching { parser.parse(value) }.getOrNull()?.let { time = it }
        }

        DatePickerDialog(
            context,
            { _, year, month, dayOfMonth ->
                onValueChange(
                    String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, dayOfMonth)
                )
            },
            initialCalendar.get(Calendar.YEAR),
            initialCalendar.get(Calendar.MONTH),
            initialCalendar.get(Calendar.DAY_OF_MONTH)
        ).apply {
            if (maxIsToday) datePicker.maxDate = System.currentTimeMillis()
            show()
        }
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(spacing.xs)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurface
        )

        OutlinedTextField(
            value = digits,
            onValueChange = { input ->
                val newDigits = input.filter(Char::isDigit).take(8)
                onValueChange(toFormatted(newDigits))
            },
            modifier = Modifier
                .then(
                    if (testTag.isNullOrBlank()) Modifier else Modifier.testTag(testTag)
                )
                .fillMaxWidth()
                .heightIn(min = 56.dp),
            enabled = enabled,
            singleLine = true,
            isError = isError,
            visualTransformation = DateVisualTransformation,
            textStyle = MaterialTheme.typography.bodyLarge.copy(
                color = MaterialTheme.colorScheme.onSurface
            ),
            placeholder = {
                if (!placeholder.isNullOrBlank()) {
                    Text(
                        text = placeholder,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            },
            trailingIcon = {
                IconButton(onClick = ::openPicker, enabled = enabled) {
                    Icon(
                        imageVector = Icons.Filled.DateRange,
                        contentDescription = "Open calendar"
                    )
                }
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            shape = MaterialTheme.shapes.small,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                errorBorderColor = MaterialTheme.colorScheme.error,
                disabledBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                errorContainerColor = MaterialTheme.colorScheme.surface,
                focusedTextColor = MaterialTheme.colorScheme.onSurface,
                unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                disabledTextColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                errorTextColor = MaterialTheme.colorScheme.onSurface,
                focusedLabelColor = MaterialTheme.colorScheme.primary,
                unfocusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant
            )
        )

        if (isError) {
            Text(
                text = error ?: "",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}
