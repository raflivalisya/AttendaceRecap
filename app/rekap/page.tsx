import { hasSupabaseEnv } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, Attendance, Course, Grade, Meeting, Student } from "@/lib/types";
import RekapDashboard from "./rekap-dashboard";
import Link from "next/link";

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
  <>
    <div
      style={{
        maxWidth: "1400px",
        margin: "20px auto 0",
        padding: "0 20px",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      <a
        href="/admin"
        className="btn btn-primary"
        style={{
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        👨‍🏫 Login Dosen / Admin
      </a>

      <a
        href="/asdos/login"
        className="btn btn-secondary"
        style={{
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        🧑‍💻 Login Asisten Dosen
      </a>
    </div>

    <RekapDashboard
      courses={(coursesRes.data ?? []) as Course[]}
      students={(studentsRes.data ?? []) as Student[]}
      meetings={(meetingsRes.data ?? []) as Meeting[]}
      attendance={(attendanceRes.data ?? []) as Attendance[]}
      assessments={(assessmentsRes.data ?? []) as Assessment[]}
      grades={(gradesRes.data ?? []) as Grade[]}
    />
  </>
);
}
