import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("admin_profiles")
    .select("role, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminProfile) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const admin = createAdminClient();
  const params = request.nextUrl.searchParams;
  const courseId = params.get("course_id")?.trim() ?? "";
  const entity = params.get("entity")?.trim() ?? "";
  const action = params.get("action")?.trim() ?? "";

  let allowedCourseIds: string[] | null = null;

  if (adminProfile.role !== "super_admin") {
    const { data: memberships } = await admin
      .from("course_members")
      .select("course_id")
      .eq("user_id", user.id);

    allowedCourseIds = (memberships ?? []).map((item) => item.course_id);

    if (!allowedCourseIds.length) {
      return NextResponse.json({ logs: [] });
    }
  }

  let query = admin
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(250);

  if (allowedCourseIds) {
    query = query.in("course_id", allowedCourseIds);
  }

  if (courseId) query = query.eq("course_id", courseId);
  if (entity) query = query.eq("entity_table", entity);
  if (action) query = query.eq("action", action);

  const { data: logs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const actorIds = Array.from(
    new Set((logs ?? []).map((item) => item.actor_user_id).filter(Boolean)),
  ) as string[];

  const actorName = new Map<string, string>();

  if (actorIds.length) {
    const [{ data: admins }, { data: assistants }, { data: students }] =
      await Promise.all([
        admin
          .from("admin_profiles")
          .select("user_id, display_name")
          .in("user_id", actorIds),
        admin
          .from("assistant_profiles")
          .select("user_id, full_name")
          .in("user_id", actorIds),
        admin
          .from("student_portal_profiles")
          .select("user_id, full_name")
          .in("user_id", actorIds),
      ]);

    for (const item of admins ?? []) {
      actorName.set(item.user_id, item.display_name || "Admin/Dosen");
    }

    for (const item of assistants ?? []) {
      if (!actorName.has(item.user_id)) {
        actorName.set(item.user_id, item.full_name || "Asisten Dosen");
      }
    }

    for (const item of students ?? []) {
      if (!actorName.has(item.user_id)) {
        actorName.set(item.user_id, item.full_name || "Mahasiswa");
      }
    }
  }

  return NextResponse.json({
    logs: (logs ?? []).map((item) => ({
      ...item,
      actor_name: item.actor_user_id
        ? actorName.get(item.actor_user_id) ?? "Pengguna"
        : "Sistem",
    })),
  });
}
