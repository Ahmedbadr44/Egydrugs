package com.egydrugs.app.core

enum class SearchScope { ALL, ARABIC, ENGLISH, INGREDIENT }

/** A drug together with the pre-computed search keys. Built once at start-up. */
class IndexedDrug(
    val drug: Drug,
    val litEn: String,
    val litAr: String,
    val litSci: String,
    val pkEn: String,
    val pkSci: String,
    val skEn: String,
    val skAr: String,
    val skSci: String,
    val ingKey: String,
    val classPath: List<String>,
    val strength: List<String>
)

/**
 * Search rules
 *  - Every space typed by the user stands for "some missing letters": the pieces must appear in the
 *    text in the same order ("par cetamol", "pa ado", "بارا يتامول"). A leading space means the start
 *    of the name is unknown too.
 *  - Matching is tried from strict to loose, and the strictest tier that matches decides the rank:
 *      literal (exact > prefix > word start > anywhere)
 *      phonetic key (same sound, e.g. ph/f, c/k, p/b, z/s, Arabic vs English spelling)
 *      consonant skeleton (ignores vowel spelling)
 *      fuzzy (one or two wrong consonants), only when there are few other results.
 */
class SearchEngine(private val items: List<IndexedDrug>) {

    private class Hit(val index: Int, val score: Int)

    private class Query(
        val anchored: Boolean,
        val lit: List<String>,
        val pk: List<String>,
        val sk: List<String>
    ) {
        val litJoined: String = lit.joinToString(" ")
        val pkLen: Int = pk.sumOf { it.length }
        val skJoined: String = sk.joinToString("")

        companion object {
            fun parse(raw: String): Query? {
                if (raw.isEmpty()) return null
                val litText = Phonetics.literal(raw)
                if (litText.isEmpty()) return null
                val lit = litText.split(' ')
                if (lit.sumOf { it.length } < MIN_QUERY_LENGTH) return null
                val pk = lit.map { Phonetics.key(it) }.filter { it.isNotEmpty() }
                val sk = pk.map { Phonetics.skeleton(it) }.filter { it.isNotEmpty() }
                return Query(!raw[0].isWhitespace(), lit, pk, sk)
            }
        }
    }

    fun search(raw: String, scope: SearchScope, limit: Int = 200): List<Drug> {
        val q = Query.parse(raw) ?: return emptyList()
        val hits = ArrayList<Hit>()
        val flagged = BooleanArray(items.size)

        for (i in items.indices) {
            val s = score(items[i], q, scope)
            if (s >= 0) {
                hits.add(Hit(i, s))
                flagged[i] = true
            }
        }

        if (hits.size < FUZZY_TRIGGER && q.skJoined.length >= 3) {
            for (i in items.indices) {
                if (flagged[i]) continue
                val d = fuzzyDistance(items[i], q, scope)
                if (d >= 0) hits.add(Hit(i, FUZZY_BASE + d))
            }
        }

        hits.sortWith(Comparator { a, b ->
            if (a.score != b.score) {
                a.score - b.score
            } else {
                val na = items[a.index].drug.nameEn
                val nb = items[b.index].drug.nameEn
                if (na.length != nb.length) na.length - nb.length else na.compareTo(nb)
            }
        })

        val result = ArrayList<Drug>(minOf(limit, hits.size))
        for (h in hits) {
            if (result.size >= limit) break
            result.add(items[h.index].drug)
        }
        return result
    }

    // ---- scoring -------------------------------------------------------------------------------

    private fun score(d: IndexedDrug, q: Query, scope: SearchScope): Int {
        return when (scope) {
            SearchScope.ENGLISH -> fieldScore(d.litEn, d.pkEn, d.skEn, q, 0)
            SearchScope.ARABIC -> fieldScore(d.litAr, null, d.skAr, q, 0)
            SearchScope.INGREDIENT -> fieldScore(d.litSci, d.pkSci, d.skSci, q, 0)
            SearchScope.ALL -> {
                var best = fieldScore(d.litEn, d.pkEn, d.skEn, q, 0)
                best = better(best, fieldScore(d.litAr, null, d.skAr, q, 0))
                better(best, fieldScore(d.litSci, d.pkSci, d.skSci, q, 1))
            }
        }
    }

    private fun better(a: Int, b: Int): Int {
        if (a < 0) return b
        if (b < 0) return a
        return if (b < a) b else a
    }

