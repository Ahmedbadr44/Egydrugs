import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const OPENFDA_URL = "https://api.fda.gov/drug/label.json";
const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 25;

type DrugRow = {
  id: number;
  commercial_name_en: string | null;
  commercial_name_ar: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  route: string | null;
  dosage: string | null;
};

type LabelRecord = {
  id?: string;
  set_id?: string;
  version?: string;
  effective_time?: string;
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    manufacturer_name?: string[];
    route?: string[];
    dosage_form?: string[];
    product_type?: string[];
    ndc?: string[];
  };
  indications_and_usage?: string[];
  purpose?: string[];
  uses?: string[];
  dosage_and_administration?: string[];
  adverse_reactions?: string[];
  warnings?: string[];
  boxed_warning?: string[];
  contraindications?: string[];
  warnings_and_cautions?: string[];
  dosage_forms_and_strengths?: string[];
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeSearchPhrase(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function genericCandidates(scientificName: string | null): string[] {
  const source = normalize(scientificName);
  if (!source) return [];

  const parts = source
    .split(/[+;,]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const withoutParenthetical = parts.map((part) => part.replace(/\([^)]*\)/g, "").trim());
  const candidates = [...parts, ...withoutParenthetical]
    .filter((value) => value.length >= 4)
    .map((value) => value.replace(/\s+/g, " ").trim());

  return [...new Set(candidates)];
}

function textArray(...values: (string[] | undefined)[]): string[] {
  const out: string[] = [];
  for (const group of values) {
    for (const value of group ?? []) {
      const cleaned = value.replace(/\s+/g, " ").trim();
      if (cleaned && !out.includes(cleaned)) out.push(cleaned);
    }
  }
  return out.slice(0, 12);
}

function scoreLabel(drug: DrugRow, label: LabelRecord): number {
  const drugBrand = normalize(drug.commercial_name_en);
  const drugGeneric = normalize(drug.scientific_name);
  const brandNames = (label.openfda?.brand_name ?? []).map(normalize);
  const genericNames = (label.openfda?.generic_name ?? []).map(normalize);
  const manufacturers = (label.openfda?.manufacturer_name ?? []).map(normalize);

  let score = 0;

  if (brandNames.some((brand) => brand && (brand === drugBrand || drugBrand.startsWith(brand) || brand.startsWith(drugBrand)))) {
    score += 0.55;
  }

  const drugGenericParts = genericCandidates(drug.scientific_name).map(normalize);
  const genericHits = drugGenericParts.filter((part) =>
    genericNames.some((generic) => generic.includes(part) || part.includes(generic))
  ).length;
  if (genericHits > 0) score += Math.min(0.35, 0.20 + genericHits * 0.05);

  const manufacturer = normalize(drug.manufacturer);
  if (manufacturer && manufacturers.some((item) => item.includes(manufacturer) || manufacturer.includes(item))) {
    score += 0.10;
  }

  return Math.min(1, score);
}

async function fdaSearch(query: string, limit = 10): Promise<LabelRecord[]> {
  const url = new URL(OPENFDA_URL);
  url.searchParams.set("search", query);
  url.searchParams.set("limit", String(Math.min(limit, 1000)));
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Egydrugs/1.0 openFDA enrichment",
    },
  });

  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`openFDA returned HTTP ${response.status}`);
  const body = await response.json();
  return Array.isArray(body.results) ? body.results : [];
}

async function findBestLabel(drug: DrugRow): Promise<{ label: LabelRecord | null; query: string | null; score: number }> {
  const queries: string[] = [];

  for (const generic of genericCandidates(drug.scientific_name).slice(0, 3)) {
    queries.push(`openfda.generic_name:"${escapeSearchPhrase(generic)}"`);
  }

  const brand = normalize(drug.commercial_name_en);
  if (brand.length >= 4) {
    queries.push(`openfda.brand_name:"${escapeSearchPhrase(brand)}"`);
  }

  let best: { label: LabelRecord | null; query: string | null; score: number } = {
    label: null,
    query: null,
    score: 0,
  };

  for (const query of queries) {
    const labels = await fdaSearch(query, 10);
    for (const label of labels) {
      const score = scoreLabel(drug, label);
      if (score > best.score) best = { label, query, score };
    }
    if (best.score >= 0.90) break;
  }

  return best;
}

