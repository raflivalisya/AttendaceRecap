"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

type Props = {
  token: string;
  qrCode: string;
};

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
};

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

/* =====================================================
   DEVICE ID
===================================================== */

function createRandomDeviceId() {
  try {
    if (
      typeof window !== "undefined" &&
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    if (
      typeof window !== "undefined" &&
      window.crypto &&
      typeof window.crypto.getRandomValues === "function"
    ) {
      const values = new Uint32Array(4);

      window.crypto.getRandomValues(values);

      return Array.from(values)
        .map((value) => value.toString(16))
        .join("-");
    }
  } catch {
    // gunakan fallback
  }

  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}

function getCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const target =
    `${name}=`;

  const cookies =
    document.cookie.split(";");

  for (const rawCookie of cookies) {
    const cookie =
      rawCookie.trim();

    if (cookie.startsWith(target)) {
      try {
        return decodeURIComponent(
          cookie.substring(target.length)
        );
      } catch {
        return cookie.substring(
          target.length
        );
      }
    }
  }

  return null;
}

function getDeviceId() {
  const key =
    "attendance_device_id";

  /*
   * 1. Cookie
   */
  try {
    const cookieValue =
      getCookie(key);

    if (cookieValue) {
      return cookieValue;
    }
  } catch {
    // lanjut
  }

  /*
   * 2. LocalStorage
   */
  try {
    const stored =
      window.localStorage.getItem(key);

    if (stored) {
      return stored;
    }
  } catch {
    // Safari/private mode
  }

  /*
   * 3. Generate ID baru
   */
  const id =
    createRandomDeviceId();

  /*
   * Simpan ke LocalStorage
   */
  try {
    window.localStorage.setItem(
      key,
      id
    );
  } catch {
    // abaikan
  }

  /*
   * Simpan juga ke cookie
   */
  try {
    document.cookie =
      `${key}=${encodeURIComponent(id)}; ` +
      `Max-Age=31536000; ` +
      `Path=/; ` +
      `SameSite=Lax; ` +
      `Secure`;
  } catch {
    // abaikan
  }

  return id;
}

/* =====================================================
   GPS
===================================================== */

function getLocation(): Promise<LocationData> {
  return new Promise(
    (resolve, reject) => {
      if (
        typeof navigator === "undefined" ||
        !navigator.geolocation
      ) {
        reject(
          new Error(
            "Browser tidak mendukung GPS."
          )
        );

        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude:
              position.coords.latitude,

            longitude:
              position.coords.longitude,

            accuracy:
              position.coords.accuracy,
          });
        },

        (error) => {
          if (error.code === 1) {
            reject(
              new Error(
                "Izin lokasi ditolak. Izinkan akses lokasi pada browser lalu coba kembali."
              )
            );

            return;
          }

          if (error.code === 2) {
            reject(
              new Error(
                "Lokasi tidak tersedia. Aktifkan GPS lalu coba kembali."
              )
            );

            return;
          }

          if (error.code === 3) {
            reject(
              new Error(
                "Pengambilan lokasi terlalu lama. Pastikan GPS aktif lalu coba kembali."
              )
            );

            return;
          }

          reject(
            new Error(
              "Gagal mengambil lokasi."
            )
          );
        },

        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      );
    }
  );
}

/* =====================================================
   COMPONENT
===================================================== */

