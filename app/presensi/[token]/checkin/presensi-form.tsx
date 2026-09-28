"use client";

import { useEffect, useState } from "react";

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
  const [npm, setNpm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ name?: string } | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingSeconds =
    now === null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Math.ceil((new Date(initialInfo.endsAt).getTime() - now) / 1000));

  const remainingText =
    now === null
      ? "--:--"
      : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  async function kirimPresensi() {
    if (loading || success) return;

    const cleanNpm = npm.trim();
    if (!/^[A-Za-z0-9._-]{4,32}$/.test(cleanNpm)) {
      setMessage("Masukkan NPM yang valid terlebih dahulu.");
      return;
    }

    if (remainingSeconds <= 0) {
      setMessage("Waktu presensi sudah berakhir. Scan QR terbaru jika sesi dibuka kembali.");
      return;
    }

    setLoading(true);
    setDetail(null);
    setMessage("Mengirim presensi…");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(`/api/presensi/${encodeURIComponent(token)}`, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ npm: cleanNpm }),
        signal: controller.signal,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || `Presensi gagal (${response.status}).`);
      }

      setSuccess(true);
      setMessage(result.message || "Presensi berhasil.");
      setDetail({ name: result.student?.name });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage("Server terlalu lama merespons. Coba lagi atau scan ulang QR jika sesi hampir habis.");
      } else {
        setMessage(error instanceof Error ? error.message : "Presensi gagal.");
      }
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

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

          <div className={`presensi-timer ${remainingSeconds <= 60 ? "urgent" : ""}`}>
            <small>Sisa sesi</small>
            <strong>{remainingText}</strong>
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

            {!success ? (
              <>
                <div className="field presensi-npm-field">
                  <label htmlFor="student-npm">NPM</label>
                  <input
                    id="student-npm"
                    type="text"
                    className="input"
                    value={npm}
                    onChange={(event) =>
                      setNpm(event.currentTarget.value.replace(/\s/g, "").slice(0, 32))
                    }
                    placeholder="Masukkan NPM"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={loading}
                    maxLength={32}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void kirimPresensi();
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary presensi-submit"
                  disabled={loading || remainingSeconds <= 0}
                  onClick={() => void kirimPresensi()}
                >
                  {loading ? "Mengirim…" : "Kirim Presensi"}
                </button>
              </>
            ) : (
              <div className="presensi-success-card">
                <span className="presensi-success-icon">✓</span>
                <div>
                  <strong>Presensi berhasil</strong>
                  {detail?.name && <span>{detail.name}</span>}
                  <small>Anda tercatat Hadir.</small>
                </div>
              </div>
            )}

            {message && (
              <div
                className={`presensi-message ${success ? "success" : "info"}`}
                role="status"
                aria-live="polite"
              >
                {message}
              </div>
            )}

            {!success && initialInfo.supportMessage && (
              <div className="location-help-tip">{initialInfo.supportMessage}</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
