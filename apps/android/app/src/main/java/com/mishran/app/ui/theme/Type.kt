// apps/android/app/src/main/java/com/mishran/app/ui/theme/Type.kt — Task 7.2.
//
// Material 3 type + shape scales mapped from the generated brand tokens
// (MishranType + MishranRadii in MishranTokens.kt). Same package as the
// generated tokens, so they are in scope without an import.
//
// Font family is left at the Material default on purpose: a branded
// typeface (e.g. a Devanagari-aware serif) is a deliberate, asset-coupled
// decision that belongs in a later design task, not the scaffold. The size
// scale is already token-driven so swapping a family later is local.
package com.mishran.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Material 3 type scale, every size pulled from [MishranType] so the app and
 * the iOS/web surfaces stay on one rhythm. Weights add hierarchy on top of the
 * token sizes (no separate weight token exists yet).
 */
val MishranTypography: Typography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = MishranType.display,
        lineHeight = MishranType.display * 1.2f,
    ),
    displayMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = MishranType.bodyXxl,
        lineHeight = MishranType.bodyXxl * 1.25f,
    ),
    displaySmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = MishranType.bodyXl,
        lineHeight = MishranType.bodyXl * 1.3f,
    ),
    headlineLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = MishranType.bodyXxl,
        lineHeight = MishranType.bodyXxl * 1.25f,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = MishranType.bodyXl,
        lineHeight = MishranType.bodyXl * 1.3f,
    ),
    headlineSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = MishranType.bodyLg,
        lineHeight = MishranType.bodyLg * 1.35f,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = MishranType.bodyXl,
        lineHeight = MishranType.bodyXl * 1.3f,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = MishranType.bodyLg,
        lineHeight = MishranType.bodyLg * 1.35f,
    ),
    titleSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = MishranType.bodyMd,
        lineHeight = MishranType.bodyMd * 1.4f,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = MishranType.bodyLg,
        lineHeight = MishranType.bodyLg * 1.45f,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = MishranType.bodyMd,
        lineHeight = MishranType.bodyMd * 1.45f,
    ),
    bodySmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = MishranType.bodySm,
        lineHeight = MishranType.bodySm * 1.5f,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = MishranType.bodyMd,
        lineHeight = MishranType.bodyMd * 1.4f,
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = MishranType.bodySm,
        lineHeight = MishranType.bodySm * 1.45f,
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 16.sp,
    ),
)

/**
 * Material 3 shape scale, each corner radius pulled from [MishranRadii]. The
 * brand is soft-edged (md 8 / lg 12 / xl 20) rather than pill-shaped, so the
 * `large`/`extraLarge` slots stay rounded-rect — that reads as a boutique
 * mithai box, not a chat bubble.
 */
val MishranShapes: Shapes = Shapes(
    small = MishranRadii.shapeSm(),
    medium = MishranRadii.shapeMd(),
    large = MishranRadii.shapeLg(),
    extraLarge = RoundedCornerShape(MishranRadii.xl),
)
