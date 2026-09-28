export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ code?: string | string[] }>;
};

export default async function PresensiPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const code = Array.isArray(query.code) ? query.code[0] : query.code ?? "";

  return (
    <section
      className="page"
      style={{
        minHeight: "100dvh",
        padding: "20px 12px 40px",
        background: "#f4f7fa",
      }}
    >
      <div
        className="shell"
        style={{
          width: "100%",
          maxWidth: 600,
          margin: "0 auto",
        }}
      >
        <div
          className="hero"
          style={{
            marginBottom: 14,
          }}
        >
          <div>
            <div className="eyebrow">Presensi Mahasiswa</div>
            <h1 id="presensi-course-title">Memuat sesi presensi...</h1>
            <p id="presensi-meeting-title">
              Mohon tetap di halaman ini sampai validasi selesai.
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body">
            <div
              id="presensi-runtime"
              data-token={token}
              data-code={code}
              data-script-version="2026-09-28-v3"
            >
              <div
                id="presensi-browser-status"
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 10,
                  background: "#eef4f8",
                  color: "#38566f",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Menyiapkan halaman presensi...
              </div>

              <div id="presensi-info" style={{ display: "none" }}>
                <p>
                  <strong>Kelas:</strong>{" "}
                  <span id="presensi-class-name">-</span>
                </p>
                <p>
                  <strong>Dosen:</strong>{" "}
                  <span id="presensi-lecturer">-</span>
                </p>
                <p>
                  <strong>Jadwal:</strong>{" "}
                  <span id="presensi-schedule">-</span>
                </p>

                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 10,
                    background: "#f1f5f9",
                  }}
                >
                  📍 <strong id="presensi-campus-name">Lokasi kampus</strong>
                  <br />
                  GPS wajib • radius maksimal{" "}
                  <strong id="presensi-radius">-</strong> meter
                </div>
              </div>

              <form id="presensi-form" style={{ marginTop: 18 }}>
                <div className="field">
                  <label htmlFor="presensi-npm">NPM</label>
                  <input
                    id="presensi-npm"
                    className="input"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Masukkan NPM"
                    disabled
                  />
                </div>

                <button
                  id="presensi-submit"
                  className="btn btn-primary"
                  type="submit"
                  disabled
                  style={{
                    width: "100%",
                    marginTop: 16,
                    minHeight: 48,
                  }}
                >
                  Menyiapkan...
                </button>
              </form>

              <div
                id="presensi-message"
                role="status"
                aria-live="polite"
                style={{ marginTop: 16, display: "none" }}
              />

              <div
                id="presensi-help"
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: "1px solid #e5e7eb",
                  color: "#64748b",
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                Jika halaman berhenti di “Menyiapkan...”, buka tautan QR
                menggunakan <strong>Chrome</strong> atau <strong>Safari</strong>,
                bukan browser bawaan WhatsApp/Instagram/QR Scanner.
              </div>

              <noscript>
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 10,
                    background: "#fee2e2",
                    color: "#991b1b",
                  }}
                >
                  JavaScript memang dinonaktifkan pada browser ini. Aktifkan
                  JavaScript atau buka QR menggunakan Chrome/Safari.
                </div>
              </noscript>
            </div>
          </div>
        </div>
      </div>

      <script src="/presensi-client-v3.js?v=20260928-1" defer />
    </section>
  );
}