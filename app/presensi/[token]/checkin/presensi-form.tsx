type SessionInfo = {
  meetingNo: number;
  meetingDate: string;
  courseName: string;
  className: string;
  lecturer: string;
  schedule: string;
  endsAt: string;
  radiusMeters: number;
  campusName: string;
  supportMessage: string;
};

type Props = { token: string; initialInfo: SessionInfo };

export default function PresensiForm({ token, initialInfo }: Props) {
  const action = `/api/presensi/${encodeURIComponent(token)}`;

  return (
    <main className="presensi-production-page">
      <div className="presensi-shell">
        <header className="presensi-hero">
          <div>
            <span className="eyebrow">Presensi Mahasiswa</span>
            <h1>{initialInfo.courseName}</h1>
            <p>
              {initialInfo.className} · Pertemuan {initialInfo.meetingNo}
            </p>
          </div>
        </header>

        <section className="panel presensi-main-card">
          <div className="panel-body">
            <div className="presensi-session-grid">
              <div>
                <span>Dosen</span>
                <strong>{initialInfo.lecturer}</strong>
              </div>
              <div>
                <span>Jadwal</span>
                <strong>{initialInfo.schedule || "-"}</strong>
              </div>
            </div>

            <form action={action} method="post" encType="application/x-www-form-urlencoded">
              <div className="field presensi-npm-field">
                <label htmlFor="student-npm">NPM</label>
                <input
                  id="student-npm"
                  name="npm"
                  type="text"
                  className="input"
                  placeholder="Masukkan NPM"
                  inputMode="numeric"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  required
                  minLength={4}
                  maxLength={32}
                  pattern="[A-Za-z0-9._-]{4,32}"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary presensi-submit"
                style={{ WebkitAppearance: "none", touchAction: "manipulation", cursor: "pointer" }}
              >
                Kirim Presensi
              </button>
            </form>

            <div className="location-help-tip">
              Presensi tidak menggunakan GPS. Masukkan NPM lalu tekan Kirim Presensi satu kali.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
