import { hasSupabaseEnv } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, Attendance, Course, Grade, Meeting, Student } from "@/lib/types";
import RekapDashboard from "./rekap-dashboard";

export const dynamic = "force-dynamic";

export default async function RekapPage() {
  if (!hasSupabaseEnv()) {
    return <section className="page"><div className="shell"><div className="setup-box"><h2>Hubungkan project ke Supabase</h2><p className="muted">Isi <code>.env.local</code>, jalankan <code>supabase/schema.sql</code>, lalu restart Next.js.</p></div></div></section>;
  }

  const supabase = await createClient();
  const [coursesRes, studentsRes, meetingsRes, attendanceRes, assessmentsRes, gradesRes] = await Promise.all([
    supabase.from("courses").select("*").order("name"),
    supabase.from("students").select("*").order("npm"),
    supabase.from("meetings").select("*").order("meeting_no"),
    supabase.from("attendance").select("*"),
    supabase.from("assessments").select("*").order("sort_order"),
    supabase.from("grades").select("*"),
  ]);

  return (
    <RekapDashboard
      courses={(coursesRes.data ?? []) as Course[]}
      students={(studentsRes.data ?? []) as Student[]}
      meetings={(meetingsRes.data ?? []) as Meeting[]}
      attendance={(attendanceRes.data ?? []) as Attendance[]}
      assessments={(assessmentsRes.data ?? []) as Assessment[]}
      grades={(gradesRes.data ?? []) as Grade[]}
    />
  );
}
