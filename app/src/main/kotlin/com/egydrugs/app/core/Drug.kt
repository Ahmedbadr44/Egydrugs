package com.egydrugs.app.core

/** One row of the Egyptian drug database. [id] equals the index in the loaded list. */
data class Drug(
    val id: Int,
    val nameEn: String,
    val nameAr: String,
    val scientific: String,
    val manufacturer: String,
    val drugClass: String,
    val route: String,
    val price: Double?,
    val dosage: String = "",
    val remoteId: Long? = null
)
