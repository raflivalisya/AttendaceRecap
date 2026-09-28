"use client";

import { useEffect, useMemo, useState } from "react";

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
type LocationData = { latitude: number; longitude: number; accuracy: number };
type PermissionStateValue = "granted" | "prompt" | "denied" | "unknown";
type LocationFailureReason = "permission" | "unavailable" | "timeout" | "unsupported" | "insecure";
type LocationFailure = Error & { reason?: LocationFailureReason };

function makeLocationError(message: string, reason: LocationFailureReason): LocationFailure {
  const error = new Error(message) as LocationFailure;
  error.reason = reason;
  return error;
}

function locationFailureFromBrowser(error: GeolocationPositionError): LocationFailure {
  if (error.code === error.PERMISSION_DENIED) {
    return makeLocationError(
      "Izin lokasi ditolak. Di Safari buka menu halaman → Website Settings → Location → Allow, lalu coba lagi.",
      "permission",
    );
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return makeLocationError(
      "Lokasi belum tersedia. Pastikan Location Services dan Precise Location aktif, lalu coba di area yang lebih terbuka.",
      "unavailable",
    );
  }
  if (error.code === error.TIMEOUT) {
    return makeLocationError("GPS terlalu lama merespons. Coba lagi beberapa detik kemudian.", "timeout");
  }
  return makeLocationError("Gagal membaca lokasi perangkat.", "unavailable");
}

function geolocationReady(): LocationFailure | null {
  if (typeof window !== "undefined" && !window.isSecureContext && location.hostname !== "localhost") {
    return makeLocationError(
      "Akses GPS membutuhkan HTTPS. Buka halaman presensi dari alamat HTTPS Vercel.",
      "insecure",
    );
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return makeLocationError("Browser ini tidak mendukung GPS. Buka link langsung menggunakan Safari terbaru.", "unsupported");
  }
  return null;
}

/**
 * Penting untuk Safari iOS: pemanggilan pertama getCurrentPosition dilakukan langsung
 * dari event tap pengguna. Jangan menaruh await/fetch sebelum pemanggilan ini.
 */
function requestInitialPosition(
  onSuccess: (location: LocationData) => void,
  onError: (error: LocationFailure) => void,
) {
  const readinessError = geolocationReady();
  if (readinessError) {
    onError(readinessError);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    (error) => onError(locationFailureFromBrowser(error)),
    {
      enableHighAccuracy: false,
      timeout: 20_000,
      maximumAge: 30_000,
    },
  );
}

function requestPrecisePosition(
  onSuccess: (location: LocationData) => void,
  onError?: (error: LocationFailure) => void,
) {
  const readinessError = geolocationReady();
  if (readinessError) {
    onError?.(readinessError);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    (error) => onError?.(locationFailureFromBrowser(error)),
    {
      enableHighAccuracy: true,
      timeout: 35_000,
      maximumAge: 0,
    },
  );
}

function permissionLabel(state: PermissionStateValue) {
  if (state === "granted") return "Diizinkan";
  if (state === "denied") return "Ditolak";
  if (state === "prompt") return "Tekan Tes GPS untuk mengizinkan";
  return "Tekan Tes GPS untuk memeriksa";
}

