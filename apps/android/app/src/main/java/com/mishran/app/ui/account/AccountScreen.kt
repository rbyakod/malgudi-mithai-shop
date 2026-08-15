// apps/android/app/src/main/java/com/mishran/app/ui/account/AccountScreen.kt — P1 parity / P2 net-new.
//
// The Account tab: signed-in identity, delivery addresses, the language
// picker (per-app locales via AppCompatDelegate), a support section with the
// brand WhatsApp row (P1 parity — fetched from GET /brand, placeholder until
// then), the P2 journal + bulk-enquiry rows, and sign-out. Nothing here links
// to a screen that doesn't exist.
package com.mishran.app.ui.account

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.mishran.app.R

@Composable
fun AccountScreen(
    onOpenAddresses: () -> Unit,
    onOpenJournal: () -> Unit,
    onOpenEnquiry: () -> Unit,
    onWhatsApp: (digits: String) -> Unit,
    onSignedOut: () -> Unit,
    viewModel: AccountViewModel = hiltViewModel(),
) {
    val phone by viewModel.phone.collectAsStateWithLifecycle()
    val support by viewModel.support.collectAsStateWithLifecycle()
    val signingOut by viewModel.signingOut.collectAsStateWithLifecycle()
    val localeTag by viewModel.localeTag.collectAsStateWithLifecycle()
    var showLanguagePicker by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp),
    ) {
        Spacer(Modifier.height(24.dp))
        Text(
            text = stringResource(R.string.account_title),
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Light,
            color = MaterialTheme.colorScheme.primary,
        )

        Spacer(Modifier.height(20.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = stringResource(R.string.account_signed_in),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = phone ?: stringResource(R.string.account_signed_in_guest),
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
                        text = stringResource(R.string.account_addresses),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        text = stringResource(R.string.account_addresses_hint),
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
        // Per-app locale switcher — the picker persists the BCP-47 tag and
        // applies it via AppCompatDelegate (activity recreates immediately).
        Card(
            modifier = Modifier.fillMaxWidth(),
            onClick = { showLanguagePicker = true },
        ) {
            Row(
                modifier = Modifier.padding(16.dp).fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = stringResource(R.string.account_language),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        text = localeLabel(localeTag),
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
        // P2 net-new: journal + bulk & events rows (same card-row idiom).
        Card(
            modifier = Modifier.fillMaxWidth(),
            onClick = onOpenJournal,
        ) {
            Row(
                modifier = Modifier.padding(16.dp).fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = stringResource(R.string.stories_title),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        text = stringResource(R.string.stories_subtitle),
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
        Card(
            modifier = Modifier.fillMaxWidth(),
            onClick = onOpenEnquiry,
        ) {
            Row(
                modifier = Modifier.padding(16.dp).fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = stringResource(R.string.enquiry_title),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        text = stringResource(R.string.enquiry_subtitle),
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
                        text = stringResource(R.string.account_whatsapp),
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
                Text(stringResource(R.string.account_logout))
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

    if (showLanguagePicker) {
        LanguagePickerDialog(
            currentTag = localeTag,
            onSelect = { tag ->
                showLanguagePicker = false
                viewModel.setLocale(tag)
            },
            onDismiss = { showLanguagePicker = false },
        )
    }
}

/** The nine shipped locales, tag → native display name resource. */
private data class AppLocale(val tag: String, val labelRes: Int)

private val APP_LOCALES = listOf(
    AppLocale("en", R.string.account_locale_en),
    AppLocale("hi", R.string.account_locale_hi),
    AppLocale("kn", R.string.account_locale_kn),
    AppLocale("ta", R.string.account_locale_ta),
    AppLocale("te", R.string.account_locale_te),
    AppLocale("mr", R.string.account_locale_mr),
    AppLocale("gu", R.string.account_locale_gu),
    AppLocale("bn", R.string.account_locale_bn),
    AppLocale("pa", R.string.account_locale_pa),
)

/**
 * Native name of the effective locale: the persisted tag, or — when none was
 * chosen — the system language if it's one of the nine (else English).
 */
@Composable
private fun localeLabel(tag: String?): String {
    val effective = tag
        ?: LocalConfiguration.current.locales[0].language.takeIf { lang ->
            APP_LOCALES.any { it.tag == lang }
        }
        ?: "en"
    return stringResource(APP_LOCALES.first { it.tag == effective }.labelRes)
}

/** Single-choice picker over [APP_LOCALES]; picking applies immediately. */
@Composable
private fun LanguagePickerDialog(
    currentTag: String?,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val selectedTag = currentTag
        ?: LocalConfiguration.current.locales[0].language.takeIf { lang ->
            APP_LOCALES.any { it.tag == lang }
        }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.account_language)) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                APP_LOCALES.forEach { locale ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(locale.tag) },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(
                            selected = locale.tag == selectedTag,
                            onClick = { onSelect(locale.tag) },
                        )
                        Text(
                            text = stringResource(locale.labelRes),
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                }
            }
        },
        confirmButton = {},
    )
}
