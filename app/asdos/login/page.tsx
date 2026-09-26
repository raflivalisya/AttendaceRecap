import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AssistantActivityLog } from "@/lib/asdos/types";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function formatTime(value: string) {
  return value.slice(0, 5).replace(":", ".");
}

function isIsoDate(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function periodForMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1, 24));
  const start = new Date(Date.UTC(year, month - 2, 26));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function longDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default async function AsdosPrintPage({ searchParams }: { searchParams: Promise<{ month?: string; start?: string; end?: string }> }) {
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const defaults = periodForMonth(month);
  const start = isIsoDate(params.start) ? params.start! : defaults.start;
  const end = isIsoDate(params.end) ? params.end! : defaults.end;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/asdos/login");

  const { data: profile } = await supabase
    .from("assistant_profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/asdos/login");

  const { data } = await supabase
    .from("assistant_activity_logs")
    .select("*")
    .eq("assistant_user_id", user.id)
    .gte("activity_date", start)
    .lte("activity_date", end)
    .order("activity_date")
    .order("start_time");

  const logs = (data ?? []) as AssistantActivityLog[];
  const rows: Array<AssistantActivityLog | null> = Array.from({ length: 30 }, (_, index) => logs[index] ?? null);

  return (
    <main className="print-page">
      <div className="screen-actions"><PrintButton /><a href="/asdos" className="back-link">← Kembali</a></div>
      <section className="sheet">
        <div className="top-grid">
          <div className="brand"><div className="brand-mark">UTI</div><div className="brand-name">UNIVERSITAS TEKNOKRAT INDONESIA</div></div>
          <div className="title">DAFTAR KEHADIRAN<br/>ASISTEN DOSEN</div>
          <div className="notes-box"><div>1. Kolom paraf dosen diisi dengan tanda tangan dosen pengampu MK.</div><div>2. Kolom keterangan diisi dengan informasi yang dianggap perlu.</div><div>3. Daftar kehadiran dicetak sesuai periode rekap yang dipilih.</div></div>
        </div>

        <div className="identity">
          <div><span>Nama :</span><strong>{profile.full_name}</strong></div>
          <div><span>Bulan :</span><strong>{MONTHS[monthNumber - 1]} {year}</strong></div>
        </div>
        <div className="period-line"><span>Periode Rekap :</span><strong>{longDate(start)} s.d. {longDate(end)}</strong></div>

        <table className="report-table">
          <thead>
            <tr><th rowSpan={2}>No.</th><th rowSpan={2}>Tanggal</th><th colSpan={2}>Jam</th><th rowSpan={2}>Kelas</th><th rowSpan={2}>Ruang</th><th rowSpan={2}>Mata Kuliah</th><th rowSpan={2}>Materi</th><th colSpan={2}>Dosen</th><th rowSpan={2}>Keterangan</th></tr>
            <tr><th>Mulai</th><th>Selesai</th><th>Nama</th><th>Paraf</th></tr>
          </thead>
          <tbody>
            {rows.map((log, index) => <tr key={index}><td>{index + 1}</td><td>{log ? formatDate(log.activity_date) : ""}</td><td>{log ? formatTime(log.start_time) : ""}</td><td>{log ? formatTime(log.end_time) : ""}</td><td>{log?.class_label ?? ""}</td><td>{log?.room ?? ""}</td><td>{log?.course_name ?? ""}</td><td>{log?.material ?? ""}</td><td>{log?.lecturer_name ?? ""}</td><td></td><td>{log?.notes || log?.activity_type || ""}</td></tr>)}
          </tbody>
        </table>

        <div className="signature"><div className="line"></div><div>Administrator</div></div>
      </section>

      <style>{`
        *{box-sizing:border-box} body{margin:0;background:#e9eef4;color:#111;font-family:Arial,Helvetica,sans-serif}.screen-actions{max-width:210mm;margin:12px auto;display:flex;gap:10px;align-items:center}.print-button,.back-link{border:0;border-radius:8px;padding:10px 14px;background:#123f65;color:white;text-decoration:none;font-weight:700;cursor:pointer}.back-link{background:#fff;color:#123f65;border:1px solid #ccd6e0}.sheet{width:210mm;min-height:297mm;margin:0 auto 30px;background:white;padding:9mm 10mm 10mm;box-shadow:0 8px 30px rgba(0,0,0,.12)}.top-grid{display:grid;grid-template-columns:1.2fr .8fr 1fr;gap:8mm;align-items:start}.brand{display:flex;align-items:center;gap:8px;margin-top:4mm}.brand-mark{width:30px;height:30px;border:2px solid #111;border-radius:50%;display:grid;place-items:center;font-size:9px;font-weight:800}.brand-name{font-family:Georgia,serif;font-weight:800;font-size:13px}.title{text-align:center;font-family:Georgia,serif;font-weight:700;font-size:12px;line-height:1.25;margin-top:12mm}.notes-box{border:1px solid #555;padding:5px 7px;font-size:7px;line-height:1.35}.identity{display:grid;grid-template-columns:1fr 1fr;gap:20mm;margin:7mm 0 2mm;font-size:10px}.identity div,.period-line{display:flex;align-items:flex-end;gap:6px}.identity strong,.period-line strong{display:block;flex:1;border-bottom:1px solid #333;padding:0 4px 2px;font-weight:500}.period-line{font-size:10px;margin-bottom:3mm}.report-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:6.4px}.report-table th,.report-table td{border:1px solid #333;padding:2px 2px;height:16px;vertical-align:middle;overflow:hidden}.report-table th{text-align:center;font-family:Georgia,serif;font-weight:700;background:#fff}.report-table th:nth-child(1){width:4%}.report-table th:nth-child(2){width:7%}.report-table th:nth-child(5){width:7%}.report-table th:nth-child(6){width:8%}.report-table th:nth-child(7){width:12%}.report-table th:nth-child(8){width:12%}.report-table th:nth-child(11){width:10%}.report-table td:first-child{text-align:center}.signature{width:48mm;margin-left:auto;margin-top:12mm;text-align:center;font-size:9px}.signature .line{border-top:1px solid #333;margin-bottom:4px}.signature div:last-child{border-top:0}@page{size:A4 portrait;margin:0}@media print{body{background:#fff}.screen-actions{display:none}.sheet{margin:0;box-shadow:none;width:210mm;min-height:297mm;padding:9mm 10mm 8mm}.report-table th,.report-table td{height:15px}}
      `}</style>
    </main>
  );
}
