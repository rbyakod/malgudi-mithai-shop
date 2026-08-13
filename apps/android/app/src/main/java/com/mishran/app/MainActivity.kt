// apps/android/app/src/main/java/com/mishran/app/MainActivity.kt — Task 7.1.
//
// Single-activity host for the Compose NavGraph (wired in Task 7.4). For now it
// renders a brand-themed placeholder surface so the project compiles + launches;
// MishranTheme is applied here (Task 7.2), the NavHost lands in Task 7.4.
package com.mishran.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.mishran.app.ui.theme.MishranTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MishranTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    Placeholder(modifier = Modifier.padding(innerPadding))
                }
            }
        }
    }
}

@Composable
private fun Placeholder(modifier: Modifier = Modifier) {
    // Replaced by the NavHost in Task 7.4.
    Text(
        text = "Mishran",
        style = MaterialTheme.typography.headlineMedium,
        textAlign = TextAlign.Center,
        modifier = modifier.padding(24.dp),
    )
}
