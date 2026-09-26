import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OfficialPrintDocument from "@/components/admin/academic/OfficialPrintDocument";
import type { Assessment, Attendance, Course, Grade, Meeting, Student } from "@/lib/types";

export const dynamic = "force-dynamic";

type PrintType = "attendance" | "grades" | "meetings" | "summary";

export default async function AdminPrintPage({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ type?: string }> }) {
  const { courseId } = await params;
  const query = await searchParams;
  const type: PrintType = ["attendance","grades","meetings","summary"].includes(query.type ?? "") ? query.type as PrintType : "attendance";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin");

  const { data: course } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
  if (!course) redirect("/admin");

  const [studentsRes, meetingsRes, attendanceRes, assessmentsRes, gradesRes, gradeScalesRes] = await Promise.all([
    supabase.from("students").select("*").eq("course_id", courseId).order("npm"),
    supabase.from("meetings").select("*").eq("course_id", courseId).order("meeting_no"),
    supabase.from("attendance").select("*"),
    supabase.from("assessments").select("*").eq("course_id", courseId).order("sort_order"),
    supabase.from("grades").select("*"),
    supabase.from("grade_letter_scales").select("*").eq("course_id", courseId).order("sort_order"),
  ]);

  const students = (studentsRes.data ?? []) as Student[];
  const meetings = (meetingsRes.data ?? []) as Meeting[];
  const meetingIds = new Set(meetings.map((m) => m.id));
  const assessments = (assessmentsRes.data ?? []) as Assessment[];
  const assessmentIds = new Set(assessments.map((a) => a.id));
  const studentIds = new Set(students.map((s) => s.id));

  const attendance = ((attendanceRes.data ?? []) as Attendance[]).filter((a) => meetingIds.has(a.meeting_id) && studentIds.has(a.student_id));
  const grades = ((gradesRes.data ?? []) as Grade[]).filter((g) => assessmentIds.has(g.assessment_id) && studentIds.has(g.student_id));

  return <OfficialPrintDocument type={type} course={course as Course} students={students} meetings={meetings} attendance={attendance} assessments={assessments} grades={grades} gradeScales={(gradeScalesRes.data ?? [])} />;
}
