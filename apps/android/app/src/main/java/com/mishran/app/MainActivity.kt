// apps/android/app/src/main/java/com/mishran/app/MainActivity.kt — Task 7.1 / 7.4.
//
// Single-activity host. @AndroidEntryPoint enables Hilt field injection; the
// Compose NavGraph (Task 7.4) lives in MishranAppRoot, wrapped in the brand
// MishranTheme (Task 7.2). Deep links (mishran://order/{id}) are declared in
// the AndroidManifest intent-filter and resolved inside the NavHost.
package com.mishran.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.mishran.app.navigation.MishranAppRoot
import com.mishran.app.ui.theme.MishranTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MishranTheme {
                MishranAppRoot()
            }
        }
    }
}
