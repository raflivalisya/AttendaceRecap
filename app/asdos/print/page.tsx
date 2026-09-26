import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AssistantActivityLog } from "@/lib/asdos/types";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

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

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function longDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

type SearchParams = Promise<{
  month?: string;
  start?: string;
  end?: string;
}>;

export default async function AsdosPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const month = /^\d{4}-\d{2}$/.test(params.month ?? "")
    ? params.month!
    : new Date().toISOString().slice(0, 7);

  const [year, monthNumber] = month.split("-").map(Number);

  const defaults = periodForMonth(month);

  const start = isIsoDate(params.start) ? params.start! : defaults.start;
  const end = isIsoDate(params.end) ? params.end! : defaults.end;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/asdos/login");
  }

  const { data: profile } = await supabase
    .from("assistant_profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    redirect("/asdos/login");
  }

  const { data } = await supabase
    .from("assistant_activity_logs")
    .select("*")
    .eq("assistant_user_id", user.id)
    .gte("activity_date", start)
    .lte("activity_date", end)
    .order("activity_date")
    .order("start_time");

  const logs = (data ?? []) as AssistantActivityLog[];

  const rows: Array<AssistantActivityLog | null> = Array.from(
    { length: 30 },
    (_, index) => logs[index] ?? null,
  );

  return (
    <main className="asdos-print-root">
      <div className="screen-actions no-print">
        <button
          id="print-asdos-button"
          type="button"
          className="print-button"
        >
          🖨 Print Rekap Asdos
        </button>

        <a href="/asdos" className="back-link">
          ← Kembali
        </a>
      </div>

      <section className="asdos-print-sheet">
        <div className="top-grid">
          <div className="brand">
            <div className="brand-mark">UTI</div>
            <div className="brand-name">
              UNIVERSITAS TEKNOKRAT INDONESIA
            </div>
          </div>

          <div className="title">
            DAFTAR KEHADIRAN
            <br />
            ASISTEN DOSEN
          </div>

          <div className="notes-box">
            <div>
              1. Kolom paraf dosen diisi dengan tanda tangan dosen pengampu MK.
            </div>
            <div>
              2. Kolom keterangan diisi dengan informasi yang dianggap perlu.
            </div>
            <div>
              3. Daftar kehadiran dicetak sesuai periode rekap yang dipilih.
            </div>
          </div>
        </div>

        <div className="identity">
          <div>
            <span>Nama :</span>
            <strong>{profile.full_name}</strong>
          </div>

          <div>
            <span>Bulan :</span>
            <strong>
              {MONTHS[monthNumber - 1]} {year}
            </strong>
          </div>
        </div>

        <div className="period-line">
          <span>Periode Rekap :</span>
          <strong>
            {longDate(start)} s.d. {longDate(end)}
          </strong>
        </div>

        <table className="report-table">
          <thead>
            <tr>
              <th rowSpan={2}>No.</th>
              <th rowSpan={2}>Tanggal</th>
              <th colSpan={2}>Jam</th>
              <th rowSpan={2}>Kelas</th>
              <th rowSpan={2}>Ruang</th>
              <th rowSpan={2}>Mata Kuliah</th>
              <th rowSpan={2}>Materi</th>
              <th colSpan={2}>Dosen</th>
              <th rowSpan={2}>Keterangan</th>
            </tr>

            <tr>
              <th>Mulai</th>
              <th>Selesai</th>
              <th>Nama</th>
              <th>Paraf</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((log, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{log ? formatDate(log.activity_date) : ""}</td>
                <td>{log ? formatTime(log.start_time) : ""}</td>
                <td>{log ? formatTime(log.end_time) : ""}</td>
                <td>{log?.class_label ?? ""}</td>
                <td>{log?.room ?? ""}</td>
                <td>{log?.course_name ?? ""}</td>
                <td>{log?.material ?? ""}</td>
                <td>{log?.lecturer_name ?? ""}</td>
                <td></td>
                <td>{log?.notes || log?.activity_type || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="signature">
          <div className="line"></div>
          <div>Administrator</div>
        </div>
      </section>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener("click", function(event) {
              var target = event.target;
              if (target && target.id === "print-asdos-button") {
                window.print();
              }
            });
          `,
        }}
      />

      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
        }

        body {
          background: #e9eef4;
          color: #111;
          font-family: Arial, Helvetica, sans-serif;
        }

        .asdos-print-root {
          display: block;
          width: 100%;
          min-height: 0;
          margin: 0;
          padding: 0;
          position: static;
        }

        .screen-actions {
          width: min(194mm, calc(100% - 24px));
          margin: 12px auto;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .print-button,
        .back-link {
          border: 0;
          border-radius: 8px;
          padding: 10px 14px;
          background: #123f65;
          color: white;
          text-decoration: none;
          font-weight: 700;
          cursor: pointer;
        }

        .back-link {
          background: #fff;
          color: #123f65;
          border: 1px solid #ccd6e0;
        }

        /*
         * SCREEN:
         * Dokumen dibuat sedikit lebih kecil dari A4.
         * Jangan gunakan min-height: 297mm karena itu yang
         * berpotensi membuat Chrome mendorong dokumen ke halaman kedua.
         */
        .asdos-print-sheet {
          display: block;
          width: 194mm;
          max-width: calc(100% - 24px);
          height: auto;
          min-height: 0;
          margin: 0 auto 24px;
          padding: 8mm 8mm 7mm;
          background: #fff;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
          position: static;
          break-before: auto;
          page-break-before: auto;
          overflow: visible;
        }

        .top-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr 1fr;
          gap: 6mm;
          align-items: start;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 2mm;
        }

        .brand-mark {
          width: 28px;
          height: 28px;
          border: 2px solid #111;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 8px;
          font-weight: 800;
          flex: 0 0 auto;
        }

        .brand-name {
          font-family: Georgia, serif;
          font-weight: 800;
          font-size: 12px;
        }

        .title {
          text-align: center;
          font-family: Georgia, serif;
          font-weight: 700;
          font-size: 11px;
          line-height: 1.25;
          margin-top: 9mm;
        }

        .notes-box {
          border: 1px solid #555;
          padding: 4px 6px;
          font-size: 6.5px;
          line-height: 1.3;
        }

        .identity {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16mm;
          margin: 5mm 0 2mm;
          font-size: 9px;
        }

        .identity div,
        .period-line {
          display: flex;
          align-items: flex-end;
          gap: 6px;
        }

        .identity strong,
        .period-line strong {
          display: block;
          flex: 1;
          border-bottom: 1px solid #333;
          padding: 0 4px 2px;
          font-weight: 500;
        }

        .period-line {
          font-size: 9px;
          margin-bottom: 2.5mm;
        }

        .report-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 6.2px;
        }

        .report-table th,
        .report-table td {
          border: 1px solid #333;
          padding: 1px 2px;
          height: 14px;
          line-height: 1.1;
          vertical-align: middle;
          overflow: hidden;
          word-break: break-word;
        }

        .report-table th {
          text-align: center;
          font-family: Georgia, serif;
          font-weight: 700;
          background: #fff;
        }

        .report-table th:nth-child(1) {
          width: 4%;
        }

        .report-table th:nth-child(2) {
          width: 7%;
        }

        .report-table th:nth-child(5) {
          width: 7%;
        }

        .report-table th:nth-child(6) {
          width: 8%;
        }

        .report-table th:nth-child(7) {
          width: 12%;
        }

        .report-table th:nth-child(8) {
          width: 12%;
        }

        .report-table th:nth-child(11) {
          width: 10%;
        }

        .report-table td:first-child {
          text-align: center;
        }

        .signature {
          width: 48mm;
          margin-left: auto;
          margin-top: 8mm;
          text-align: center;
          font-size: 9px;
        }

        .signature .line {
          border-top: 1px solid #333;
          margin-bottom: 4px;
        }

        /*
         * PRINT:
         * Berikan margin printer pada @page.
         * Sheet tidak lagi berukuran 210x297mm.
         * Ini mencegah blank page di Chrome.
         */
        @page {
          size: A4 portrait;
          margin: 7mm;
        }

        @media print {
          html,
          body {
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          body {
            display: block !important;
          }

          .no-print,
          .screen-actions {
            display: none !important;
          }

          .asdos-print-root {
            display: block !important;
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            position: static !important;
            overflow: visible !important;
          }

          .asdos-print-sheet {
            display: block !important;
            width: auto !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            position: static !important;
            overflow: visible !important;
            background: #fff !important;
            box-shadow: none !important;
            border: 0 !important;
            transform: none !important;
            break-before: auto !important;
            page-break-before: auto !important;
            break-after: auto !important;
            page-break-after: auto !important;
          }

          .top-grid {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .identity,
          .period-line {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .report-table {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            break-before: auto !important;
            page-break-before: auto !important;
          }

          .report-table thead {
            display: table-header-group;
          }

          .report-table tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .report-table th,
          .report-table td {
            height: 13px !important;
            padding: 1px 2px !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .signature {
            margin-top: 6mm;
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </main>
  );
}
