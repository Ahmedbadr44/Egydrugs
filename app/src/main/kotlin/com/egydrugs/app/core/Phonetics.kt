package com.egydrugs.app.core

/**
 * Text normalisation used for searching, for both Arabic and English input.
 *
 * Three levels are used (loosest last):
 *  1. [literal]  - lower-cased, diacritics removed, Arabic letter variants unified (alef/ya/ta marbuta...).
 *  2. [key]      - a phonetic key shared by Arabic and Latin text (p~b, v~f, c/k/q~k, z/s/th~s, ph~f, ...),
 *                  vowels collapsed to a/i/u. "PANADOL" and "بانادول" both become "banadul".
 *  3. [skeleton] - the phonetic key without vowels. Tolerates vowel spelling differences
 *                  (bnadol / panadol / بنادول).
 */
object Phonetics {

    private const val DROP = '\u0000'

    private fun lower(c: Char): Char = if (c in 'A'..'Z') c + 32 else c

    /** Literal-level normalisation of one character: [DROP], a space (separator) or the normalised char. */
    private fun literalChar(ch: Char): Char {
        return when (ch) {
            in 'a'..'z', in '0'..'9' -> ch
            in 'A'..'Z' -> ch + 32
            in '٠'..'٩' -> '0' + (ch - '٠') // Arabic-Indic digits
            in '۰'..'۹' -> '0' + (ch - '۰') // Persian digits
            in 'ً'..'ٟ', 'ٰ', 'ـ' -> DROP // tashkeel, dagger alef, tatweel
            'أ', 'إ', 'آ', 'ٱ' -> 'ا' // hamzated alef forms -> alef
            'ى' -> 'ي' // alef maqsura -> ya
            'ة' -> 'ه' // ta marbuta -> ha
            'ؤ' -> 'و' // hamza on waw -> waw
            'ئ' -> 'ي' // hamza on ya -> ya
            'ء' -> DROP // lone hamza
            in 'ء'..'ۿ' -> if (ch.isLetter()) ch else ' '
            else -> ' '
        }
    }

    /** Lower-cased, diacritic-free text where every non-letter/digit run is a single space. */
    fun literal(text: String): String {
        val sb = StringBuilder(text.length)
        for (ch in text) {
            val c = literalChar(ch)
            if (c == DROP) continue
            if (c == ' ') {
                if (sb.isNotEmpty() && sb[sb.length - 1] != ' ') sb.append(' ')
            } else {
                sb.append(c)
            }
        }
        if (sb.isNotEmpty() && sb[sb.length - 1] == ' ') sb.setLength(sb.length - 1)
        return sb.toString()
    }

    /** Phonetic symbol for an Arabic letter: a consonant symbol, a vowel (a/i/u), [DROP] or ' '. */
    private fun arabicKey(ch: Char): Char {
        return when (ch) {
            'ا', 'أ', 'إ', 'آ', 'ٱ', 'ء', 'ع', 'ة' -> 'a' // ا أ إ آ ٱ ء ع ة
            'ى', 'ي', 'ئ' -> 'i' // ى ي ئ
            'و', 'ؤ' -> 'u' // و ؤ
            'ب', 'پ' -> 'b' // ب پ
            'ت', 'ط' -> 't' // ت ط
            'ث', 'س', 'ص', 'ز', 'ذ', 'ظ' -> 's' // ث س ص ز ذ ظ
            'ج', 'غ', 'گ' -> 'g' // ج غ گ
            'ح', 'ه' -> 'h' // ح ه
            'خ', 'ك', 'ق', 'ک' -> 'k' // خ ك ق ک
            'د', 'ض' -> 'd' // د ض
            'ر' -> 'r' // ر
            'ش', 'چ' -> 'x' // ش چ
            'ف', 'ڤ' -> 'f' // ف ڤ
            'ل' -> 'l' // ل
            'م' -> 'm' // م
            'ن' -> 'n' // ن
            in 'ً'..'ٟ', 'ٰ', 'ـ' -> DROP
            in '٠'..'٩' -> '0' + (ch - '٠')
            in '۰'..'۹' -> '0' + (ch - '۰')
            else -> ' '
        }
    }

    /** Phonetic key of Arabic and/or Latin text (see class documentation). */
    fun key(text: String): String {
        val sb = StringBuilder(text.length)

        fun emit(c: Char) {
            if (c == ' ') {
                if (sb.isNotEmpty() && sb[sb.length - 1] != ' ') sb.append(' ')
            } else if (sb.isEmpty() || sb[sb.length - 1] != c) {
                sb.append(c)
            }
        }

        var i = 0
        while (i < text.length) {
            val c = lower(text[i])
            val n1 = if (i + 1 < text.length) lower(text[i + 1]) else ' '
            if (c in 'a'..'z') {
                when (c) {
                    'p' -> if (n1 == 'h') { emit('f'); i++ } else emit('b')
                    'c' -> {
                        if (n1 == 'h') {
                            val n2 = if (i + 2 < text.length) lower(text[i + 2]) else ' '
                            emit(if (n2 == 'l' || n2 == 'r' || n2 == 'o') 'k' else 'x')
                            i++
                        } else if (n1 == 'k') {
                            emit('k')
                            i++
                        } else if (n1 == 'e' || n1 == 'i' || n1 == 'y') {
                            emit('s')
                        } else {
                            emit('k')
                        }
                    }
                    's' -> if (n1 == 'h') { emit('x'); i++ } else emit('s')
                    'k' -> if (n1 == 'h') { emit('k'); i++ } else emit('k')
                    'g' -> if (n1 == 'h') { emit('g'); i++ } else emit('g')
                    't' -> if (n1 == 'h') { emit('t'); i++ } else emit('t')
                    'd' -> if (n1 == 'h') { emit('d'); i++ } else emit('d')
                    'q' -> emit('k')
                    'x' -> { emit('k'); emit('s') }
                    'z' -> emit('s')
                    'j' -> emit('g')
                    'v' -> emit('f')
                    'w' -> emit('u')
                    'y' -> emit('i')
                    'e' -> emit('i')
                    'o' -> emit('u')
                    else -> emit(c) // a b f h i l m n r u
                }
            } else if (c in '0'..'9') {
                emit(c)
            } else if (c in '؀'..'ۿ') {
                val m = arabicKey(c)
                if (m != DROP) emit(m)
            } else {
                emit(' ')
            }
            i++
        }
        if (sb.isNotEmpty() && sb[sb.length - 1] == ' ') sb.setLength(sb.length - 1)
        return sb.toString()
    }

    /** Phonetic key without vowels and without spaces. */
    fun skeleton(pk: String): String {
        val sb = StringBuilder(pk.length)
        for (c in pk) {
            if (c != 'a' && c != 'i' && c != 'u' && c != ' ') sb.append(c)
        }
        return sb.toString()
    }
}
