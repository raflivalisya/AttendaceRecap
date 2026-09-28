import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_SYSTEM_SETTINGS,
  normalizeSystemSettings,
  validateSystemSettings,
  type SystemSettings,
} from "@/lib/system-settings";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role,display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return { ok: false as const, response: NextResponse.json({ error: "Akses ditolak." }, { status: 403 }) };
  }

  return { ok: true as const, user, profile };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data, error } = await supabase.from("system_settings").select("key,value");

    if (error) {
      return NextResponse.json({
        settings: DEFAULT_SYSTEM_SETTINGS,
        source: "defaults",
        warning: "Tabel system_settings belum tersedia. Jalankan supabase/production-hardening.sql.",
      });
    }

    return NextResponse.json({
      settings: normalizeSystemSettings(data),
      source: "database",
    });
  } catch {
    return NextResponse.json({ settings: DEFAULT_SYSTEM_SETTINGS, source: "defaults" });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (auth.profile.role !== "super_admin") {
    return NextResponse.json({ error: "Hanya Super Admin yang dapat mengubah pengaturan sistem." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<SystemSettings>;
  const settings: SystemSettings = {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...body,
    campus_latitude: Number(body.campus_latitude ?? DEFAULT_SYSTEM_SETTINGS.campus_latitude),
    campus_longitude: Number(body.campus_longitude ?? DEFAULT_SYSTEM_SETTINGS.campus_longitude),
    default_radius_meters: Number(body.default_radius_meters ?? DEFAULT_SYSTEM_SETTINGS.default_radius_meters),
    max_accuracy_meters: Number(body.max_accuracy_meters ?? DEFAULT_SYSTEM_SETTINGS.max_accuracy_meters),
    qr_refresh_seconds: Number(body.qr_refresh_seconds ?? DEFAULT_SYSTEM_SETTINGS.qr_refresh_seconds),
    checkin_ticket_minutes: Number(body.checkin_ticket_minutes ?? DEFAULT_SYSTEM_SETTINGS.checkin_ticket_minutes),
  };

  const errors = validateSystemSettings(settings);
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  const admin = createAdminClient();
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value: { value },
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin.from("system_settings").upsert(rows, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from("audit_logs").insert({
    actor_user_id: auth.user.id,
    entity_table: "system_settings",
    action: "UPDATE",
    summary: "Pengaturan sistem diperbarui",
    new_data: settings,
  });

  return NextResponse.json({ settings, success: true });
}
