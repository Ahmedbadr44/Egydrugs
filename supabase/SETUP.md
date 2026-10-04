# Supabase setup

The app uses one shared Supabase database. The mobile app has read-only access. Medicines can be managed from the separate browser admin panel in [`../admin`](../admin), never from the app.

## Create the project

1. Create a Supabase account and a new project. Choose a region close to Egypt.
2. In **SQL Editor**, run [`schema.sql`](schema.sql).
3. Import `app/src/main/assets/egyptian-drugs.csv` into the empty `public.drugs` table. Map `price_egp` to `price_egp`; the `dosage` column can remain empty for now.
4. The Project URL and publishable key for the current project are already set in the ignored local file `supabase.local.properties`.

## Managing the drug list

For a simple add, edit, and delete interface, use the separate browser panel in [`../admin`](../admin). Follow its [setup instructions](../admin/README.md) first. It uses a Supabase Auth account and Row Level Security, while the Android app has no administrator screen.

You can also use **Table Editor > drugs** in the Supabase Dashboard for bulk corrections:

1. Use **Insert** to add a record. Fill at least `commercial_name_en`; leave `price_egp` empty when the price is unknown.
2. Click a row to edit it. Save the row when finished.
3. Select a row and use **Delete** to remove it. Confirm the record name before deleting.

The database trigger increases the data version after every change. Open apps detect the new version within a minute and download it automatically.

## Existing projects

If the project used the previous in-app administration screen, run [`migrations/20261003_lock_mobile_writes.sql`](migrations/20261003_lock_mobile_writes.sql) once in the SQL Editor. It revokes write access from all mobile-app roles while leaving any old administrator records untouched. Then run [`migrations/20261003_enable_browser_admin.sql`](migrations/20261003_enable_browser_admin.sql) to allow authenticated browser administrators to write again.

Do not share the database password or any `secret` / `service_role` key. Those keys bypass Row Level Security and must never be included in a mobile app.

The Android app reads the Project URL and publishable key from `supabase.local.properties`. Once the schema is installed and the CSV is imported, sync starts automatically. Devices check the shared data version every minute while the app is running and download the database only when it changes.
