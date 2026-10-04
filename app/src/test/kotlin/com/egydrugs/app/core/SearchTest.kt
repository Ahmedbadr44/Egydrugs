package com.egydrugs.app.core

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Test

class SearchTest {

    companion object {
        lateinit var index: DrugIndex

        @JvmStatic
        @BeforeClass
        fun load() {
            // Gradle runs unit tests with the module directory (app/) as working directory.
            val file = File("src/main/assets/egyptian-drugs.csv")
            index = DrugIndex(CsvParser.toDrugs(CsvParser.parse(file.readText())))
        }
    }

    private fun names(q: String, scope: SearchScope = SearchScope.BRAND): List<String> =
        index.search(q, scope).map { it.nameEn }

    @Test
    fun loadsAllRows() {
        assertTrue(index.size > 24000)
    }

    @Test
    fun arabicAndEnglishSpellingsGiveTheSameFirstResults() {
        val en = names("panadol").take(3)
        assertEquals(en, names("بانادول").take(3))
        assertTrue(en.all { it.startsWith("PANADOL") })
    }

    @Test
    fun phoneticSpellingFindsTheDrug() {
        assertTrue(names("agmentin").first().startsWith("AUGMENTIN"))
        assertTrue(names("زيترومكس").any { it.startsWith("ZITHROMAX") })
        assertTrue(names("ibuprofin", SearchScope.INGREDIENT).isNotEmpty())
    }

    @Test
    fun spaceStandsForMissingLetters() {
        assertTrue(names("par cetamol").first().startsWith("PARACETAMOL"))
        assertTrue(names("pa ado").first().startsWith("PANADOL"))
        assertTrue(names("بارا سيتامول").first().startsWith("PARACETAMOL"))
    }

    @Test
    fun leadingSpaceMeansUnknownStart() {
        assertTrue(names(" amol").take(20).any { it.contains("AMOL") })
    }

    @Test
    fun scopesAreRespected() {
        assertTrue(names("paracetamol", SearchScope.INGREDIENT).isNotEmpty())
        // A Latin spelling still finds the drug when only the Arabic name is searched (phonetic match).
        assertTrue(names("panadol", SearchScope.BRAND).take(5).any { it.startsWith("PANADOL") })
        // An Arabic spelling still finds the drug when only the English name is searched.
        assertTrue(names("بانادول", SearchScope.BRAND).first().startsWith("PANADOL"))
    }

    @Test
    fun equivalentsShareTheActiveIngredient() {
        val d = index.search("augmentin 1 gm", SearchScope.ENGLISH).first()
        val eq = index.equivalents(d.id, sameRoute = true, sameStrength = true)
        assertTrue(eq.isNotEmpty())
        val key = Ingredients.key(d.scientific)
        assertTrue(eq.all { Ingredients.key(it.scientific) == key && it.id != d.id })
        // Most expensive first.
        val prices = eq.mapNotNull { it.price }
        assertEquals(prices.sortedDescending(), prices)
    }

    @Test
    fun alternativesUseOtherIngredientsOfTheSameClass() {
        val d = index.search("brufen 400", SearchScope.ENGLISH).first()
        val alt = index.alternatives(d.id, sameRoute = true)
        assertTrue(alt.groups.isNotEmpty())
        val myKey = Ingredients.key(d.scientific)
        assertTrue(alt.groups.all { g -> g.drugs.all { Ingredients.key(it.scientific) != myKey } })
    }
}
