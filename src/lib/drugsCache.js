import { supabase } from "./supabase";

export const DATABASE_NAME = "egymeds-cache.db";
const PAGE_SIZE = 1000;
const FULL_RECONCILE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const SYNC_OVERLAP_MS = 30 * 1000;

const REMOTE_COLUMNS =
  "id,commercial_name_en,commercial_name_ar,scientific_name,manufacturer,use,description,price_egp,price_old_egp,price_updated_at,product_type,updated_at";

export async function initializeDrugsDatabase(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS drugs_cache (
      id INTEGER PRIMARY KEY NOT NULL,
      commercial_name_en TEXT NOT NULL DEFAULT '',
      commercial_name_ar TEXT NOT NULL DEFAULT '',
      scientific_name TEXT NOT NULL DEFAULT '',
      manufacturer TEXT NOT NULL DEFAULT '',
      drug_use TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      price_egp REAL,
      price_old_egp REAL,
      price_updated_at TEXT,
      product_type TEXT NOT NULL DEFAULT '',
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS cache_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

function toMedicine(row) {
  return {
    id: Number(row.id),
    nameEn: row.commercial_name_en || "",
    nameAr: row.commercial_name_ar || "",
    price: row.price_egp ?? null,
    ingredient: row.scientific_name || "",
    manufacturer: row.manufacturer || "",
    description: row.description || "",
    use: row.drug_use || "",
    productType: row.product_type || "",
    oldPrice: row.price_old_egp ?? null,
    priceUpdatedAt: row.price_updated_at || null,
  };
}

async function getMeta(db, key) {
  const row = await db.getFirstAsync(
    "SELECT value FROM cache_meta WHERE key = ?",
    key
  );
  return row?.value ?? null;
}

async function setMeta(db, key, value) {
  await db.runAsync(
    "INSERT INTO cache_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value
  );
}

async function readCachedDrugsWithDb(db) {
  const rows = await db.getAllAsync(`
    SELECT id, commercial_name_en, commercial_name_ar, scientific_name,
           manufacturer, drug_use, description, price_egp, price_old_egp,
           price_updated_at, product_type
    FROM drugs_cache
    ORDER BY id ASC
  `);
  return rows.map(toMedicine);
}

export async function getCachedDrugs(db) {
  return readCachedDrugsWithDb(db);
}

async function fetchRemoteRows({ fullSync, since }) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let request = supabase
      .from("drugs")
      .select(REMOTE_COLUMNS);

    if (!fullSync && since) {
      request = request.gte("updated_at", since);
      request = request.order("updated_at", { ascending: true });
      request = request.order("id", { ascending: true });
    } else {
      request = request.order("id", { ascending: true });
    }

    const { data, error } = await request.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function saveRemoteRows(db, rows, { replaceAll, syncStartedAt }) {
  await db.withTransactionAsync(async () => {
    if (replaceAll) {
      await db.runAsync("DELETE FROM drugs_cache");
    }

    const statement = await db.prepareAsync(`
      INSERT INTO drugs_cache (
        id, commercial_name_en, commercial_name_ar, scientific_name,
        manufacturer, drug_use, description, price_egp, price_old_egp,
        price_updated_at, product_type, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        commercial_name_en = excluded.commercial_name_en,
        commercial_name_ar = excluded.commercial_name_ar,
        scientific_name = excluded.scientific_name,
        manufacturer = excluded.manufacturer,
        drug_use = excluded.drug_use,
        description = excluded.description,
        price_egp = excluded.price_egp,
        price_old_egp = excluded.price_old_egp,
        price_updated_at = excluded.price_updated_at,
        product_type = excluded.product_type,
        updated_at = excluded.updated_at
    `);

    try {
      for (const row of rows) {
        await statement.executeAsync(
          Number(row.id),
          row.commercial_name_en || "",
          row.commercial_name_ar || "",
          row.scientific_name || "",
          row.manufacturer || "",
          row.use || "",
          row.description || "",
          row.price_egp == null ? null : Number(row.price_egp),
          row.price_old_egp == null ? null : Number(row.price_old_egp),
          row.price_updated_at || null,
          row.product_type || "",
          row.updated_at || null
        );
      }
    } finally {
      await statement.finalizeAsync();
    }

    // Store the beginning of the sync, not its completion time. This ensures
    // updates made while a sync is running are picked up by the next sync.
    await setMeta(db, "last_sync_at", syncStartedAt);
    if (replaceAll) {
      await setMeta(db, "last_full_sync_at", syncStartedAt);
    }
  });
}

export async function syncDrugs(db, onProgress) {
  const [countRow, lastSyncAt, lastFullSyncAt] = await Promise.all([
    db.getFirstAsync("SELECT COUNT(*) AS count FROM drugs_cache"),
    getMeta(db, "last_sync_at"),
    getMeta(db, "last_full_sync_at"),
  ]);

  const cachedCount = Number(countRow?.count || 0);
  const lastFullSyncTime = lastFullSyncAt ? Date.parse(lastFullSyncAt) : 0;
  const fullSync =
    cachedCount === 0 ||
    !lastSyncAt ||
    !lastFullSyncAt ||
    Date.now() - lastFullSyncTime >= FULL_RECONCILE_INTERVAL_MS;

  const syncStartedAt = new Date().toISOString();
  let since = null;

  if (!fullSync && lastSyncAt) {
    const lastSyncTime = Date.parse(lastSyncAt);
    since = new Date(
      Math.max(0, lastSyncTime - SYNC_OVERLAP_MS)
    ).toISOString();
  }

  // On the first full download (or if it was interrupted), save each page
  // before downloading the next one. This keeps partial progress on-device.
  // Weekly reconciliation still uses an all-at-once replacement so an
  // interrupted refresh cannot wipe the existing working cache.
  const bootstrapSync = fullSync && !lastFullSyncAt;
  if (bootstrapSync) {
    const accumulatedRows = [];
    const { count: remoteTotal, error: countError } = await supabase
      .from("drugs")
      .select("id", { count: "exact", head: true });

    if (countError) throw countError;

    onProgress?.({
      loaded: 0,
      total: Number(remoteTotal || 0),
      initial: true,
      complete: false,
    });

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("drugs")
        .select(REMOTE_COLUMNS)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      const page = data || [];
      if (page.length === 0) break;

      await saveRemoteRows(db, page, {
        replaceAll: false,
        syncStartedAt,
      });

      accumulatedRows.push(...page);
      onProgress?.({
        loaded: accumulatedRows.length,
        total: Number(remoteTotal || 0),
        initial: true,
        complete: false,
      });

      if (page.length < PAGE_SIZE) break;
    }

    await setMeta(db, "last_sync_at", syncStartedAt);
    await setMeta(db, "last_full_sync_at", syncStartedAt);

    const drugs = await readCachedDrugsWithDb(db);
    onProgress?.({
      drugs,
      loaded: drugs.length,
      total: Number(remoteTotal || drugs.length),
      initial: true,
      complete: true,
    });
    return { drugs, syncedRows: drugs.length, fullSync: true };
  }

  const rows = await fetchRemoteRows({ fullSync, since });
  await saveRemoteRows(db, rows, {
    replaceAll: fullSync,
    syncStartedAt,
  });
  const drugs = await readCachedDrugsWithDb(db);
  onProgress?.({
    drugs,
    loaded: rows.length,
    total: rows.length,
    initial: false,
    complete: true,
  });

  return {
    drugs,
    syncedRows: rows.length,
    fullSync,
  };
}
