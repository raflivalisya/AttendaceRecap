import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("assistant_profiles")
    .select("user_id,is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_active) {
    return { ok: false as const, response: NextResponse.json({ error: "Akun Asdos tidak aktif." }, { status: 403 }) };
  }

  return { ok: true as const, supabase, user };
}

export async function GET() {
  const auth = await getUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("user_preferences")
    .select("value,updated_at")
    .eq("user_id", auth.user.id)
    .eq("preference_key", "asdos_recap_period")
    .maybeSingle();

  if (error) return NextResponse.json({ preference: null, fallback: true }, { status: 200 });
  return NextResponse.json({ preference: data?.value ?? null, updated_at: data?.updated_at ?? null });
}

export async function PUT(request: NextRequest) {
  const auth = await getUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const month = String(body.month ?? "");
  const start = String(body.start ?? "");
  const end = String(body.end ?? "");

  if (!/^\d{4}-\d{2}$/.test(month) || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    return NextResponse.json({ error: "Periode tidak valid." }, { status: 400 });
  }

  const { error } = await auth.supabase.from("user_preferences").upsert(
    {
      user_id: auth.user.id,
      preference_key: "asdos_recap_period",
      value: { month, start, end },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,preference_key" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, preference: { month, start, end } });
}
