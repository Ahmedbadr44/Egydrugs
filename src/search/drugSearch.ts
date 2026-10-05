/**
 * drugSearch.ts — pure TypeScript drug search engine (no dependencies, works in React Native / Hermes).
 *
 * Search options
 *   "brand"       language auto-detected from the query:
 *                   English query -> English brand name only
 *                   Arabic  query -> Arabic  brand name only      (never mixed)
 *   "ingredient"  English only, active-ingredient field only
 *
 * Missing letters
 *   • SPACE typed by the user = a gap of ONE OR MORE unknown letters   "ag stin"  -> AGARSTIN
 *   • automatic              = one forgotten letter anywhere           "agarstn"  -> AGARSTIN
 *
 * Similar pronunciation (English): p/b  f/ph/v  c/k/q  z/s  j/g  + doubled letters
 * Arabic: ك/ق  س/ص/ث/ز/ذ/ظ  ت/ط  د/ض  ب/پ  ف/ڤ  ج/گ  + all alef/hamza forms, ة/ه, ى/ي, tashkeel, tatweel
 *
 * Every name is converted ONCE into a phonetic key (see buildIndex). The query goes through
 * the same conversion, so fuzzy matching becomes plain regex matching on keys.
 */

export type SearchBy = "brand" | "ingredient";
export type Lang = "ar" | "en";

export interface Medicine {
  id: string | number;
  nameEn: string;
  nameAr: string;
  price?: number | string | null;
  /** English scientific name(s), e.g. "Amoxicillin + Clavulanic acid". Optional. */
  ingredient?: string;
}

export interface IndexedMedicine {
  item: Medicine;
  kEn: string;
  kAr: string;
  kIng: string;
}

export type Tier = "exact" | "prefix" | "word-start" | "missing-letter" | "inside-word" | "joined-words";

export interface Hit<T extends Medicine = Medicine> {
  item: T;
  tier: Tier;
  /** [tier, position, nameLength] — lower is better */
  score: [number, number, number];
}

export interface SearchResult<T extends Medicine = Medicine> {
  lang: Lang | null;
  notice: "ingredient-english-only" | null;
  hits: Hit<T>[];
}

/* ------------------------------------------------------------------ */
/* 1. Phonetic keys                                                    */
/* ------------------------------------------------------------------ */

const EN_MAP: Record<string, string> = { p: "b", v: "f", c: "k", q: "k", z: "s", j: "g" };

const AR_MAP: Record<string, string> = {
  أ: "ا", إ: "ا", آ: "ا", ٱ: "ا",
  ى: "ي", ئ: "ي",
  ؤ: "و",
  ة: "ه",
  ء: "",
  پ: "ب",
  ڤ: "ف", ڥ: "ف",
  گ: "ج", ڨ: "ج", ݣ: "ج",
  ق: "ك", ڧ: "ك", ک: "ك",
  ص: "س", ث: "س", ز: "س", ذ: "س", ظ: "س", ژ: "س",
  ط: "ت",
  ض: "د",
};

const AR_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
const ARABIC_LETTER = /[؀-ۿݐ-ݿ]/g;
const LATIN_LETTER = /[A-Za-z]/g;
const NON_WORD_EN = /[^a-z0-9]+/g;
const NON_WORD_AR = /[^ء-يٮ-ۓۺ-ۿ0-9]+/g;
const REPEATS = /(.)\1+/g;

export function detectLang(text: string): Lang {
  const ar = (text.match(ARABIC_LETTER) || []).length;
  const en = (text.match(LATIN_LETTER) || []).length;
  return ar > en ? "ar" : "en";
}

function words(s: string): string[] {
  return s.split(" ").filter(Boolean);
}

export function keyEn(text: string): string[] {
  const t = text
    .toLowerCase()
    .replace(/ph/g, "f")
    .replace(/[pvcqzj]/g, (c) => EN_MAP[c])
    .replace(NON_WORD_EN, " ");
  return words(t).map((w) => w.replace(REPEATS, "$1"));
}

export function keyAr(text: string): string[] {
  let t = text.replace(AR_DIACRITICS, "");
  let out = "";
  for (const ch of t) {
    const d = AR_DIGITS.indexOf(ch);
    if (d >= 0) {
      out += String(d % 10);
    } else {
      out += ch in AR_MAP ? AR_MAP[ch] : ch;
    }
  }
  out = out.replace(NON_WORD_AR, " ");
  return words(out).map((w) => w.replace(REPEATS, "$1"));
}

export function makeKey(text: string, lang: Lang): string[] {
  return lang === "ar" ? keyAr(text) : keyEn(text);
}

/* ------------------------------------------------------------------ */
/* 2. Wildcards: typed space = 1+ letters, automatic missing letter     */
/* ------------------------------------------------------------------ */

/** Split the query on spaces; each space becomes a GAP. Leading/trailing spaces are ignored. */
export function querySegments(query: string, lang: Lang): string[] {
  const segs: string[] = [];
  for (const raw of query.trim().split(/\s+/)) {
    if (!raw) continue;
    const w = makeKey(raw, lang);
    if (w.length) segs.push(w.join(" "));
  }
  return segs;
}

function escapeRx(c: string): string {
  return c.replace(/[.*+?^\${}()|[\]\\\/\-]/g, "\\$&");
}

const ONE_LETTER = "[^ ]";
const GAP = ".+";

