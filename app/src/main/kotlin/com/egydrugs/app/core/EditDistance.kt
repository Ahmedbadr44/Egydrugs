package com.egydrugs.app.core

object EditDistance {

    /** Levenshtein distance, giving up early: returns max + 1 when the distance is larger than [max]. */
    fun levenshtein(a: String, b: String, max: Int): Int {
        if (Math.abs(a.length - b.length) > max) return max + 1
        var prev = IntArray(b.length + 1) { it }
        var cur = IntArray(b.length + 1)
        for (i in 1..a.length) {
            cur[0] = i
            var rowMin = cur[0]
            for (j in 1..b.length) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                val v = minOf(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
                cur[j] = v
                if (v < rowMin) rowMin = v
            }
            if (rowMin > max) return max + 1
            val t = prev
            prev = cur
            cur = t
        }
        return prev[b.length]
    }
}
