package com.egydrugs.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection

private val LightColors = lightColorScheme(
    primary = Color(0xFF006C62),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFC2F0E9),
    onPrimaryContainer = Color(0xFF00201D),
    secondary = Color(0xFF3B5F90),
    secondaryContainer = Color(0xFFD9E2FF),
    tertiary = Color(0xFF8A5600),
    tertiaryContainer = Color(0xFFFFDDB3),
    background = Color(0xFFF8FAFA),
    onBackground = Color(0xFF191C1C),
    surface = Color(0xFFF8FAFA),
    surfaceVariant = Color(0xFFDEE5E3),
    outlineVariant = Color(0xFFBEC9C6)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF91D8CF),
    onPrimary = Color(0xFF003731),
    primaryContainer = Color(0xFF005049),
    onPrimaryContainer = Color(0xFFC2F0E9),
    secondary = Color(0xFFB2C5FF),
    secondaryContainer = Color(0xFF243B68),
    tertiary = Color(0xFFFFB95E),
    tertiaryContainer = Color(0xFF693F00),
    background = Color(0xFF101414),
    onBackground = Color(0xFFE0E3E2),
    surface = Color(0xFF101414),
    surfaceVariant = Color(0xFF424947),
    outlineVariant = Color(0xFF8C9693)
)

@Composable
fun EgyDrugsTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) DarkColors else LightColors
    // The app is Arabic only: always lay out right-to-left, whatever the phone language is.
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(colorScheme = colors, content = content)
    }
}