export default function PresensiForm({
  token,
  qrCode,
}: Props) {
  const [
    info,
    setInfo,
  ] =
    useState<SessionInfo | null>(
      null
    );

  const [
    ticket,
    setTicket,
  ] =
    useState("");

  const [
    npm,
    setNpm,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    sending,
    setSending,
  ] =
    useState(false);

  const [
    success,
    setSuccess,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    successDetail,
    setSuccessDetail,
  ] =
    useState<{
      name?: string;
      distance?: number;
      accuracy?: number;
    } | null>(null);

  /* =====================================================
     VALIDASI QR

     PERUBAHAN UTAMA:
     Tidak membutuhkan deviceId.
  ===================================================== */

  useEffect(() => {
    let mounted = true;

    const controller =
      new AbortController();

    const timeout =
      window.setTimeout(
        () => {
          controller.abort();
        },
        15000
      );

    async function validateQr() {
      setLoading(true);
      setMessage("");

      try {
        if (!qrCode) {
          if (mounted) {
            setMessage(
              "QR tidak valid. Scan QR terbaru dari layar dosen."
            );
          }

          return;
        }

        const params =
          new URLSearchParams({
            code: qrCode,
          });

        const response =
          await fetch(
            `/api/presensi/${encodeURIComponent(
              token
            )}?${params.toString()}`,
            {
              method: "GET",

              cache: "no-store",

              headers: {
                Accept:
                  "application/json",
              },

              signal:
                controller.signal,
            }
          );

        const text =
          await response.text();

        let result: any = {};

        try {
          result =
            JSON.parse(text);
        } catch {
          throw new Error(
            "Response server tidak valid."
          );
        }

        if (!response.ok) {
          throw new Error(
            result.message ||
              "QR tidak dapat divalidasi."
          );
        }

        if (!mounted) {
          return;
        }

        setInfo(
          result.data
        );

        setTicket(
          result.ticket
        );
      } catch (error: any) {
        console.error(
          "QR VALIDATION ERROR:",
          error
        );

        if (!mounted) {
          return;
        }

        if (
          error?.name ===
          "AbortError"
        ) {
          setMessage(
            "Validasi QR terlalu lama. Periksa koneksi internet lalu scan QR terbaru."
          );
        } else {
          setMessage(
            error?.message ||
              "Gagal memvalidasi QR."
          );
        }
      } finally {
        window.clearTimeout(
          timeout
        );

        if (mounted) {
          setLoading(false);
        }
      }
    }

    void validateQr();

    /*
     * Watchdog tambahan.
     *
     * Walaupun Safari bermasalah,
     * loading tidak boleh selamanya.
     */
    const watchdog =
      window.setTimeout(
        () => {
          if (mounted) {
            setLoading(false);

            setMessage(
              (current) =>
                current ||
                "Validasi QR gagal diselesaikan. Scan QR terbaru dan coba kembali."
            );
          }
        },
        18000
      );

    return () => {
      mounted = false;

      controller.abort();

      window.clearTimeout(
        timeout
      );

      window.clearTimeout(
        watchdog
      );
    };
  }, [
    token,
    qrCode,
  ]);

  /* =====================================================
     KIRIM PRESENSI
  ===================================================== */

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!npm.trim()) {
      setMessage(
        "Masukkan NPM terlebih dahulu."
      );

      return;
    }

    if (!ticket) {
      setMessage(
        "Session QR sudah tidak valid. Scan QR terbaru kembali."
      );

      return;
    }

    setSending(true);
    setSuccess(false);
    setSuccessDetail(null);
    setMessage(
      "Menyiapkan perangkat..."
    );

    try {
      /*
       * DEVICE ID BARU DIBUAT DI SINI.
       *
       * Jadi Safari tidak bisa lagi
       * menghambat halaman validasi QR.
       */
      const deviceId =
        getDeviceId();

      if (!deviceId) {
        throw new Error(
          "Gagal membuat identitas perangkat."
        );
      }

      /*
       * Ambil GPS mahasiswa.
       */
      setMessage(
        "Memeriksa lokasi Anda..."
      );

      const location =
        await getLocation();

      setMessage(
        `Lokasi ditemukan dengan akurasi ±${Math.round(
          location.accuracy
        )} meter. Mengirim presensi...`
      );

      const controller =
        new AbortController();

      const timeout =
        window.setTimeout(
          () => {
            controller.abort();
          },
          20000
        );

      try {
        const response =
          await fetch(
            `/api/presensi/${encodeURIComponent(
              token
            )}`,
            {
              method: "POST",

              cache: "no-store",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json",
              },

              body:
                JSON.stringify({
                  npm:
                    npm.trim(),

                  deviceId,

                  ticket,

                  latitude:
                    location.latitude,

                  longitude:
                    location.longitude,

                  accuracy:
                    location.accuracy,
                }),

              signal:
                controller.signal,
            }
          );

        const text =
          await response.text();

        let result: any = {};

        try {
          result =
            JSON.parse(text);
        } catch {
          throw new Error(
            "Response server tidak valid."
          );
        }

        if (!response.ok) {
          throw new Error(
            result.message ||
              "Presensi gagal."
          );
        }

        setSuccess(true);

        setMessage(
          result.message ||
            "Presensi berhasil."
        );

        setSuccessDetail({
          name:
            result.student?.name,

          distance:
            typeof result.distance ===
            "number"
              ? result.distance
              : undefined,

          accuracy:
            typeof result.accuracy ===
            "number"
              ? result.accuracy
              : undefined,
        });
      } finally {
        window.clearTimeout(
          timeout
        );
      }
    } catch (error: any) {
      console.error(
        "SUBMIT PRESENSI ERROR:",
        error
      );

      if (
        error?.name ===
        "AbortError"
      ) {
        setMessage(
          "Pengiriman terlalu lama. Periksa koneksi internet lalu coba kembali."
        );
      } else {
        setMessage(
          error?.message ||
            "Gagal mengirim presensi."
        );
      }
    } finally {
      setSending(false);
    }
  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <section className="page">
        <div
          className="shell"
          style={{
            width: "100%",
            maxWidth: 600,
            margin: "0 auto",
          }}
        >
          <div className="panel">
            <div className="panel-body">
              <h2>
                Memvalidasi QR...
              </h2>

              <p className="muted">
                Mohon tunggu sebentar.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* =====================================================
     QR GAGAL
  ===================================================== */

  if (!info) {
    return (
      <section className="page">
        <div
          className="shell"
          style={{
            width: "100%",
            maxWidth: 600,
            margin: "0 auto",
          }}
        >
          <div className="panel">
            <div className="panel-body">
              <h2>
                Presensi Tidak Tersedia
              </h2>

              <p>
                {message ||
                  "QR tidak dapat divalidasi."}
              </p>

              <p className="muted">
                Scan QR terbaru yang sedang
                tampil di layar dosen.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* =====================================================
     FORM PRESENSI
  ===================================================== */

  return (
    <section className="page">
      <div
        className="shell"
        style={{
          width: "100%",
          maxWidth: 600,
          margin: "0 auto",
        }}
      >
        <div className="hero">
          <div>
            <div className="eyebrow">
              Presensi Mahasiswa
            </div>

            <h1>
              {info.courseName}
            </h1>

            <p>
              Pertemuan{" "}
              {info.meetingNo}
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body">

            <div
              style={{
                marginBottom: 22,
              }}
            >
              <p>
                <strong>
                  Kelas:
                </strong>{" "}
                {info.className}
              </p>

              <p>
                <strong>
                  Dosen:
                </strong>{" "}
                {info.lecturer}
              </p>

              <p>
                <strong>
                  Jadwal:
                </strong>{" "}
                {info.schedule || "-"}
              </p>

              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 10,
                  background: "#f1f5f9",
                }}
              >
                📍{" "}
                <strong>
                  {info.campusName}
                </strong>

                <br />

                GPS wajib

                <br />

                Radius maksimal{" "}
                <strong>
                  {info.radiusMeters} meter
                </strong>
              </div>
            </div>

            {!success ? (
              <form
                onSubmit={submit}
              >
                <div className="field">
                  <label>
                    NPM
                  </label>

                  <input
                    className="input"

                    value={npm}

                    onChange={(event) =>
                      setNpm(
                        event.target.value
                      )
                    }

                    placeholder="Masukkan NPM"

                    autoComplete="off"

                    inputMode="numeric"

                    disabled={sending}
                  />
                </div>

                <button
                  type="submit"

                  className="btn btn-primary"

                  disabled={sending}

                  style={{
                    width: "100%",
                    minHeight: 48,
                    marginTop: 16,
                  }}
                >
                  {sending
                    ? "Memeriksa..."
                    : "Kirim Presensi"}
                </button>
              </form>
            ) : (
              <div
                className="success"
                style={{
                  marginTop: 16,
                  padding: 16,
                }}
              >
                <strong>
                  ✓ Presensi berhasil
                </strong>

                {successDetail?.name && (
                  <div
                    style={{
                      marginTop: 8,
                    }}
                  >
                    {successDetail.name}
                  </div>
                )}

                {typeof successDetail?.distance ===
                  "number" && (
                  <div
                    style={{
                      marginTop: 5,
                    }}
                  >
                    Jarak dari kampus:{" "}
                    {
                      successDetail.distance
                    }{" "}
                    meter
                  </div>
                )}

                {typeof successDetail?.accuracy ===
                  "number" && (
                  <div>
                    Akurasi GPS: ±
                    {
                      successDetail.accuracy
                    }{" "}
                    meter
                  </div>
                )}
              </div>
            )}

            {message && (
              <div
                className={
                  success
                    ? "success"
                    : "error"
                }
                style={{
                  marginTop: 16,
                }}
              >
                {message}
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
}