export default function PresensiForm({ token, initialInfo }: Props) {
  const [npm, setNpm] = useState("");
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [permission, setPermission] = useState<PermissionStateValue>("unknown");
  const [locationPreview, setLocationPreview] = useState<LocationData | null>(null);
  const [now, setNow] = useState(Date.now());
  const [detail, setDetail] = useState<{ name?: string; distance?: number | null; accuracy?: number | null } | null>(null);

  const isIOS = useMemo(() => typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent), []);
  const isAndroid = useMemo(() => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingSeconds = Math.max(0, Math.ceil((new Date(initialInfo.endsAt).getTime() - now) / 1000));
  const remainingText = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  function testLocation() {
    if (gpsLoading || loading) return;

    setGpsLoading(true);
    setMessage("Meminta izin lokasi dari Safari…");

    // Panggilan ini sengaja langsung dari event tap untuk kompatibilitas Safari iPhone.
    requestInitialPosition(
      (initial) => {
        setLocationPreview(initial);
        setPermission("granted");
        setGpsLoading(false);
        setMessage(`GPS aktif. Akurasi awal ±${Math.round(initial.accuracy)} meter. Mencoba meningkatkan akurasi…`);

        // Peningkatan akurasi dilakukan setelah izin berhasil. Gagal di tahap ini tidak
        // membatalkan GPS awal yang sudah valid.
        requestPrecisePosition((precise) => {
          setLocationPreview((current) => {
            if (!current || precise.accuracy < current.accuracy) return precise;
            return current;
          });
          setMessage(`GPS siap. Akurasi ±${Math.round(precise.accuracy)} meter.`);
        });
      },
      (failure) => {
        setGpsLoading(false);
        setLocationPreview(null);
        if (failure.reason === "permission") setPermission("denied");
        else setPermission("unknown");
        setMessage(failure.message);
      },
    );
  }

  function kirimPresensi() {
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
    setMessage("Meminta izin lokasi dari perangkat…");

    // Sama seperti Tes GPS: harus dipanggil langsung dari tap pengguna untuk Safari iOS.
    requestInitialPosition(
      (initialLocation) => {
        setPermission("granted");
        setLocationPreview(initialLocation);
        setMessage(`GPS ditemukan (±${Math.round(initialLocation.accuracy)} m). Mengirim presensi…`);

        // Jangan menahan pengiriman terlalu lama. Coba posisi presisi, tetapi bila Safari
        // tidak segera mendapatkannya gunakan posisi awal; server tetap memvalidasi radius.
        let submitted = false;

        const submit = async (location: LocationData) => {
          if (submitted) return;
          submitted = true;
          setLocationPreview(location);

          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 20_000);
          try {
            const response = await fetch(`/api/presensi/${encodeURIComponent(token)}`, {
              method: "POST",
              cache: "no-store",
              credentials: "include",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({
                npm: cleanNpm,
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
              }),
              signal: controller.signal,
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || `Presensi gagal (${response.status}).`);

            setSuccess(true);
            setMessage(result.message || "Presensi berhasil.");
            setDetail({
              name: result.student?.name,
              distance: typeof result.distance === "number" ? result.distance : null,
              accuracy: typeof result.accuracy === "number" ? result.accuracy : null,
            });
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
        };

        // Beri Safari kesempatan singkat untuk mendapatkan koordinat yang lebih presisi.
        const fallbackTimer = window.setTimeout(() => void submit(initialLocation), 2500);
        requestPrecisePosition(
          (precise) => {
            window.clearTimeout(fallbackTimer);
            const best = precise.accuracy <= initialLocation.accuracy ? precise : initialLocation;
            void submit(best);
          },
          () => {
            window.clearTimeout(fallbackTimer);
            void submit(initialLocation);
          },
        );
      },
      (failure) => {
        setLoading(false);
        setLocationPreview(null);
        if (failure.reason === "permission") setPermission("denied");
        else setPermission("unknown");
        setMessage(failure.message);
      },
    );
  }

  return (
    <main className="presensi-production-page">
      <div className="presensi-shell">
        <header className="presensi-hero">
          <div>
            <span className="eyebrow">Presensi Mahasiswa</span>
            <h1>{initialInfo.courseName}</h1>
            <p>{initialInfo.className} · Pertemuan {initialInfo.meetingNo}</p>
          </div>
          <div className={`presensi-timer ${remainingSeconds <= 60 ? "urgent" : ""}`}>
            <small>Sisa sesi</small>
            <strong>{remainingText}</strong>
          </div>
        </header>

        <section className="panel presensi-main-card">
          <div className="panel-body">
            <div className="presensi-session-grid">
              <div><span>Dosen</span><strong>{initialInfo.lecturer}</strong></div>
              <div><span>Jadwal</span><strong>{initialInfo.schedule || "-"}</strong></div>
              <div><span>Lokasi</span><strong>{initialInfo.campusName}</strong></div>
              <div><span>Radius</span><strong>{initialInfo.radiusMeters} meter</strong></div>
            </div>

            <div className="gps-readiness">
              <div>
                <span className={`gps-dot permission-${permission}`} aria-hidden="true" />
                <div>
                  <strong>Izin lokasi: {permissionLabel(permission)}</strong>
                  <small>{locationPreview ? `GPS ±${Math.round(locationPreview.accuracy)} meter` : "Lokasi presisi diperlukan saat mengirim presensi."}</small>
                </div>
              </div>
              {!success && (
                <button type="button" className="btn btn-secondary btn-small" onClick={testLocation} disabled={loading || gpsLoading}>
                  {gpsLoading ? "Meminta GPS…" : "Tes GPS"}
                </button>
              )}
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
                    onChange={(event) => setNpm(event.currentTarget.value.replace(/\s/g, "").slice(0, 32))}
                    placeholder="Masukkan NPM"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={loading}
                    maxLength={32}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") kirimPresensi();
                    }}
                  />
                </div>

                <button type="button" className="btn btn-primary presensi-submit" disabled={loading || remainingSeconds <= 0} onClick={kirimPresensi}>
                  {loading ? "Memeriksa & Mengirim…" : "Kirim Presensi"}
                </button>
              </>
            ) : (
              <div className="presensi-success-card">
                <span className="presensi-success-icon">✓</span>
                <div>
                  <strong>Presensi berhasil</strong>
                  {detail?.name && <span>{detail.name}</span>}
                  <small>
                    {typeof detail?.distance === "number" ? `Jarak ${detail.distance} m` : "Lokasi tervalidasi"}
                    {typeof detail?.accuracy === "number" ? ` · GPS ±${detail.accuracy} m` : ""}
                  </small>
                </div>
              </div>
            )}

            {message && (
              <div className={`presensi-message ${success ? "success" : "info"}`} role="status" aria-live="polite">
                {message}
              </div>
            )}

            {!success && (
              <section className="location-help">
                <h2>Panduan Izin Lokasi</h2>
                <p>Jika GPS ditolak atau tidak presisi, ikuti perangkat Anda. Nama menu dapat sedikit berbeda menurut versi OS.</p>

                <details open={isIOS || permission === "denied"}>
                  <summary>iPhone / iPad · Safari</summary>
                  <ol>
                    <li>Buka <strong>Settings → Privacy & Security → Location Services</strong>, lalu pastikan aktif.</li>
                    <li>Pilih <strong>Safari Websites</strong> (atau pengaturan lokasi Safari), lalu pilih <strong>While Using the App</strong>.</li>
                    <li>Aktifkan <strong>Precise Location</strong>.</li>
                    <li>Kembali ke halaman ini, reload/scan ulang QR, lalu pilih <strong>Allow</strong> saat Safari meminta lokasi.</li>
                    <li>Jika pernah memilih “Don’t Allow”, buka pengaturan situs Safari untuk halaman ini dan ubah Location menjadi <strong>Allow</strong>.</li>
                  </ol>
                </details>

                <details open={isAndroid || permission === "denied"}>
                  <summary>Android · Chrome</summary>
                  <ol>
                    <li>Buka <strong>Settings → Apps → Chrome → Permissions → Location</strong>.</li>
                    <li>Pilih <strong>Allow only while using the app</strong> dan aktifkan <strong>Use precise location</strong>.</li>
                    <li>Di Chrome, buka pengaturan situs halaman AttendanceRecap dan pastikan <strong>Location = Allow</strong>.</li>
                    <li>Nyalakan Location/GPS perangkat, kembali ke halaman ini, lalu tekan <strong>Tes GPS</strong>.</li>
                  </ol>
                </details>

                <div className="location-help-tip">
                  {initialInfo.supportMessage || "Jangan gunakan mode lokasi perkiraan jika akurasi masih terlalu besar. Tunggu beberapa detik agar GPS stabil sebelum menekan Kirim Presensi."}
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
