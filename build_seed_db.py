#!/usr/bin/env python3
"""Build the offline starter SQLite database bundled inside the EgyMeds app from Supabase.

Run on the developer machine before testing or creating a store release:
    py -3 build_seed_db.py

The app uses the publishable key already configured in src/lib/supabase.js.
No service-role key is needed or accepted by this script.
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "src" / "lib" / "supabase.js"
ASSET_DIR = ROOT / "assets"
ASSET_PATH = ASSET_DIR / "egymeds-seed.db"
TEMP_PATH = ASSET_DIR / "egymeds-seed.building.db"
PAGE_SIZE = 1000

FIELDS = (
    "id,commercial_name_en,commercial_name_ar,scientific_name,"
    "manufacturer,use,description,price_egp,price_old_egp,"
    "price_updated_at,product_type,updated_at"
)

SCHEMA_SQL = """
PRAGMA page_size = 4096;
CREATE TABLE drugs_cache (
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
CREATE TABLE cache_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE INDEX idx_drugs_cache_name_en ON drugs_cache(commercial_name_en);
CREATE INDEX idx_drugs_cache_name_ar ON drugs_cache(commercial_name_ar);
CREATE INDEX idx_drugs_cache_ingredient ON drugs_cache(scientific_name);
PRAGMA user_version = 1;
"""

INSERT_SQL = """
INSERT INTO drugs_cache (
  id, commercial_name_en, commercial_name_ar, scientific_name,
  manufacturer, drug_use, description, price_egp, price_old_egp,
  price_updated_at, product_type, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""


def load_config() -> tuple[str, str]:
    if not CONFIG_PATH.exists():
        raise RuntimeError(f"Supabase config not found: {CONFIG_PATH}")
    source = CONFIG_PATH.read_text(encoding="utf-8")
    url_match = re.search(r'const\s+SUPABASE_URL\s*=\s*"([^"]+)"', source)
    key_match = re.search(
        r'const\s+SUPABASE_PUBLISHABLE_KEY\s*=\s*"([^"]+)"', source
    )
    if not url_match or not key_match:
        raise RuntimeError(
            "Could not read SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY "
            "from src/lib/supabase.js"
        )
    return url_match.group(1).rstrip("/"), key_match.group(1)


def fetch_page(base_url: str, key: str, offset: int) -> tuple[list[dict], int | None]:
    params = urllib.parse.urlencode(
        {
            "select": FIELDS,
            "order": "id.asc",
            "limit": str(PAGE_SIZE),
            "offset": str(offset),
        }
    )
    request = urllib.request.Request(
        f"{base_url}/rest/v1/drugs?{params}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "Prefer": "count=exact",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
            content_range = response.headers.get("Content-Range", "")
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Supabase returned HTTP {exc.code}: {details[:1000]}"
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"Could not download Supabase rows at offset {offset}: {exc}"
        ) from exc

    remote_total = None
    match = re.search(r"/(\d+|\*)$", content_range)
    if match and match.group(1) != "*":
        remote_total = int(match.group(1))
    if not isinstance(payload, list):
        raise RuntimeError("Supabase returned an unexpected response format.")
    return payload, remote_total


def row_values(row: dict) -> tuple:
    if row.get("id") is None:
        raise RuntimeError("A drug record has no id; refusing to build the seed database.")
    return (
        int(row["id"]),
        row.get("commercial_name_en") or "",
        row.get("commercial_name_ar") or "",
        row.get("scientific_name") or "",
        row.get("manufacturer") or "",
        row.get("use") or "",
        row.get("description") or "",
        row.get("price_egp"),
        row.get("price_old_egp"),
        row.get("price_updated_at"),
        row.get("product_type") or "",
        row.get("updated_at"),
    )


def main() -> int:
    base_url, key = load_config()
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    snapshot_started_at = (
        datetime.now(timezone.utc).isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )

    for candidate in (TEMP_PATH, Path(str(TEMP_PATH) + "-journal"),
                      Path(str(TEMP_PATH) + "-wal"), Path(str(TEMP_PATH) + "-shm")):
        try:
            candidate.unlink()
        except FileNotFoundError:
            pass

    connection = None
    try:
        connection = sqlite3.connect(TEMP_PATH)
        connection.execute("PRAGMA journal_mode = DELETE")
        connection.executescript(SCHEMA_SQL)
        offset = 0
        expected_total = None
        saved_total = 0

        while True:
            page, page_total = fetch_page(base_url, key, offset)
            if expected_total is None and page_total is not None:
                expected_total = page_total

            if not page:
                break

            connection.executemany(INSERT_SQL, (row_values(row) for row in page))
            connection.commit()
            saved_total += len(page)
            offset += len(page)

            if expected_total is not None:
                print(
                    f"Downloaded and saved {saved_total:,} / "
                    f"{expected_total:,} drugs ({min(100, round(saved_total / max(expected_total, 1) * 100))}%)"
                )
            else:
                print(f"Downloaded and saved {saved_total:,} drugs")

            if len(page) < PAGE_SIZE:
                break

        if expected_total is not None and saved_total != expected_total:
            raise RuntimeError(
                f"Incomplete export: expected {expected_total:,} rows, got {saved_total:,}. "
                "The existing seed asset was not replaced."
            )

        if saved_total == 0:
            raise RuntimeError(
                "Supabase returned zero drugs. The existing seed asset was not replaced."
            )

        connection.executemany(
            "INSERT INTO cache_meta(key, value) VALUES (?, ?)",
            [
                ("last_sync_at", snapshot_started_at),
                ("last_full_sync_at", snapshot_started_at),
                ("seed_created_at", datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")),
            ],
        )
        connection.commit()
        connection.execute("ANALYZE")
        connection.commit()
        connection.close()
        connection = None

        # Integrity verification before replacing the tracked asset.
        verify = sqlite3.connect(TEMP_PATH)
        try:
            result = verify.execute("PRAGMA integrity_check").fetchone()[0]
            final_count = verify.execute("SELECT COUNT(*) FROM drugs_cache").fetchone()[0]
            if result != "ok" or final_count != saved_total:
                raise RuntimeError(
                    f"SQLite verification failed (integrity={result}, rows={final_count})."
                )
        finally:
            verify.close()

        os.replace(TEMP_PATH, ASSET_PATH)
        size_mb = ASSET_PATH.stat().st_size / (1024 * 1024)
        print()
        print(f"Success: {saved_total:,} drugs bundled in {ASSET_PATH}")
        print(f"Database size: {size_mb:.2f} MB")
        print("This file is now the offline starter database included by Metro/Expo.")
        return 0
    except Exception as exc:
        if connection is not None:
            connection.close()
        try:
            TEMP_PATH.unlink()
        except FileNotFoundError:
            pass
        print(f"\nERROR: {exc}", file=sys.stderr)
        print(
            "The existing assets/egymeds-seed.db was not replaced.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
