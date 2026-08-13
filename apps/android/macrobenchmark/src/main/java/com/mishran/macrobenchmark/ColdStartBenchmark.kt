// apps/android/macrobenchmark/src/main/java/com/mishran/macrobenchmark/ColdStartBenchmark.kt — Task 12.2.
//
// Cold-start budget: plan constraint is p95 ≤ 1.5s on a Pixel 4a-class
// device. The benchmark measures fully-cold launches (no warm process, no
// cached activity) through the splash → home gate; the p95 is read from the
// generated metric report and enforced by the CI gate job (a >5% regression
// against the committed baseline fails the run). Assertion lives outside
// the benchmark on purpose — hard-asserting wall-clock inside the test
// makes it flaky on shared runners.
package com.mishran.macrobenchmark

import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.benchmark.macro.tracesection.trace
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ColdStartBenchmark {

    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @Test
    fun coldStartToHome() = benchmarkRule.measureRepeated(
        packageName = PACKAGE_NAME,
        metrics = listOf(StartupTimingMetric(), FrameTimingMetric()),
        iterations = 10,
        startupMode = StartupMode.COLD,
        compilationMode = CompilationMode.Partial(),
    ) {
        pressHome()
        startActivityAndWait()

        // Wait for the post-splash content — Home's headline — so the
        // measured window covers the real interaction-ready point.
        device.waitForIdle()
        trace("cold-start-complete") {}
    }

    private companion object {
        // The benchmark build type keeps the release applicationId.
        const val PACKAGE_NAME = "com.mishran.app"
    }
}
