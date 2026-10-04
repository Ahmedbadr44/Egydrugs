package com.egydrugs.app.core

/** Extracts strengths (e.g. "500 MG", "1 GM", "400 IU") from a trade name so equivalents can match on them. */
object Strength {

    private val PATTERN = Regex(
        """(\d+(?:\.\d+)?)\s*(?:(MG|MCG|UG|GM|G|IU)(?![A-Z])|(%))"""
    )

    /**
     * Sorted list of normalised strength tokens such as "mg=500.0", "iu=400.0", "pct=2.0".
     * Grams and micrograms are converted to milligrams so "1 GM" equals "1000 MG".
     */
    fun of(nameEn: String): List<String> {
        val up = nameEn.uppercase()
        val out = ArrayList<String>()
        for (m in PATTERN.findAll(up)) {
            val value = m.groupValues[1].toDoubleOrNull() ?: continue
            val unit = m.groupValues[2]
            val token = when {
                m.groupValues[3] == "%" -> "pct=$value"
                unit == "MG" -> "mg=$value"
                unit == "GM" || unit == "G" -> "mg=${value * 1000.0}"
                unit == "MCG" || unit == "UG" -> "mg=${value / 1000.0}"
                unit == "IU" -> "iu=$value"
                else -> continue
            }
            out.add(token)
        }
        out.sort()
        return out
    }
}
