import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isoDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("assistant_profiles").select("user_id, is_active").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_active) return NextResponse.json({ error: "Akun Asdos tidak aktif." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const month = String(body.month ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Format bulan harus YYYY-MM." }, { status: 400 });

  const [year, monthNumber] = month.split("-").map(Number);
  const monthIndex = monthNumber - 1;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  const { data: templates, error: templateError } = await supabase.from("assistant_schedule_templates").select("*").eq("assistant_user_id", user.id);
  if (templateError) return NextResponse.json({ error: templateError.message }, { status: 400 });
  if (!templates?.length) return NextResponse.json({ error: "Belum ada jadwal Asdos. Import Excel terlebih dahulu." }, { status: 400 });

  const rows: any[] = [];
  for (const template of templates) {
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(Date.UTC(year, monthIndex, day));
      if (date.getUTCDay() !== Number(template.weekday)) continue;
      rows.push({
        assistant_user_id: user.id,
        schedule_template_id: template.id,
        course_id: template.course_id,
        activity_date: isoDate(year, monthIndex, day),
        start_time: template.start_time,
        end_time: template.end_time,
        class_label: template.class_label,
        room: template.room,
        course_name: template.course_name,
        material: "",
        lecturer_name: template.lecturer_name,
        activity_type: "Mengajar",
        notes: "",
        status: "draft",
      });
    }
  }

  const { error: insertError } = await supabase.from("assistant_activity_logs").upsert(rows, {
    onConflict: "assistant_user_id,activity_date,start_time,class_label,course_name",
    ignoreDuplicates: true,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  const startDate = `${month}-01`;
  const endDate = isoDate(year, monthIndex, daysInMonth);
  const { data: logs, error: logError } = await supabase.from("assistant_activity_logs").select("*").eq("assistant_user_id", user.id).gte("activity_date", startDate).lte("activity_date", endDate).order("activity_date").order("start_time");
  if (logError) return NextResponse.json({ error: logError.message }, { status: 400 });

  return NextResponse.json({ ok: true, generated: rows.length, logs: logs ?? [] });
}