function segRx(seg: string, extraAt: number | null = null): string {
  let out = "";
  const chars = Array.from(seg);
  for (let i = 0; i < chars.length; i++) {
    if (extraAt === i) out += ONE_LETTER;
    out += escapeRx(chars[i]);
  }
  if (extraAt === chars.length) out += ONE_LETTER;
  return out;
}

/** regex strings with ONE extra unknown letter inserted at every position of every segment */
export function autoVariants(segs: string[], minWildLen = 3): string[] {
  const out: string[] = [];
  segs.forEach((seg, si) => {
    const n = Array.from(seg).length;
    if (n < minWildLen) return;
    for (let p = 0; p <= n; p++) {
      out.push(segs.map((g, gi) => segRx(g, gi === si ? p : null)).join(GAP));
    }
  });
  return out;
}

/**
 * SQL LIKE patterns, for when the list is big and lives in SQLite (expo-sqlite / op-sqlite).
 * Store the key column as ' word1 word2 ' (see indexKey). SQL may return a superset
 * (its wildcards can cross word borders); run search on those rows to filter + rank.
 */
export function likePatterns(segs: string[], minWildLen = 3) {
  const core = segs.join("_%");
  const out: Record<string, string[]> = {
    exact: [` ${core} `],
    prefix: [` ${core}%`],
    wordstart: [`% ${core}%`],
    inside: [`%${core}%`],
  };

  const v: string[] = [];
  segs.forEach((seg, si) => {
    const chars = Array.from(seg);
    if (chars.length < minWildLen) return;
    for (let p = 0; p <= chars.length; p++) {
      const parts = segs.map((g, gi) =>
        gi === si ? chars.slice(0, p).join("") + "_" + chars.slice(p).join("") : g
      );
      v.push("% " + parts.join("_%") + "%");
    }
  });
  if (v.length) out.missing_letter = v;
  return out;
}

/* ------------------------------------------------------------------ */
/* 3. Index + search                                                   */
/* ------------------------------------------------------------------ */

const EXACT = 0, PREFIX = 1, WORDSTART = 2, MISSING = 3, INSIDE = 4, GLUED = 5;
const TIER_NAME: Tier[] = ["exact", "prefix", "word-start", "missing-letter", "inside-word", "joined-words"];

/** The key stored for a name, padded with spaces for SQL LIKE use. */
export function indexKey(text: string, lang: Lang): string {
  return " " + makeKey(text, lang).join(" ") + " ";
}

/** Run once (e.g. in a useMemo) — precomputes the phonetic keys. */
export function buildIndex<T extends Medicine>(items: T[]): (IndexedMedicine & { item: T })[] {
  return items.map((item) => ({
    item,
    kEn: keyEn(item.nameEn || "").join(" "),
    kAr: keyAr(item.nameAr || "").join(" "),
    kIng: keyEn(item.ingredient || "").join(" "),
  }));
}

export interface SearchOptions {
  by?: SearchBy;
  limit?: number;
  minWildLen?: number;
}

export function search<T extends Medicine>(
  index: (IndexedMedicine & { item: T })[],
  query: string,
  { by = "brand", limit = 20, minWildLen = 3 }: SearchOptions = {}
): SearchResult<T> {
  query = (query || "").trim();
  if (!query) return { lang: null, notice: null, hits: [] };

  const lang = detectLang(query);
  let field: "kEn" | "kAr" | "kIng";
  if (by === "ingredient") {
    if (lang === "ar") return { lang, notice: "ingredient-english-only", hits: [] };
    field = "kIng";
  } else {
    field = lang === "ar" ? "kAr" : "kEn";
  }

  const segs = querySegments(query, lang);
  if (!segs.length) return { lang, notice: null, hits: [] };

  const core = segs.map((g) => segRx(g)).join(GAP);
  const rxFull = new RegExp(`^(?:${core})$`);
  const rxStart = new RegExp(`^(?:${core})`);
  const rxWord = new RegExp(`(?:^| )(?:${core})`);
  const rxAny = new RegExp(core);
  const vs = autoVariants(segs, minWildLen);
  const rxMiss = vs.length ? new RegExp(`(?:^| )(?:${vs.join("|")})`) : null;

  const hits: Hit<T>[] = [];
  for (const row of index) {
    const s = row[field];
    if (!s) continue;
    let tier: number, pos = 0;
    let m: RegExpExecArray | null;
    if (rxFull.test(s)) {
      tier = EXACT;
    } else if (rxStart.test(s)) {
      tier = PREFIX;
    } else if ((m = rxWord.exec(s))) {
      tier = WORDSTART;
      pos = m.index + (s[m.index] === " " ? 1 : 0);
    } else if (rxMiss && (m = rxMiss.exec(s))) {
      tier = MISSING;
      pos = m.index + (s[m.index] === " " ? 1 : 0);
    } else if ((m = rxAny.exec(s))) {
      tier = INSIDE;
      pos = m.index;
    } else if (s.indexOf(" ") >= 0 && rxStart.test(s.replace(/ /g, ""))) {
      tier = GLUED;
    } else {
      continue;
    }
    hits.push({ item: row.item, tier: TIER_NAME[tier], score: [tier, pos, s.length] });
  }

  hits.sort((a, b) => {
    for (let i = 0; i < 3; i++) if (a.score[i] !== b.score[i]) return a.score[i] - b.score[i];
    return a.item.nameEn < b.item.nameEn ? -1 : a.item.nameEn > b.item.nameEn ? 1 : 0;
  });

  return { lang, notice: null, hits: hits.slice(0, limit) };
}
