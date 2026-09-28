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
        padding: "18px 12px 40px",
        background: "#f4f7fa",
      }}
    >
      <div
        className="shell"
        style={{ width: "100%", maxWidth: 600, margin: "0 auto" }}
      >
        <div className="hero" style={{ marginBottom: 14 }}>
          <div>
            <div className="eyebrow">Presensi Mahasiswa</div>
            <h1 id="hadir-v7-course">Presensi Mahasiswa</h1>
            <p id="hadir-v7-meeting">Menyiapkan sesi...</p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body">
            <div
              id="hadir-v7-root"
              data-token={token}
              data-code={code}
            >
              <div
                id="hadir-v7-version"
                style={{
                  display: "inline-flex",
                  marginBottom: 10,
                  padding: "5px 9px",
                  borderRadius: 999,
                  background: "#e8eef4",
                  color: "#52687b",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                Engine: EXTERNAL-V7 · menunggu JavaScript
              </div>

              <div
                id="hadir-v7-status"
                style={{
                  marginBottom: 14,
                  padding: 12,
                  border: "1px solid #d8e3ec",
                  borderRadius: 10,
                  background: "#eef4f8",
                  color: "#38566f",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Menyiapkan halaman presensi...
              </div>

              <div id="hadir-v7-info" style={{ display: "none" }}>
                <p>
                  <strong>Kelas:</strong>{" "}
                  <span id="hadir-v7-class">-</span>
                </p>

                <p>
                  <strong>Dosen:</strong>{" "}
                  <span id="hadir-v7-lecturer">-</span>
                </p>

                <p>
                  <strong>Jadwal:</strong>{" "}
                  <span id="hadir-v7-schedule">-</span>
                </p>

                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 10,
                    background: "#f1f5f9",
                    lineHeight: 1.55,
                  }}
                >
                  📍 <strong id="hadir-v7-campus">Lokasi kampus</strong>
                  <br />
                  GPS wajib • radius maksimal{" "}
                  <strong>
                    <span id="hadir-v7-radius">-</span> meter
                  </strong>
                </div>
              </div>

              <form id="hadir-v7-form" style={{ marginTop: 18 }}>
                <div className="field">
                  <label htmlFor="hadir-v7-npm">NPM</label>
                  <input
                    id="hadir-v7-npm"
                    className="input"
                    placeholder="Masukkan NPM"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled
                  />
                </div>

                <button
                  id="hadir-v7-submit"
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
                id="hadir-v7-message"
                role="status"
                aria-live="polite"
                style={{ display: "none" }}
              />

              <div
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: "1px solid #e5e7eb",
                  color: "#64748b",
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                Jika tetap berhenti di “Menyiapkan halaman presensi...”, buka
                QR menggunakan <strong>Chrome/Safari</strong> dan pastikan
                JavaScript situs tidak diblokir.
              </div>

              <noscript>
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 10,
                    background: "#fee2e2",
                    color: "#991b1b",
                    fontWeight: 700,
                  }}
                >
                  JavaScript memang dinonaktifkan pada browser ini.
                </div>
              </noscript>
            </div>
          </div>
        </div>
      </div>

      <script id="hadir-external-v7-script" src="/hadir-v7.js?v=20260928-7" defer />
    </section>
  );
}
