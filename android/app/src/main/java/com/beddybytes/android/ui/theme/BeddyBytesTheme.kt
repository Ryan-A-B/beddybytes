package com.beddybytes.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val WebPrimary = Color(0xFFFFFCDD)
private val WebSecondary = Color(0xFFDCF7F3)
private val WebDanger = Color(0xFFFFD8D8)
private val WebDark = Color(0xFF212529)
private val WebNearBlack = Color(0xFF101010)
private val WebLight = Color(0xFFF8F9FA)

private val DarkColors =
    darkColorScheme(
        primary = WebPrimary,
        onPrimary = WebDark,
        secondary = WebSecondary,
        onSecondary = WebDark,
        tertiary = WebDanger,
        onTertiary = WebDark,
        error = WebDanger,
        onError = WebDark,
        background = WebNearBlack,
        onBackground = WebLight,
        surface = WebDark,
        onSurface = WebLight,
    )

@Suppress("FunctionName")
@Composable
fun BeddyBytesTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColors,
        content = content,
    )
}
