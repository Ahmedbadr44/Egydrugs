import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lfxdgtbsmomafyaolndh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_A9K53JorCDERk7MtJG5wiw_z_Jm0bX0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
