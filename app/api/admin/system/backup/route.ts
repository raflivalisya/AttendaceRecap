import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKUP_TABLES = [
  "courses",
  "students",
  "meetings",
  "attendance",
  "attendance_sessions",
  "assessments",
  "grades",
  "course_members",
  "course_schedules",
  "assistant_profiles",
  "assistant_schedule_templates",
  "assistant_activity_logs",
  "student_portal_profiles",
  "grade_letter_scales",
  "system_settings",
  "user_preferences",
] as const;

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const data: Record<string, unknown[]> = {};
  const warnings: string[] = [];

  for (const table of BACKUP_TABLES) {
    const { data: rows, error } = await admin.from(table).select("*");
    if (error) {
      warnings.push(`${table}: ${error.message}`);
      continue;
    }
    data[table] = rows ?? [];
  }

  // Riwayat check-in ikut dibackup tanpa fingerprint perangkat/IP/user-agent.
  const { data: checkins, error: checkinError } = await admin
    .from("attendance_checkins")
    .select("id,session_id,meeting_id,student_id,latitude,longitude,accuracy_m,distance_m,created_at");
  if (checkinError) warnings.push(`attendance_checkins: ${checkinError.message}`);
  else data.attendance_checkins = checkins ?? [];

  const payload = {
    format: "AttendanceRecap Backup",
    version: 1,
    created_at: new Date().toISOString(),
    created_by: auth.user.id,
    warnings,
    tables: data,
  };

  const date = new Date().toISOString().replace(/[:.]/g, "-");
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="AttendanceRecap-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
