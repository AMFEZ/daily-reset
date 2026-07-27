import {
  createServerClient,
} from "@supabase/ssr";
import type {
  SupabaseClient,
} from "@supabase/supabase-js";
import {
  cookies,
} from "next/headers";
import type {
  Database,
} from "@/types/database.types";

function getSupabasePublicKey() {
  return (
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function createClient():
  Promise<SupabaseClient<Database>> {
  const cookieStore =
    await cookies();

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

  return createServerClient<Database>(
    supabaseUrl,
    supabasePublicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (
              const {
                name,
                value,
                options,
              } of cookiesToSet
            ) {
              cookieStore.set(
                name,
                value,
                options
              );
            }
          } catch {
            // Proxy refreshes cookies before
            // Server Components render.
          }
        },
      },
    }
  );
}
