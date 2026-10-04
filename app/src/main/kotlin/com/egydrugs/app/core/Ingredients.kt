package com.egydrugs.app.core

/**
 * Normalises the free-text `scientific_name` column so that the same active ingredient(s) get the same key,
 * regardless of word order, synonyms in parentheses, strengths and common salt suffixes.
 *
 *  "PARACETAMOL(ACETAMINOPHEN)"      -> "PARACETAMOL"
 *  "DICLOFENAC SODIUM"               -> "DICLOFENAC"
 *  "CAFFEINE+PARACETAMOL"            -> "CAFFEINE+PARACETAMOL" (same for "PARACETAMOL+CAFFEINE")
 */
object Ingredients {

    private val SALT_WORDS = setOf(
        "HCL", "HYDROCHLORIDE", "SODIUM", "POTASSIUM", "MALEATE", "BESYLATE", "BESILATE", "MESYLATE",
        "TARTRATE", "SUCCINATE", "FUMARATE", "HYDROBROMIDE", "HYDRATE", "MONOHYDRATE", "DIHYDRATE",
        "TRIHYDRATE", "ANHYDROUS"
    )

    private val STRENGTH = Regex(
        """\d+(?:[.,]\d+)?\s*(?:(?:MG|MCG|UG|GM|G|IU|I\.U|ML|MEQ|UNITS|UNIT|U)(?![A-Z])|%)"""
    )

    private val NON_ALNUM = Regex("[^A-Z0-9]+")

    /** Sorted, de-duplicated, salt-free ingredient names joined by '+'. Empty when unknown. */
    fun key(scientific: String): String {
        if (scientific.isBlank()) return ""
        val up = scientific.uppercase()

        // Drop parenthesised text (synonyms, strengths, sub-lists) at any depth.
        val outer = StringBuilder(up.length)
        var depth = 0
        for (c in up) {
            when (c) {
                '(' -> depth++
                ')' -> if (depth > 0) depth--
                else -> if (depth == 0) outer.append(c)
            }
        }
        var text = outer.toString()
        if (text.isBlank()) text = up.replace('(', ' ').replace(')', ' ')

        val parts = java.util.TreeSet<String>()
        for (rawPart in text.split('+')) {
            var part = STRENGTH.replace(rawPart, " ")
            part = NON_ALNUM.replace(part, " ").trim()
            if (part.isEmpty()) continue
            val words = part.split(' ').toMutableList()
            while (words.size >= 2 && words[words.size - 1] in SALT_WORDS) {
                words.removeAt(words.size - 1)
            }
            val cleaned = words.joinToString(" ")
            if (cleaned.length >= 2) parts.add(cleaned)
        }
        return parts.joinToString("+")
    }

    /** Human friendly version of a [key]: "AMOXICILLIN+CLAVULANIC ACID" -> "Amoxicillin + Clavulanic acid". */
    fun pretty(key: String): String {
        return key.split('+').joinToString(" + ") { part ->
            val lower = part.lowercase()
            lower.replaceFirstChar { it.uppercase() }
        }
    }
}
