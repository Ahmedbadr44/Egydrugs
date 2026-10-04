package com.egydrugs.app.core

/** Clinical information attached to one marketed product. */
data class DrugMedicalInfo(
    val uses: List<String> = emptyList(),
    val dosages: List<String> = emptyList(),
    val sideEffects: List<String> = emptyList(),
    val warnings: List<String> = emptyList(),
    val sourceUrl: String? = null,
    val sourceName: String? = null,
    val confidence: Double? = null,
    val updatedAt: String? = null
)
