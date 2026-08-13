// apps/android/app/src/main/java/com/mishran/app/ui/theme/Color.kt — Task 7.2.
//
// Material 3 color schemes derived from the generated brand tokens
// (MishranColors in MishranTokens.kt). The brand is warm + earthy — kakvi
// brown accent on a cream canvas — so the dark scheme inverts onto a deep
// ink canvas rather than a neutral charcoal, keeping the mithai-boutique
// identity in both modes.
package com.mishran.app.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

/** Light scheme: cream canvas, kakvi-brown primary, saffron secondary pop. */
val MishranLightColorScheme: ColorScheme = lightColorScheme(
    primary = MishranColors.BrandAccent,
    onPrimary = Color.White,
    primaryContainer = MishranColors.BrandAccent,
    onPrimaryContainer = Color.White,
    secondary = MishranColors.BrandPop,
    onSecondary = Color(0xFF2C1810),
    tertiary = MishranColors.BrandPop,
    onTertiary = Color(0xFF2C1810),
    background = MishranColors.BrandCanvas,
    onBackground = MishranColors.BrandInk,
    surface = MishranColors.BrandSurface,
    onSurface = MishranColors.BrandInk,
    surfaceVariant = MishranColors.Neutral100,
    onSurfaceVariant = MishranColors.Neutral700,
    outline = MishranColors.Neutral400,
    error = MishranColors.StateError,
    onError = Color.White,
)

/**
 * Dark-mode error ink: [MishranColors.StateError] (#9D1C1C) is 2.10:1 on the
 * deep-ink canvas — unreadable for error/OTP-failure messages. This warmed
 * salmon keeps the terracotta family at 7.95:1 on BrandInk (Task 12.4 audit).
 */
private val StateErrorDark = Color(0xFFE8A09B)

/** Dark scheme: deep ink canvas, warmed accent so it reads on black. */
val MishranDarkColorScheme: ColorScheme = darkColorScheme(
    primary = MishranColors.BrandPop,
    onPrimary = Color(0xFF2C1810),
    primaryContainer = MishranColors.BrandAccent,
    onPrimaryContainer = Color.White,
    secondary = MishranColors.BrandPop,
    onSecondary = Color(0xFF2C1810),
    background = MishranColors.BrandInk,
    onBackground = MishranColors.Neutral100,
    surface = Color(0xFF3A241A),
    onSurface = MishranColors.Neutral100,
    surfaceVariant = Color(0xFF4A3328),
    onSurfaceVariant = MishranColors.Neutral200,
    outline = MishranColors.Neutral400,
    error = StateErrorDark,
    onError = Color(0xFF2C1810),
)
