import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Check = { key: string; label: string; ok: boolean; detail: string };

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const checks: Check[] = [];
  const requiredEnv = [
    ["NEXT_PUBLIC_SUPABASE_URL", Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)],
    ["SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)],
    ["QR_SIGNING_SECRET", Boolean(process.env.QR_SIGNING_SECRET && process.env.QR_SIGNING_SECRET.length >= 24)],
  ] as const;

  for (const [key, ok] of requiredEnv) {
    checks.push({ key: `env:${key}`, label: key, ok, detail: ok ? "Tersedia" : "Belum dikonfigurasi" });
  }

  try {
    const admin = createAdminClient();
    const tables = [
      "courses",
      "students",
      "meetings",
      "attendance",
      "attendance_sessions",
      "attendance_checkins",
      "attendance_checkin_attempts",
      "audit_logs",
      "system_settings",
      "user_preferences",
    ];

    for (const table of tables) {
      const { error } = await admin.from(table).select("*").limit(1);
      checks.push({
        key: `db:${table}`,
        label: `Database · ${table}`,
        ok: !error,
        detail: error ? error.message : "OK",
      });
    }
  } catch (error) {
    checks.push({
      key: "db:connection",
      label: "Koneksi database",
      ok: false,
      detail: error instanceof Error ? error.message : "Koneksi gagal",
    });
  }

  const failed = checks.filter((check) => !check.ok).length;
  return NextResponse.json({
    status: failed === 0 ? "healthy" : "degraded",
    checked_at: new Date().toISOString(),
    failed,
    checks,
  });
}
