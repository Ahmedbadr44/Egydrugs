@file:OptIn(ExperimentalMaterial3Api::class)

package com.egydrugs.app.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.egydrugs.app.core.Drug

@Composable
fun DetailScreen(
    state: MainViewModel.DetailUi,
    onBack: () -> Unit,
    onOpen: (Drug) -> Unit,
    onSameRoute: (Boolean) -> Unit,
    onSameStrength: (Boolean) -> Unit
) {
    val drug = state.drug

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(Str.DETAILS) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = Str.BACK)
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item(key = "header") { HeaderCard(drug) }

            item(key = "disclaimer") {
                Text(
                    Str.DISCLAIMER,
                    modifier = Modifier.padding(horizontal = 4.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            item(key = "filters") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (state.hasRoute) {
                        FilterChip(
                            selected = state.sameRoute,
                            onClick = { onSameRoute(!state.sameRoute) },
                            label = { Text(Str.FILTER_ROUTE) }
                        )
                    }
                    if (state.hasStrength) {
                        FilterChip(
                            selected = state.sameStrength,
                            onClick = { onSameStrength(!state.sameStrength) },
                            label = { Text(Str.FILTER_STRENGTH) }
                        )
                    }
                }
            }

            // ---- equivalents ----
            item(key = "eq-title") {
                SectionTitle("${Str.EQUIVALENTS} (${state.equivalents.size})", Str.EQUIVALENTS_HINT)
            }
            if (state.equivalents.isEmpty()) {
                item(key = "eq-empty") {
                    Note(if (drug.scientific.isBlank()) Str.NO_EQUIVALENTS_UNKNOWN else Str.NO_EQUIVALENTS)
                }
            } else {
                items(state.equivalents, key = { "eq-${it.id}" }) { d -> DrugRow(d) { onOpen(d) } }
            }

        }
    }
}

@Composable
private fun SectionTitle(title: String, hint: String) {
    Column(Modifier.padding(top = 8.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        HorizontalDivider(Modifier.padding(top = 6.dp))
    }
}

@Composable
private fun HeaderCard(drug: Drug) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(drug.nameEn, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            if (drug.nameAr.isNotBlank() && drug.nameAr != drug.nameEn) {
                Text(drug.nameAr, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            HorizontalDivider(Modifier.padding(vertical = 2.dp))
            InfoLine(Str.SCIENTIFIC, drug.scientific.ifBlank { Str.NO_SCIENTIFIC })
            InfoLine(Str.MANUFACTURER, drug.manufacturer.ifBlank { "-" })
            InfoLine(Str.DRUG_CLASS, drug.drugClass.trim().trim('.').ifBlank { "-" })
            InfoLine(Str.FORM, Str.routeLabel(drug.route))
            InfoLine(Str.PRICE, formatPrice(drug.price))
            InfoLine(Str.DOSAGE, drug.dosage.ifBlank { Str.DOSAGE_FUTURE })
        }
    }
}

@Composable
private fun InfoLine(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            label,
            modifier = Modifier.weight(0.36f),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(value, modifier = Modifier.weight(0.64f), style = MaterialTheme.typography.bodyMedium)
    }
}
