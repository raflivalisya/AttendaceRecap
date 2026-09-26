import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseAssistantWorkbook } from "@/lib/asdos/excel-parser";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Silakan login sebagai Asdos." }, { status: 401 });

  const { data: profile } = await supabase.from("assistant_profiles").select("user_id, full_name, is_active").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_active) return NextResponse.json({ error: "Akun ini bukan Asisten Dosen aktif." }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File Excel belum dipilih." }, { status: 400 });
  if (!/\.xlsx?$/i.test(file.name)) return NextResponse.json({ error: "Gunakan file .xlsx atau .xls." }, { status: 400 });

  const { data: memberships } = await supabase.from("course_members").select("course_id").eq("user_id", user.id).eq("role", "assistant");
  const ids = (memberships ?? []).map((row) => row.course_id);
  const { data: courses } = ids.length
    ? await supabase.from("courses").select("id, name, class_name, lecturer").in("id", ids)
    : { data: [] as Array<{ id: string; name: string; class_name: string; lecturer: string }> };

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseAssistantWorkbook(buffer, profile.full_name, courses ?? []);
  if (parsed.entries.length === 0) {
    return NextResponse.json({
      error: `Jadwal untuk ${profile.full_name} tidak ditemukan pada workbook ini.`,
      available_names: parsed.availableNames,
    }, { status: 404 });
  }

  return NextResponse.json({
    filename: file.name,
    assistant_name: profile.full_name,
    entries: parsed.entries,
    available_names: parsed.availableNames,
  });
}
