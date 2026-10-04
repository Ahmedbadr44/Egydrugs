package com.egydrugs.app.core

/** Small RFC-4180 style CSV parser (quoted fields, doubled quotes, embedded newlines). */
object CsvParser {

    fun parse(input: String): List<List<String>> {
        val text = input.removePrefix("﻿")
        val rows = ArrayList<List<String>>()
        var row = ArrayList<String>()
        val field = StringBuilder()
        var inQuotes = false
        var i = 0
        val n = text.length
        while (i < n) {
            val c = text[i]
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < n && text[i + 1] == '"') {
                        field.append('"')
                        i++
                    } else {
                        inQuotes = false
                    }
                } else {
                    field.append(c)
                }
            } else {
                when (c) {
                    // A quote only opens a quoted field when it is the first character of the field.
                    '"' -> if (field.isEmpty()) inQuotes = true else field.append(c)
                    ',' -> {
                        row.add(field.toString())
                        field.setLength(0)
                    }
                    '\r' -> {}
                    '\n' -> {
                        row.add(field.toString())
                        field.setLength(0)
                        rows.add(row)
                        row = ArrayList()
                    }
                    else -> field.append(c)
                }
            }
            i++
        }
        if (field.isNotEmpty() || row.isNotEmpty()) {
            row.add(field.toString())
            rows.add(row)
        }
        return rows
    }

    /** Maps parsed rows (first row = header) to [Drug]s, looking columns up by header name. */
    fun toDrugs(rows: List<List<String>>): List<Drug> {
        if (rows.isEmpty()) return emptyList()
        val header = rows[0].map { it.trim().lowercase() }
        val iEn = header.indexOf("commercial_name_en")
        val iAr = header.indexOf("commercial_name_ar")
        val iSci = header.indexOf("scientific_name")
        val iMan = header.indexOf("manufacturer")
        val iCls = header.indexOf("drug_class")
        val iRoute = header.indexOf("route")
        val iPrice = header.indexOf("price_egp")
        val iDosage = header.indexOf("dosage")
        require(iEn >= 0 && iAr >= 0) { "Unexpected CSV header: $header" }

        val out = ArrayList<Drug>(rows.size)
        for (r in 1 until rows.size) {
            val row = rows[r]
            fun cell(i: Int): String = if (i >= 0 && i < row.size) row[i].trim() else ""
            val nameEn = cell(iEn)
            val nameAr = cell(iAr)
            if (nameEn.isEmpty() && nameAr.isEmpty()) continue
            val price = cell(iPrice).toDoubleOrNull()?.takeIf { it > 0.0 }
            out.add(
                Drug(
                    id = out.size,
                    nameEn = nameEn,
                    nameAr = nameAr,
                    scientific = cell(iSci),
                    manufacturer = cell(iMan),
                    drugClass = cell(iCls),
                    route = cell(iRoute),
                    price = price,
                    dosage = cell(iDosage)
                )
            )
        }
        return out
    }
}
