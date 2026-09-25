import { hasSupabaseEnv } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, Attendance, Course, Grade, Meeting, Student } from "@/lib/types";
import AdminPanel from "./admin-panel";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!hasSupabaseEnv()) {
    return <section className="page"><div className="shell"><div className="setup-box"><h2>Supabase belum dikonfigurasi</h2><p className="muted">Isi <code>.env.local</code>, lalu jalankan versi terbaru <code>supabase/schema.sql</code>.</p></div></div></section>;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <LoginForm />;

  const { data: admin } = await supabase.from("admin_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) {
    return <section className="page"><div className="shell"><div className="setup-box"><h2>Akun belum memiliki akses admin</h2><p className="muted">Akun <strong>{user.email}</strong> belum terdaftar pada <code>admin_profiles</code>.</p></div></div></section>;
  }

  const [coursesRes, studentsRes, meetingsRes, attendanceRes, assessmentsRes, gradesRes] = await Promise.all([
    supabase.from("courses").select("*").order("created_at"),
    supabase.from("students").select("*").order("npm"),
    supabase.from("meetings").select("*").order("meeting_no"),
    supabase.from("attendance").select("*"),
    supabase.from("assessments").select("*").order("sort_order"),
    supabase.from("grades").select("*"),
  ]);

  return (
    <AdminPanel
      initialCourses={(coursesRes.data ?? []) as Course[]}
      initialStudents={(studentsRes.data ?? []) as Student[]}
      initialMeetings={(meetingsRes.data ?? []) as Meeting[]}
      initialAttendance={(attendanceRes.data ?? []) as Attendance[]}
      initialAssessments={(assessmentsRes.data ?? []) as Assessment[]}
      initialGrades={(gradesRes.data ?? []) as Grade[]}
      adminEmail={user.email ?? "Admin"}
    />
  );
}
