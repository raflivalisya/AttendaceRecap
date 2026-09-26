import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("student_portal_profiles")
    .select("user_id, npm, full_name, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile?.is_active) {
    return NextResponse.json(
      { error: "Akun mahasiswa tidak aktif." },
      { status: 403 },
    );
  }

  const { data: studentRows, error: studentError } = await admin
    .from("students")
    .select("*")
    .eq("npm", profile.npm)
    .order("name");

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 400 });
  }

  const rows = studentRows ?? [];
  const courseIds = Array.from(new Set(rows.map((item) => item.course_id)));
  const studentIds = rows.map((item) => item.id);

  if (!courseIds.length) {
    return NextResponse.json({
      profile,
      students: rows,
      courses: [],
      meetings: [],
      attendance: [],
      assessments: [],
      grades: [],
      schedules: [],
      grade_scales: [],
    });
  }

  const [
    coursesResult,
    meetingsResult,
    attendanceResult,
    assessmentsResult,
    schedulesResult,
    gradeScalesResult,
  ] = await Promise.all([
    admin.from("courses").select("*").in("id", courseIds),
    admin
      .from("meetings")
      .select("*")
      .in("course_id", courseIds)
      .order("meeting_no"),
    studentIds.length
      ? admin.from("attendance").select("*").in("student_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("assessments")
      .select("*")
      .in("course_id", courseIds)
      .order("sort_order"),
    admin
      .from("course_schedules")
      .select("*")
      .in("course_id", courseIds)
      .order("weekday")
      .order("start_time"),
    admin
      .from("grade_letter_scales")
      .select("*")
      .in("course_id", courseIds)
      .order("sort_order"),
  ]);

  const errors = [
    coursesResult.error,
    meetingsResult.error,
    attendanceResult.error,
    assessmentsResult.error,
    schedulesResult.error,
    gradeScalesResult.error,
  ].filter(Boolean);

  if (errors.length) {
    return NextResponse.json(
      { error: errors[0]?.message ?? "Gagal memuat data portal." },
      { status: 400 },
    );
  }

  const courses = coursesResult.data ?? [];
  const publishedAssessmentIds = new Set(
    (assessmentsResult.data ?? [])
      .filter((assessment) =>
        courses.some(
          (course) =>
            course.id === assessment.course_id && course.publish_grades,
        ),
      )
      .map((assessment) => assessment.id),
  );

  let grades: unknown[] = [];

  if (publishedAssessmentIds.size && studentIds.length) {
    const { data, error } = await admin
      .from("grades")
      .select("*")
      .in("assessment_id", Array.from(publishedAssessmentIds))
      .in("student_id", studentIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    grades = data ?? [];
  }

  return NextResponse.json({
    profile,
    students: rows,
    courses,
    meetings: meetingsResult.data ?? [],
    attendance: attendanceResult.data ?? [],
    assessments: assessmentsResult.data ?? [],
    grades,
    schedules: schedulesResult.data ?? [],
    grade_scales: gradeScalesResult.data ?? [],
  });
}
