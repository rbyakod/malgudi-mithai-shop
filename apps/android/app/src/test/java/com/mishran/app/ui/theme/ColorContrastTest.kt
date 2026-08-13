// apps/android/app/src/test/java/com/mishran/app/ui/theme/ColorContrastTest.kt — Task 12.4.
//
// Pins the WCAG AA contrast floor for the text pairs the app actually
// renders. The audit found dark-mode error text at 2.10:1 because both
// schemes shared the light-mode #9D1C1C token; the dark scheme now carries
// its own warmed error ink. These tests fail if a future palette tweak
// reintroduces an unreadable pair.
package com.mishran.app.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import kotlin.math.abs
import org.junit.Assert.assertTrue
import org.junit.Test

/** WCAG 2.x relative-contrast ratio between two opaque colors. */
private fun contrast(a: Color, b: Color): Double {
    val la = a.luminance().toDouble()
    val lb = b.luminance().toDouble()
    val lighter = maxOf(la, lb)
    val darker = minOf(la, lb)
    return (lighter + 0.05) / (darker + 0.05)
}

private fun assertAa(name: String, foreground: Color, background: Color) {
    val ratio = contrast(foreground, background)
    assertTrue("$name contrast $ratio must be >= 4.5", ratio >= 4.5)
}

class ColorContrastTest {

    @Test
    fun lightModeBodyTextPassesAa() {
        assertAa("light onBackground", MishranLightColorScheme.onBackground, MishranLightColorScheme.background)
        assertAa("light onSurface", MishranLightColorScheme.onSurface, MishranLightColorScheme.surface)
        assertAa("light onSurfaceVariant", MishranLightColorScheme.onSurfaceVariant, MishranLightColorScheme.background)
        assertAa("light onPrimary", MishranLightColorScheme.onPrimary, MishranLightColorScheme.primary)
    }

    @Test
    fun darkModeBodyTextPassesAa() {
        assertAa("dark onBackground", MishranDarkColorScheme.onBackground, MishranDarkColorScheme.background)
        assertAa("dark onSurface", MishranDarkColorScheme.onSurface, MishranDarkColorScheme.surface)
        assertAa("dark onSurfaceVariant", MishranDarkColorScheme.onSurfaceVariant, MishranDarkColorScheme.surfaceVariant)
        assertAa("dark onPrimary", MishranDarkColorScheme.onPrimary, MishranDarkColorScheme.primary)
    }

    @Test
    fun errorTextPassesAaInBothModes() {
        // Regression: both schemes used to share #9D1C1C, which is 2.10:1 on
        // the deep-ink dark canvas — unreadable for error/OTP-failure copy.
        assertAa("light error", MishranLightColorScheme.error, MishranLightColorScheme.background)
        assertAa("dark error", MishranDarkColorScheme.error, MishranDarkColorScheme.background)
    }

    @Test
    fun nonTextStateIndicatorsPassAaComponentMinimum() {
        // WCAG 1.4.11 wants 3:1 for stateful UI graphics (pager dots,
        // timeline dots). Active gallery dot + current timeline dot use
        // primary; inactive pager dots use onSurfaceVariant (outline was
        // 2.49:1 on the light canvas).
        val lightRatio = contrast(MishranLightColorScheme.onSurfaceVariant, MishranLightColorScheme.background)
        assertTrue("light inactive-dot ratio $lightRatio must be >= 3.0", lightRatio >= 3.0)
        val darkRatio = contrast(MishranDarkColorScheme.onSurfaceVariant, MishranDarkColorScheme.background)
        assertTrue("dark inactive-dot ratio $darkRatio must be >= 3.0", darkRatio >= 3.0)
        val lightActive = contrast(MishranLightColorScheme.primary, MishranLightColorScheme.background)
        assertTrue("light active-dot ratio $lightActive must be >= 3.0", lightActive >= 3.0)
    }

    @Test
    fun helperSanityBlackOnWhite() {
        // Guards the helper itself: pure black on pure white is exactly 21.
        assertTrue(abs(contrast(Color.Black, Color.White) - 21.0) < 0.01)
    }
}
