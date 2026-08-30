"use client";

import { createClient } from "@supabase/supabase-js";

let browserClient;

export function createBrowserSupabaseClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  browserClient = createClient(url, key);
  return browserClient;
}

