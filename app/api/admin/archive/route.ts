import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("courses")
    .select("*")
    .order("academic_year", { ascending: false })
    .order("semester")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ courses: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const courseId = String(body.course_id ?? "").trim();
  const archived = Boolean(body.archived);

  if (!courseId) {
    return NextResponse.json(
      { error: "course_id wajib diisi." },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("courses")
    .update({
      is_archived: archived,
      archived_at: archived ? new Date().toISOString() : null,
    })
    .eq("id", courseId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_user_id: auth.user.id,
    course_id: courseId,
    entity_table: "courses",
    entity_id: courseId,
    action: "ARCHIVE",
    summary: archived ? "Kelas diarsipkan" : "Kelas dipulihkan dari arsip",
    new_data: { is_archived: archived },
  });

  return NextResponse.json({ ok: true, course: data });
}
