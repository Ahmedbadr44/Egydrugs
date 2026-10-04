package com.egydrugs.app.core

data class AlternativeGroup(
    /** Pretty name of the active ingredient(s) of this group. */
    val ingredient: String,
    /** Brands containing it, most expensive first. */
    val drugs: List<Drug>
)

data class AlternativesResult(
    /** Therapeutic class actually used, e.g. "ANTIBIOTIC › QUINOLONE". Empty when the class is unknown. */
    val classLabel: String,
    val groups: List<AlternativeGroup>,
    /** Number of ingredient groups found (can be larger than groups.size, which is capped). */
    val totalGroups: Int
)

/** All drugs plus the lookup tables used for searching, equivalents and alternatives. */
class DrugIndex private constructor(val items: List<IndexedDrug>, @Suppress("UNUSED_PARAMETER") precomputed: Boolean) {

    constructor(drugs: List<Drug>) : this(drugs.map { build(it) }, true)

    private val byIngredient: Map<String, List<Int>>
    private val byClass: Map<String, List<Int>>
    private val engine = SearchEngine(items)

    init {
        val ing = HashMap<String, MutableList<Int>>()
        val cls = HashMap<String, MutableList<Int>>()
        for ((i, item) in items.withIndex()) {
            if (item.ingKey.isNotEmpty()) ing.getOrPut(item.ingKey) { ArrayList() }.add(i)
            for (depth in 1..item.classPath.size) {
                val key = item.classPath.take(depth).joinToString(".")
                cls.getOrPut(key) { ArrayList() }.add(i)
            }
        }
        byIngredient = ing
        byClass = cls
    }

    val size: Int get() = items.size

    fun drug(id: Int): Drug = items[id].drug

    fun search(query: String, scope: SearchScope, limit: Int = 200): List<Drug> =
        engine.search(query, scope, limit)

    /** True when the drug has a strength in its name, so a "same strength" filter makes sense. */
    fun hasStrength(id: Int): Boolean = items[id].strength.isNotEmpty()

    fun hasKnownRoute(id: Int): Boolean = isKnownRoute(items[id].drug.route)

    /**
     * "المثائل": other brands with the same active ingredient(s).
     * Most expensive first; drugs without a price go last.
     */
    fun equivalents(id: Int, sameRoute: Boolean, sameStrength: Boolean): List<Drug> {
        val me = items[id]
        if (me.ingKey.isEmpty()) return emptyList()
        val members = byIngredient[me.ingKey] ?: return emptyList()
        val out = ArrayList<Drug>()
        for (idx in members) {
            if (idx == id) continue
            val other = items[idx]
            if (sameRoute && !routeMatches(me, other)) continue
            if (sameStrength && me.strength.isNotEmpty() && other.strength != me.strength) continue
            out.add(other.drug)
        }
        out.sortWith(PRICE_DESCENDING_ORDER)
        return out
    }

    /**
     * "البدائل": drugs with the same therapeutic use (same drug class) but a different active ingredient,
     * grouped by ingredient. If the exact class has fewer than [minGroups] ingredients, the broader parent
     * class is used (e.g. "ANTIBIOTIC.QUINOLONE" -> "ANTIBIOTIC").
     */
    fun alternatives(
        id: Int,
        sameRoute: Boolean,
        minGroups: Int = 5,
        maxGroups: Int = 60
    ): AlternativesResult {
        val me = items[id]
        if (me.classPath.isEmpty()) return AlternativesResult("", emptyList(), 0)

        var result = AlternativesResult("", emptyList(), 0)
        var depth = me.classPath.size
        while (depth >= 1) {
            val key = me.classPath.take(depth).joinToString(".")
            val members = byClass[key] ?: emptyList<Int>()
            val groups = LinkedHashMap<String, MutableList<Drug>>()
            for (idx in members) {
                val other = items[idx]
                if (idx == id || other.ingKey.isEmpty() || other.ingKey == me.ingKey) continue
                if (sameRoute && !routeMatches(me, other)) continue
                groups.getOrPut(other.ingKey) { mutableListOf() }.add(other.drug)
            }
            val list = ArrayList<AlternativeGroup>(groups.size)
            for ((ingKey, drugsOfGroup) in groups) {
                drugsOfGroup.sortWith(PRICE_DESCENDING_ORDER)
                list.add(AlternativeGroup(Ingredients.pretty(ingKey), drugsOfGroup))
            }
            list.sortWith { a, b ->
                val sizeCompare = b.drugs.size.compareTo(a.drugs.size)
                if (sizeCompare != 0) sizeCompare else a.ingredient.compareTo(b.ingredient)
            }
            result = AlternativesResult(
                classLabel = me.classPath.take(depth).joinToString(" › "),
                groups = list.take(maxGroups),
                totalGroups = list.size
            )
            if (list.size >= minGroups) break
            depth--
        }
        return result
    }

    companion object {
        internal fun fromPrecomputed(items: List<IndexedDrug>): DrugIndex = DrugIndex(items, true)

        private val PRICE_DESCENDING_ORDER: Comparator<Drug> = Comparator { a, b ->
            val pa = a.price
            val pb = b.price
            when {
                pa == null && pb == null -> a.nameEn.compareTo(b.nameEn)
                pa == null -> 1
                pb == null -> -1
                pa != pb -> pb.compareTo(pa)
                else -> a.nameEn.compareTo(b.nameEn)
            }
        }

        fun isKnownRoute(route: String): Boolean =
            route.isNotBlank() && !route.equals("UNKNOWN", ignoreCase = true)

        private fun routeMatches(a: IndexedDrug, b: IndexedDrug): Boolean {
            if (!isKnownRoute(a.drug.route)) return true
            return a.drug.route.equals(b.drug.route, ignoreCase = true)
        }

        /** Normalised class path: "ANTIBIOTIC.QUINOLONE" -> ["ANTIBIOTIC", "QUINOLONE"]; plural endings removed. */
        fun classPath(raw: String): List<String> {
            val up = raw.uppercase().trim()
            if (up.isEmpty()) return emptyList()
            val out = ArrayList<String>()
            for (seg in up.split('.')) {
                val s = seg.trim().replace(Regex("\\s+"), " ")
                if (s.isEmpty()) continue
                val singular = if (s.length > 4 && s.endsWith("S") && !s.endsWith("SS")) s.dropLast(1) else s
                out.add(singular)
            }
            return out
        }

        private fun build(d: Drug): IndexedDrug {
            val litEn = Phonetics.literal(d.nameEn)
            val litAr = Phonetics.literal(d.nameAr)
            val litSci = Phonetics.literal(d.scientific)
            val pkEn = Phonetics.key(litEn)
            val pkAr = Phonetics.key(litAr)
            val pkSci = Phonetics.key(litSci)
            return IndexedDrug(
                drug = d,
                litEn = litEn,
                litAr = litAr,
                litSci = litSci,
                pkEn = pkEn,
                pkSci = pkSci,
                skEn = Phonetics.skeleton(pkEn),
                skAr = Phonetics.skeleton(pkAr),
                skSci = Phonetics.skeleton(pkSci),
                ingKey = Ingredients.key(d.scientific),
                classPath = classPath(d.drugClass),
                strength = Strength.of(d.nameEn)
            )
        }
    }
}
