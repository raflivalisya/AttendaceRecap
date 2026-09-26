import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ParsedAssistantSchedule } from "@/lib/asdos/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("assistant_profiles")
    .select("user_id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_active) {
    return NextResponse.json(
      { error: "Akun Asdos tidak aktif." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const filename = String(body.filename ?? "");

  const entries = Array.isArray(body.entries)
    ? (body.entries as ParsedAssistantSchedule[])
    : [];

  if (!entries.length) {
    return NextResponse.json(
      { error: "Tidak ada jadwal untuk disimpan." },
      { status: 400 },
    );
  }

  // Simpan riwayat/import milik Asdos.
  const assistantRows = entries.map((entry) => ({
    assistant_user_id: user.id,
    course_id: entry.matched_course_id || null,
    weekday: Number(entry.weekday),
    day_name: String(entry.day_name),
    start_time: String(entry.start_time),
    end_time: String(entry.end_time),
    class_label: String(entry.class_label),
    course_name: String(entry.course_name),
    lecturer_name: String(entry.lecturer_name),
    room: String(entry.room),
    source_filename: filename || null,
    source_sheet: String(entry.source_sheet ?? ""),
  }));

  const { error: assistantError } = await supabase
    .from("assistant_schedule_templates")
    .upsert(assistantRows, {
      onConflict:
        "assistant_user_id,weekday,start_time,class_label,course_name",
      ignoreDuplicates: false,
    });

  if (assistantError) {
    return NextResponse.json(
      { error: assistantError.message },
      { status: 400 },
    );
  }

  // Jadwal yang berhasil match ke mata kuliah juga masuk ke
  // course_schedules. Ini membuat Dosen/Admin dan Asdos memakai
  // jadwal yang sama.
  const sharedRows = entries
    .filter((entry) => Boolean(entry.matched_course_id))
    .map((entry) => ({
      course_id: entry.matched_course_id!,
      weekday: Number(entry.weekday),
      day_name: String(entry.day_name),
      start_time: String(entry.start_time),
      end_time: String(entry.end_time),
      room: String(entry.room ?? ""),
      source_filename: filename || null,
      source_assistant_user_id: user.id,
      updated_at: new Date().toISOString(),
    }));

  if (sharedRows.length) {
    const { error: sharedError } = await supabase
      .from("course_schedules")
      .upsert(sharedRows, {
        onConflict: "course_id,weekday,start_time,end_time",
        ignoreDuplicates: false,
      });

    if (sharedError) {
      return NextResponse.json(
        {
          error:
            `Jadwal Asdos tersimpan, tetapi sinkron jadwal mata kuliah gagal: ${sharedError.message}`,
        },
        { status: 400 },
      );
    }
  }

  await supabase.from("assistant_import_batches").insert({
    assistant_user_id: user.id,
    filename: filename || "upload.xlsx",
    imported_count: assistantRows.length,
  });

  return NextResponse.json({
    ok: true,
    imported_count: assistantRows.length,
    shared_count: sharedRows.length,
  });
}
