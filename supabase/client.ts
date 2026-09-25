import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL belum dikonfigurasi."
    );
  }

  if (!supabaseKey) {
    throw new Error(
      "Supabase public key belum dikonfigurasi."
    );
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseKey
  );
}