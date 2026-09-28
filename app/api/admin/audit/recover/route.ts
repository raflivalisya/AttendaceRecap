import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const RECOVERABLE = new Set([
  "courses",
  "students",
  "meetings",
  "attendance",
  "assessments",
  "grades",
  "course_schedules",
]);

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const auditId = String(body.audit_id ?? "").trim();
  if (!auditId) return NextResponse.json({ error: "Audit ID wajib diisi." }, { status: 400 });

  const admin = createAdminClient();
  const { data: log, error: logError } = await admin
    .from("audit_logs")
    .select("*")
    .eq("id", auditId)
    .maybeSingle();

  if (logError || !log) return NextResponse.json({ error: "Audit log tidak ditemukan." }, { status: 404 });
  if (!RECOVERABLE.has(log.entity_table)) {
    return NextResponse.json({ error: "Jenis data ini tidak mendukung pemulihan otomatis." }, { status: 400 });
  }

  const table = log.entity_table as string;
  const entityId = log.entity_id as string | null;
  const oldData = log.old_data as Record<string, unknown> | null;
  const newData = log.new_data as Record<string, unknown> | null;

  let operationError: { message: string } | null = null;
  let summary = "";

  if (log.action === "DELETE" && oldData) {
    const result = await admin.from(table).upsert(oldData);
    operationError = result.error;
    summary = `Memulihkan data ${table} yang dihapus`;
  } else if (log.action === "UPDATE" && oldData && entityId) {
    const restore = { ...oldData };
    delete restore.id;
    const result = await admin.from(table).update(restore).eq("id", entityId);
    operationError = result.error;
    summary = `Mengembalikan perubahan ${table}`;
  } else if (log.action === "INSERT" && (entityId || newData?.id)) {
    const id = entityId || String(newData?.id);
    const result = await admin.from(table).delete().eq("id", id);
    operationError = result.error;
    summary = `Membatalkan penambahan ${table}`;
  } else {
    return NextResponse.json({ error: "Audit log ini tidak memiliki snapshot yang cukup untuk dipulihkan." }, { status: 400 });
  }

  if (operationError) return NextResponse.json({ error: operationError.message }, { status: 400 });

  await admin.from("audit_logs").insert({
    actor_user_id: auth.user.id,
    course_id: log.course_id,
    entity_table: table,
    entity_id: entityId,
    action: "RECOVER",
    summary,
    old_data: newData,
    new_data: oldData,
  });

  return NextResponse.json({ success: true, message: `${summary} berhasil.` });
}
