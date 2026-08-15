// apps/android/app/src/main/java/com/mishran/app/ui/account/AccountScreen.kt — P1 parity.
//
// The Account tab: signed-in identity, delivery addresses, a support section
// with the brand WhatsApp row (P1 parity — fetched from GET /brand,
// placeholder until then), and sign-out. Addresses/biometric/loyalty arrive
// with their real flows — nothing here links to a screen that doesn't exist
// yet.
package com.mishran.app.ui.account

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun AccountScreen(
    onOpenAddresses: () -> Unit,
    onWhatsApp: (digits: String) -> Unit,
    onSignedOut: () -> Unit,
    viewModel: AccountViewModel = hiltViewModel(),
) {
    val phone by viewModel.phone.collectAsStateWithLifecycle()
    val support by viewModel.support.collectAsStateWithLifecycle()
    val signingOut by viewModel.signingOut.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
    ) {
        Spacer(Modifier.height(24.dp))
        Text(
            text = "Account",
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Light,
            color = MaterialTheme.colorScheme.primary,
        )

        Spacer(Modifier.height(20.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "Signed in as",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = phone ?: "Mishran customer",
                    style = MaterialTheme.typography.titleMedium,
                )
            }
        }

        Spacer(Modifier.height(16.dp))
        Card(
            modifier = Modifier.fillMaxWidth(),
            onClick = onOpenAddresses,
        ) {
            Row(
                modifier = Modifier.padding(16.dp).fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "Delivery addresses",
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        text = "Saved addresses for faster checkout",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    text = "›",
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(Modifier.height(16.dp))
        // Support — the brand WhatsApp line (P1 parity). Number/digits come
        // from GET /brand via the ViewModel; until that lands (or offline)
        // the placeholder keeps the row actionable.
        Card(
            modifier = Modifier.fillMaxWidth(),
            onClick = { onWhatsApp(support.whatsappDigits) },
        ) {
            Row(
                modifier = Modifier.padding(16.dp).fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Chat,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                )
                Column(
                    Modifier
                        .weight(1f)
                        .padding(start = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        text = "WhatsApp us",
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        text = support.whatsappNumber,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    text = "›",
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(Modifier.height(24.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedButton(
                onClick = { viewModel.signOut(onSignedOut) },
                enabled = !signingOut,
            ) {
                Text("Sign out")
            }
            if (signingOut) {
                Spacer(Modifier.width(12.dp))
                CircularProgressIndicator(
                    modifier = Modifier.height(20.dp).width(20.dp),
                    strokeWidth = 2.dp,
                )
            }
        }
    }
}