    /** Returns -1 for no match, otherwise tier * 2 + [penalty] (lower is better). */
    private fun fieldScore(lit: String, pk: String?, sk: String, q: Query, penalty: Int): Int {
        var tier = -1

        if (lit.isNotEmpty()) {
            val idx = orderedFind(lit, q.lit)
            if (idx >= 0) {
                tier = when {
                    !q.anchored -> 3
                    idx == 0 -> if (lit == q.litJoined) 0 else 1
                    lit[idx - 1] == ' ' -> 2
                    else -> 3
                }
            }
        }
        if (tier < 0 && pk != null && pk.isNotEmpty() && q.pkLen >= MIN_QUERY_LENGTH) {
            val idx = orderedFind(pk, q.pk)
            if (idx >= 0) {
                tier = when {
                    !q.anchored -> 6
                    idx == 0 -> 4
                    pk[idx - 1] == ' ' -> 5
                    else -> 6
                }
            }
        }
        if (tier < 0 && sk.isNotEmpty() && q.skJoined.length >= MIN_QUERY_LENGTH) {
            val idx = orderedFind(sk, q.sk)
            if (idx >= 0) {
                tier = if (q.anchored && idx == 0) 7 else 8
            }
        }
        return if (tier < 0) -1 else tier * 2 + penalty
    }

    /**
     * Index where the first segment starts if all segments occur in order, else -1.
     * A later segment must either start a new word ("amox clav") or follow the previous segment after
     * at most [MAX_MISSING_LETTERS] missing letters inside the same word ("para cetamol").
     */
    private fun orderedFind(hay: String, segs: List<String>): Int {
        var start = hay.indexOf(segs[0])
        while (start >= 0) {
            if (restMatches(hay, segs, start + segs[0].length)) return start
            start = hay.indexOf(segs[0], start + 1)
        }
        return -1
    }

    private fun restMatches(hay: String, segs: List<String>, from: Int): Boolean {
        var pos = from
        for (n in 1 until segs.size) {
            var idx = hay.indexOf(segs[n], pos)
            while (idx >= 0 && !gapAllowed(hay, pos, idx)) idx = hay.indexOf(segs[n], idx + 1)
            if (idx < 0) return false
            pos = idx + segs[n].length
        }
        return true
    }

    private fun gapAllowed(hay: String, from: Int, idx: Int): Boolean {
        if (idx == 0 || hay[idx - 1] == ' ') return true
        if (idx - from > MAX_MISSING_LETTERS) return false
        for (k in from until idx) {
            if (hay[k] == ' ') return false
        }
        return true
    }

    // ---- fuzzy fallback --------------------------------------------------------------------------

    /** Smallest edit distance between the query skeleton and any word of the searched fields, or -1. */
    private fun fuzzyDistance(d: IndexedDrug, q: Query, scope: SearchScope): Int {
        val target = q.skJoined
        val maxD = if (target.length >= 7) 2 else 1
        var best = maxD + 1

        fun scan(lit: String) {
            if (lit.isEmpty()) return
            var count = 0
            for (tok in lit.split(' ')) {
                if (count >= MAX_FUZZY_TOKENS) break
                count++
                if (tok.length < 3) continue
                val sk = Phonetics.skeleton(Phonetics.key(tok))
                if (sk.length < 2) continue
                var dist = EditDistance.levenshtein(target, sk, best - 1)
                if (sk.length > target.length) {
                    val prefixDist = EditDistance.levenshtein(target, sk.substring(0, target.length), best - 1)
                    if (prefixDist < dist) dist = prefixDist
                }
                if (dist < best) best = dist
            }
        }

        when (scope) {
            SearchScope.ENGLISH -> scan(d.litEn)
            SearchScope.ARABIC -> scan(d.litAr)
            SearchScope.INGREDIENT -> scan(d.litSci)
            SearchScope.ALL -> {
                scan(d.litEn)
                scan(d.litAr)
                scan(d.litSci)
            }
        }
        return if (best <= maxD) best else -1
    }

    companion object {
        const val MIN_QUERY_LENGTH = 2
        private const val FUZZY_TRIGGER = 10
        private const val FUZZY_BASE = 20
        private const val MAX_FUZZY_TOKENS = 4
        private const val MAX_MISSING_LETTERS = 4
    }
}
