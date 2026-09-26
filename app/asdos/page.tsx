import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Attendance, Course, Meeting, Student } from "@/lib/types";
import type { AssistantActivityLog, AssistantProfile, AssistantScheduleTemplate } from "@/lib/asdos/types";
import AsdosDashboard from "./asdos-dashboard";

export const dynamic = "force-dynamic";

export default async function AsdosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/asdos/login");

  const { data: adminProfile } = await supabase.from("admin_profiles").select("role, display_name").eq("user_id", user.id).maybeSingle();
  if (adminProfile?.role !== "assistant") {
    return <section className="page"><div className="shell"><div className="setup-box"><h2>Akun bukan Asisten Dosen</h2><p className="muted">Silakan login menggunakan akun Asdos.</p></div></div></section>;
  }

  const { data: assistantProfile } = await supabase.from("assistant_profiles").select("user_id, username, full_name, npm, program_study, is_active").eq("user_id", user.id).single();
  if (!assistantProfile?.is_active) {
    return <section className="page"><div className="shell"><div className="setup-box"><h2>Akun Asdos tidak aktif</h2></div></div></section>;
  }

  const { data: memberships } = await supabase.from("course_members").select("course_id").eq("user_id", user.id).eq("role", "assistant");
  const courseIds = (memberships ?? []).map((row) => row.course_id);

  const [coursesRes, studentsRes, meetingsRes, attendanceRes, schedulesRes, logsRes] = await Promise.all([
    courseIds.length ? supabase.from("courses").select("*").in("id", courseIds).order("name") : Promise.resolve({ data: [] }),
    courseIds.length ? supabase.from("students").select("*").in("course_id", courseIds).order("npm") : Promise.resolve({ data: [] }),
    courseIds.length ? supabase.from("meetings").select("*").in("course_id", courseIds).order("meeting_no") : Promise.resolve({ data: [] }),
    supabase.from("attendance").select("*"),
    supabase.from("assistant_schedule_templates").select("*").eq("assistant_user_id", user.id).order("weekday").order("start_time"),
    supabase.from("assistant_activity_logs").select("*").eq("assistant_user_id", user.id).order("activity_date", { ascending: false }).order("start_time"),
  ]);

  return (
    <AsdosDashboard
      profile={assistantProfile as AssistantProfile}
      initialCourses={(coursesRes.data ?? []) as Course[]}
      initialStudents={(studentsRes.data ?? []) as Student[]}
      initialMeetings={(meetingsRes.data ?? []) as Meeting[]}
      initialAttendance={(attendanceRes.data ?? []) as Attendance[]}
      initialSchedules={(schedulesRes.data ?? []) as AssistantScheduleTemplate[]}
      initialLogs={(logsRes.data ?? []) as AssistantActivityLog[]}
    />
  );
}
