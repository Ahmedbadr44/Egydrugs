# Legacy import chunks (retired)

These SQL chunks belong to the old schema and are **not compatible** with the current minimal React Native database.

Do not run individual `*_insert.sql` files against production. The `000_reset.sql` file now intentionally raises an error instead of truncating the live table.

Current source of truth: `public.drugs` in Supabase. Manage records with Supabase Dashboard > Table Editor, or use a reviewed CSV update that matches rows by `id` and updates only intended columns.
