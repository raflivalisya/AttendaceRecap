import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("admin_profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profil tidak ditemukan." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const courseId = String(body.course_id ?? "");
  const assistantUserId = String(body.assistant_user_id ?? "");
  const assigned = Boolean(body.assigned);
  if (!courseId || !assistantUserId) return NextResponse.json({ error: "course_id dan assistant_user_id wajib diisi." }, { status: 400 });

  const admin = createAdminClient();
  if (profile.role !== "super_admin") {
    const { data: lecturerMembership } = await admin.from("course_members").select("id").eq("course_id", courseId).eq("user_id", user.id).eq("role", "lecturer").maybeSingle();
    if (!lecturerMembership) return NextResponse.json({ error: "Hanya dosen pengampu atau Super Admin yang dapat mengatur Asdos." }, { status: 403 });
  }

  const { data: assistant } = await admin.from("assistant_profiles").select("user_id, is_active").eq("user_id", assistantUserId).maybeSingle();
  if (!assistant?.is_active) return NextResponse.json({ error: "Akun Asdos tidak ditemukan atau tidak aktif." }, { status: 404 });

  if (assigned) {
    const { error } = await admin.from("course_members").upsert({ course_id: courseId, user_id: assistantUserId, role: "assistant" }, { onConflict: "course_id,user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { error } = await admin.from("course_members").delete().eq("course_id", courseId).eq("user_id", assistantUserId).eq("role", "assistant");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, assigned });
}
