import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireSuperAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "super_admin") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Hanya Super Admin yang dapat menggunakan fitur ini." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    user,
    profile,
    supabase,
  };
}
