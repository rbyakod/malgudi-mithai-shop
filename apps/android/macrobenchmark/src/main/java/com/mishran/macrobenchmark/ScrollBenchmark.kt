// apps/android/macrobenchmark/src/main/java/com/mishran/macrobenchmark/ScrollBenchmark.kt — Task 12.2.
//
// Catalog scroll jank: FrameTimingMetric over the two-column LazyVerticalGrid
// with Coil image loads — the heaviest scrolling surface in the app. The
// frame-over-16.7ms percentage is the number the CI gate watches (>5% janky
// frames vs baseline = investigate).
package com.mishran.macrobenchmark

import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Direction
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ScrollBenchmark {

    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @Test
    fun scrollCatalog() = benchmarkRule.measureRepeated(
        packageName = PACKAGE_NAME,
        metrics = listOf(FrameTimingMetric()),
        iterations = 5,
        startupMode = StartupMode.WARM,
        compilationMode = CompilationMode.Partial(),
    ) {
        pressHome()
        startActivityAndWait()

        // Bottom tab → Catalog.
        device.findObject(By.desc("Catalog"))?.click()
        device.waitForIdle()

        // Fling the grid several times — image decode + composition under load.
        val grid = device.findObject(By.clazz("android.widget.ScrollView"))
            ?: device.findObject(By.scrollable(true))
        repeat(4) {
            grid?.fling(Direction.DOWN)
            device.waitForIdle()
        }
    }

    private companion object {
        const val PACKAGE_NAME = "com.mishran.app"
    }
}
