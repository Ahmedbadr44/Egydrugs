package com.egydrugs.app.core

import org.junit.Assert.assertEquals
import org.junit.Test

class PhoneticsTest {

    @Test
    fun arabicAndLatinShareTheSameKey() {
        assertEquals(Phonetics.key("PANADOL"), Phonetics.key("بانادول"))
        assertEquals(Phonetics.key("paracetamol"), Phonetics.key("باراسيتامول"))
        assertEquals(Phonetics.skeleton(Phonetics.key("Augmentin")), Phonetics.skeleton(Phonetics.key("أوجمنتين")))
    }

    @Test
    fun similarSoundingLettersAreMerged() {
        assertEquals(Phonetics.key("fenadol"), Phonetics.key("phenadol"))
        assertEquals(Phonetics.key("kataflam"), Phonetics.key("cataflam"))
        assertEquals(Phonetics.key("زيثروماكس"), Phonetics.key("سيثروماكس"))
        assertEquals(Phonetics.key("كتافلام"), Phonetics.key("قتافلام"))
    }

    @Test
    fun literalIgnoresDiacriticsAndLetterVariants() {
        assertEquals(Phonetics.literal("أَوجمنتين"), Phonetics.literal("اوجمنتين"))
        assertEquals(Phonetics.literal("PANADOL  EXTRA-24"), "panadol extra 24")
        assertEquals(Phonetics.literal("٥٠٠ مجم"), "500 مجم")
    }

    @Test
    fun ingredientKeysIgnoreSynonymsSaltsAndOrder() {
        assertEquals(Ingredients.key("PARACETAMOL(ACETAMINOPHEN)"), Ingredients.key("PARACETAMOL"))
        assertEquals(Ingredients.key("DICLOFENAC SODIUM"), Ingredients.key("DICLOFENAC POTASSIUM"))
        assertEquals(Ingredients.key("CAFFEINE+PARACETAMOL"), Ingredients.key("PARACETAMOL + CAFFEINE"))
        assertEquals("", Ingredients.key(""))
    }

    @Test
    fun strengthsAreNormalised() {
        assertEquals(Strength.of("AUGMENTIN 1 GM 14 TABS."), Strength.of("AUGMENTIN 1000 MG"))
        assertEquals(emptyList<String>(), Strength.of("1 2 3 (ONE TWO THREE) 20 F.C.TABS."))
    }
}