function buildMedical(label: LabelRecord) {
  const uses = textArray(label.indications_and_usage, label.uses, label.purpose);
  const dosages = textArray(label.dosage_and_administration);
  const sideEffects = textArray(label.adverse_reactions);
  const warnings = textArray(label.boxed_warning, label.warnings, label.warnings_and_cautions, label.contraindications);
  return { uses, dosages, sideEffects, warnings };
}

async function main(req: Request) {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase server configuration is missing" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Missing authorization" }, 401);
  }

  const token = authHeader.slice("Bearer ".length);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Invalid authorization" }, 401);

  const { data: adminRow, error: adminError } = await adminClient
    .from("drug_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError) return json({ error: adminError.message }, 500);
  if (!adminRow) return json({ error: "Admin access required" }, 403);

  let requestedLimit = DEFAULT_BATCH_SIZE;
  try {
    const body = await req.json();
    if (Number.isFinite(body?.limit)) requestedLimit = Number(body.limit);
  } catch {
    // Empty body is allowed.
  }

  const batchSize = Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(requestedLimit)));

  const { data: queue, error: queueError } = await adminClient
    .from("drug_medical_sync")
    .select("id,drug_id,attempts")
    .eq("provider", "openFDA")
    .in("status", ["pending", "error", "needs_review"])
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: true })
    .limit(batchSize);

  if (queueError) return json({ error: queueError.message }, 500);

  const ids = (queue ?? []).map((item) => item.drug_id);
  if (!ids.length) {
    return json({ ok: true, processed: 0, message: "No queued records" });
  }

  const { data: drugs, error: drugsError } = await adminClient
    .from("drugs")
    .select("id,commercial_name_en,commercial_name_ar,scientific_name,manufacturer,route,dosage")
    .in("id", ids);

  if (drugsError) return json({ error: drugsError.message }, 500);

  const byId = new Map<number, DrugRow>((drugs ?? []).map((drug) => [drug.id, drug]));
  const summary = {
    ok: true,
    processed: 0,
    success: 0,
    no_match: 0,
    needs_review: 0,
    error: 0,
  };

  for (const item of queue ?? []) {
    const drug = byId.get(item.drug_id);
    if (!drug) continue;

    await adminClient
      .from("drug_medical_sync")
      .update({
        status: "running",
        attempts: Number(item.attempts ?? 0) + 1,
        last_error: null,
      })
      .eq("id", item.id);

    try {
      const best = await findBestLabel(drug);

      if (!best.label) {
        await adminClient
          .from("drug_medical_sync")
          .update({
            status: "no_match",
            query_used: best.query,
            matched_set_id: null,
            matched_version: null,
            matched_brand_name: null,
            matched_generic_name: null,
            matched_manufacturer: null,
            match_score: 0,
            last_error: null,
            fetched_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        summary.no_match++;
        summary.processed++;
        continue;
      }

      const confidence = Number(best.score.toFixed(3));
      const medical = buildMedical(best.label);
      const sourceUrl = best.label.set_id
        ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(best.label.set_id)}`
        : null;

      if (confidence >= 0.80 && (medical.uses.length || medical.dosages.length || medical.sideEffects.length || medical.warnings.length)) {
        const { error: upsertError } = await adminClient
          .from("drug_medical_info")
          .upsert({
            drug_id: drug.id,
            uses: medical.uses,
            dosages: medical.dosages,
            side_effects: medical.sideEffects,
            warnings: medical.warnings,
            source_url: sourceUrl,
            source_name: "openFDA / FDA labeling",
            confidence,
          }, { onConflict: "drug_id" });

        if (upsertError) throw upsertError;
      }

      const needsReview = confidence < 0.90 || !(medical.uses.length || medical.dosages.length || medical.sideEffects.length || medical.warnings.length);
      await adminClient
        .from("drug_medical_sync")
        .update({
          status: needsReview ? "needs_review" : "success",
          query_used: best.query,
          matched_set_id: best.label.set_id ?? null,
          matched_version: best.label.version ?? null,
          matched_brand_name: best.label.openfda?.brand_name?.[0] ?? null,
          matched_generic_name: best.label.openfda?.generic_name?.[0] ?? null,
          matched_manufacturer: best.label.openfda?.manufacturer_name?.[0] ?? null,
          match_score: confidence,
          last_error: null,
          fetched_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      needsReview ? summary.needs_review++ : summary.success++;
      summary.processed++;
    } catch (error) {
      await adminClient
        .from("drug_medical_sync")
        .update({
          status: "error",
          last_error: error instanceof Error ? error.message : String(error),
          fetched_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      summary.error++;
      summary.processed++;
    }
  }

  return json(summary);
}

Deno.serve(main);
