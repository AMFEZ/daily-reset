import {
  createBrowserClient,
} from "@supabase/ssr";
import type {
  SupabaseClient,
} from "@supabase/supabase-js";
import type {
  Database,
} from "@/types/database.types";

let browserClient:
  | SupabaseClient<Database>
  | null = null;

function getSupabasePublicKey() {
  return (
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createClient():
  SupabaseClient<Database> {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublicKey =
    getSupabasePublicKey();

  if (
    !supabaseUrl ||
    !supabasePublicKey
  ) {
    throw new Error(
      "Missing Supabase environment variables."
    );
  }

  browserClient =
    createBrowserClient<Database>(
      supabaseUrl,
      supabasePublicKey
    );

  return browserClient;
}
