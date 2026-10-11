import test from "node:test";
import assert from "node:assert/strict";
import { buildIndex, search } from "./drugSearch";

const medicines = [
  { id: 1, nameEn: "Panadol", nameAr: "بنادول", ingredient: "Paracetamol" },
  { id: 2, nameEn: "Panadol Extra", nameAr: "بنادول إكسترا", ingredient: "Paracetamol + Caffeine" },
  { id: 3, nameEn: "Augmentin 1g", nameAr: "أوجمنتين 1 جم", ingredient: "Amoxicillin + Clavulanic acid" },
  { id: 4, nameEn: "Agarstin 20 mg", nameAr: "أجارستين", ingredient: "Bilastine" },
  { id: 5, nameEn: "Amoxicillin + Clavulanic Acid", nameAr: "أموكسيسيلين + حمض كلافولانيك", ingredient: "Amoxicillin + Clavulanic acid" },
  { id: 6, nameEn: "Ibuprofen", nameAr: "ايبوبروفين", ingredient: "Ibuprofen" },
  { id: 7, nameEn: "", nameAr: "بنادول محلي", ingredient: "Paracetamol" },
  { id: 8, nameEn: "Vitamin C", nameAr: "فيتامين ج", ingredient: "Ascorbic acid" },
];

const index = buildIndex(medicines);
const ids = (query: string, by: "brand" | "ingredient" = "brand", limit = 200) =>
  search(index, query, { by, limit }).hits.map((hit) => hit.item.id);

test("blank and whitespace-only queries return no results", () => {
  assert.deepEqual(ids(""), []);
  assert.deepEqual(ids("   \t "), []);
  assert.equal(search(index, "   ").lang, null);
});

test("English brand search is case-insensitive and ranks exact names first", () => {
  const result = search(index, "pAnAdOl", { by: "brand" });
  assert.deepEqual(result.hits.slice(0, 2).map((hit) => hit.item.id), [1, 2]);
  assert.equal(result.hits[0].tier, "exact");
  assert.equal(result.hits[1].tier, "prefix");
});

test("Arabic brand search strips tashkeel and searches the Arabic name field", () => {
  assert.deepEqual(ids("بَنَادُول"), [1, 7]);
});

test("brand search tolerates common English p/b pronunciation variation", () => {
  assert.ok(ids("banadol").includes(1));
});

test("brand search finds a name when one typed letter is missing", () => {
  assert.ok(ids("agmentin").includes(3));
});

test("spaces typed between fragments act as a wildcard gap", () => {
  assert.ok(ids("ag stin").includes(4));
});

test("multi-word query finds terms in order across a longer brand name", () => {
  assert.ok(ids("amox clav").includes(5));
});

test("English active-ingredient search uses the ingredient field, not brand names", () => {
  const result = search(index, "paracetamol", { by: "ingredient" });
  assert.deepEqual(result.hits.map((hit) => hit.item.id), [1, 2, 7]);
  assert.deepEqual(ids("paracetamol", "brand"), []);
});

test("Arabic active-ingredient query returns the explicit English-only notice", () => {
  const result = search(index, "باراسيتامول", { by: "ingredient" });
  assert.equal(result.notice, "ingredient-english-only");
  assert.deepEqual(result.hits, []);
});

test("Arabic alef/hamza variants normalize to the same search key", () => {
  assert.ok(ids("إيبوبروفين").includes(6));
});

test("brand searches do not fall back to the active-ingredient field", () => {
  assert.equal(ids("ascorbic", "brand").length, 0);
  assert.ok(ids("ascorbic", "ingredient").includes(8));
});

test("result limit is respected", () => {
  assert.equal(search(index, "بنادول", { by: "brand", limit: 1 }).hits.length, 1);
});
