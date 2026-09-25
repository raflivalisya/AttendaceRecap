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

  requireLocation:
    boolean;

  radiusMeters:
    number;

  campusName:
    string;
};

type LocationData = {
  latitude:
    number;

  longitude:
    number;

  accuracy:
    number;
};

/*
 * ==========================================
 * DEVICE ID
 * ==========================================
 */

function createDeviceId() {
  try {
    if (
      typeof crypto !==
        "undefined" &&
      typeof crypto.randomUUID ===
        "function"
    ) {
      return crypto.randomUUID();
    }

    if (
      typeof crypto !==
        "undefined" &&
      typeof crypto.getRandomValues ===
        "function"
    ) {
      const values =
        new Uint32Array(
          4
        );

      crypto.getRandomValues(
        values
      );

      return Array.from(
        values
      )
        .map(
          (
            value
          ) =>
            value.toString(
              16
            )
        )
        .join(
          "-"
        );
    }
  } catch {
    // fallback
  }

  return (
    Date.now()
      .toString(36) +
    "-" +
    Math.random()
      .toString(36)
      .slice(2) +
    "-" +
    Math.random()
      .toString(36)
      .slice(2)
  );
}

/*
 * ==========================================
 * COOKIE
 * ==========================================
 */

function getCookie(
  name: string
) {
  if (
    typeof document ===
    "undefined"
  ) {
    return null;
  }

  const prefix =
    `${name}=`;

  const cookies =
    document.cookie.split(
      ";"
    );

  for (
    const rawCookie
    of cookies
  ) {
    const cookie =
      rawCookie.trim();

    if (
      cookie.startsWith(
        prefix
      )
    ) {
      try {
        return decodeURIComponent(
          cookie.slice(
            prefix.length
          )
        );
      } catch {
        return cookie.slice(
          prefix.length
        );
      }
    }
  }

  return null;
}

/*
 * ==========================================
 * GET DEVICE ID
 *
 * Cookie + LocalStorage
 * untuk kompatibilitas Safari.
 * ==========================================
 */

function getDeviceId() {
  const key =
    "attendance_device_id";

  /*
   * Cookie dulu.
   */
  const cookieDevice =
    getCookie(
      key
    );

  if (
    cookieDevice
  ) {
    return cookieDevice;
  }

  /*
   * Coba LocalStorage.
   */
  try {
    const stored =
      window.localStorage.getItem(
        key
      );

    if (stored) {
      return stored;
    }
  } catch {
    /*
     * Safari Private Mode
     * bisa membatasi storage.
     */
  }

  /*
   * Generate baru.
   */
  const id =
    createDeviceId();

  /*
   * Simpan localStorage.
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
   * Simpan cookie.
   */
  try {
    document.cookie =
      `${key}=${encodeURIComponent(
        id
      )}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
  } catch {
    // abaikan
  }

  return id;
}

/*
 * ==========================================
 * GPS
 * ==========================================
 */

function getLocation():
  Promise<LocationData> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      if (
        typeof navigator ===
          "undefined" ||
        !navigator.geolocation
      ) {
        reject(
          new Error(
            "Browser tidak mendukung GPS."
          )
        );

        return;
      }

      navigator.geolocation
        .getCurrentPosition(
          (
            position
          ) => {
            resolve({
              latitude:
                position
                  .coords
                  .latitude,

              longitude:
                position
                  .coords
                  .longitude,

              accuracy:
                position
                  .coords
                  .accuracy,
            });
          },

          (
            error
          ) => {
            let message =
              "Lokasi gagal diambil.";

            /*
             * Permission denied.
             */
            if (
              error.code ===
              1
            ) {
              message =
                "Izin lokasi ditolak. Izinkan lokasi untuk Safari/Chrome lalu coba kembali.";
            }

            /*
             * Position unavailable.
             */
            if (
              error.code ===
              2
            ) {
              message =
                "Lokasi perangkat tidak tersedia. Aktifkan GPS lalu coba kembali.";
            }

            /*
             * Timeout.
             */
            if (
              error.code ===
              3
            ) {
              message =
                "Pengambilan lokasi terlalu lama. Pastikan GPS aktif lalu coba kembali.";
            }

            reject(
              new Error(
                message
              )
            );
          },

          {
            enableHighAccuracy:
              true,

            timeout:
              20_000,

            maximumAge:
              0,
          }
        );
    }
  );
}

/*
 * ==========================================
 * COMPONENT
 * ==========================================
 */

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
    deviceId,
    setDeviceId,
  ] =
    useState("");

  const [
    npm,
    setNpm,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState(false);

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
    successDetail,
    setSuccessDetail,
  ] =
    useState<{
      name?:
        string;

      distance?:
        number;

      accuracy?:
        number;
    } | null>(
      null
    );

  /*
   * ========================================
   * INIT DEVICE
   *
   * Dibuat defensif agar Safari iPhone
   * tidak berhenti selamanya.
   * ========================================
   */

  useEffect(() => {
    try {
      const id =
        getDeviceId();

      if (!id) {
        throw new Error(
          "Device ID kosong."
        );
      }

      setDeviceId(
        id
      );
    } catch (error) {
      console.error(
        "DEVICE INIT ERROR:",
        error
      );

      setMessage(
        "Browser gagal menginisialisasi perangkat. Muat ulang halaman lalu coba kembali."
      );

      setLoading(
        false
      );
    }
  }, []);

  /*
   * ========================================
   * VALIDASI QR
   * ========================================
   */

  useEffect(() => {
    if (
      !deviceId
    ) {
      return;
    }

    const controller =
      new AbortController();

    /*
     * Maksimal tunggu validasi
     * 15 detik.
     */
    const timeout =
      window.setTimeout(
        () => {
          controller.abort();
        },
        15_000
      );

    async function validateQr() {
      setLoading(
        true
      );

      setMessage(
        ""
      );

      try {
        if (
          !qrCode
        ) {
          setMessage(
            "QR tidak valid. Scan QR terbaru langsung dari layar dosen."
          );

          return;
        }

        const params =
          new URLSearchParams({
            code:
              qrCode,

            deviceId,
          });

        const response =
          await fetch(
            `/api/presensi/${encodeURIComponent(
              token
            )}?${params.toString()}`,
            {
              cache:
                "no-store",

              signal:
                controller.signal,
            }
          );

        const result =
          await response.json();

        if (
          !response.ok
        ) {
          setMessage(
            result.message ||
              "Presensi tidak tersedia."
          );

          return;
        }

        setInfo(
          result.data
        );

        setTicket(
          result.ticket
        );
      } catch (
        error: any
      ) {
        console.error(
          "QR VALIDATION ERROR:",
          error
        );

        if (
          error?.name ===
          "AbortError"
        ) {
          setMessage(
            "Validasi QR terlalu lama. Periksa koneksi internet dan scan QR terbaru kembali."
          );
        } else {
          setMessage(
            "Gagal memvalidasi QR. Scan QR terbaru lalu coba kembali."
          );
        }
      } finally {
        window.clearTimeout(
          timeout
        );

        setLoading(
          false
        );
      }
    }

    void validateQr();

    return () => {
      window.clearTimeout(
        timeout
      );

      controller.abort();
    };
  }, [
    token,
    qrCode,
    deviceId,
  ]);

  /*
   * ========================================
   * KIRIM PRESENSI
   * ========================================
   */

  async function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (
      !npm.trim()
    ) {
      setMessage(
        "Masukkan NPM terlebih dahulu."
      );

      return;
    }

    if (!ticket) {
      setMessage(
        "Sesi QR sudah tidak valid. Scan QR terbaru kembali."
      );

      return;
    }

    setSending(
      true
    );

    setMessage(
      ""
    );

    setSuccessDetail(
      null
    );

    try {
      /*
       * Minta GPS ketika tombol
       * Kirim Presensi ditekan.
       */
      setMessage(
        "Memeriksa lokasi Anda..."
      );

      const location =
        await getLocation();

      setMessage(
        `Lokasi ditemukan (akurasi ±${Math.round(
          location.accuracy
        )} meter). Mengirim presensi...`
      );

      const controller =
        new AbortController();

      const timeout =
        window.setTimeout(
          () => {
            controller.abort();
          },
          20_000
        );

      try {
        const response =
          await fetch(
            `/api/presensi/${encodeURIComponent(
              token
            )}`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  npm:
                    npm.trim(),

                  deviceId,

                  ticket,

                  latitude:
                    location
                      .latitude,

                  longitude:
                    location
                      .longitude,

                  accuracy:
                    location
                      .accuracy,
                }),

              signal:
                controller.signal,
            }
          );

        const result =
          await response.json();

        setMessage(
          result.message ||
            "Presensi selesai."
        );

        if (
          response.ok
        ) {
          setSuccess(
            true
          );

          setSuccessDetail({
            name:
              result.student
                ?.name,

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
        }
      } finally {
        window.clearTimeout(
          timeout
        );
      }
    } catch (
      error: any
    ) {
      console.error(
        "PRESENSI SUBMIT ERROR:",
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
      setSending(
        false
      );
    }
  }

  /*
   * ========================================
   * LOADING
   * ========================================
   */

  if (loading) {
    return (
      <section className="page">
        <div
          className="shell"
          style={{
            width:
              "100%",

            maxWidth:
              600,

            margin:
              "0 auto",
          }}
        >
          <div className="panel">
            <div className="panel-body">
              Memvalidasi QR...
            </div>
          </div>
        </div>
      </section>
    );
  }

  /*
   * ========================================
   * QR INVALID
   * ========================================
   */

  if (!info) {
    return (
      <section className="page">
        <div
          className="shell"
          style={{
            width:
              "100%",

            maxWidth:
              600,

            margin:
              "0 auto",
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

  /*
   * ========================================
   * FORM
   * ========================================
   */

  return (
    <section className="page">
      <div
        className="shell"
        style={{
          width:
            "100%",

          maxWidth:
            600,

          margin:
            "0 auto",
        }}
      >
        <div className="hero">
          <div>
            <div className="eyebrow">
              Presensi Mahasiswa
            </div>

            <h1>
              {
                info.courseName
              }
            </h1>

            <p>
              Pertemuan{" "}
              {
                info.meetingNo
              }
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body">
            <div
              style={{
                marginBottom:
                  22,
              }}
            >
              <p>
                <strong>
                  Kelas:
                </strong>{" "}
                {
                  info.className
                }
              </p>

              <p>
                <strong>
                  Dosen:
                </strong>{" "}
                {
                  info.lecturer
                }
              </p>

              <p>
                <strong>
                  Jadwal:
                </strong>{" "}
                {
                  info.schedule ||
                  "-"
                }
              </p>

              <div
                style={{
                  marginTop:
                    14,

                  padding:
                    13,

                  borderRadius:
                    10,

                  background:
                    "#f1f5f9",
                }}
              >
                📍{" "}
                <strong>
                  {
                    info.campusName
                  }
                </strong>

                <br />

                GPS wajib • radius maksimal{" "}
                <strong>
                  {
                    info.radiusMeters
                  }{" "}
                  meter
                </strong>
              </div>
            </div>

            {!success ? (
              <form
                onSubmit={
                  submit
                }
              >
                <div className="field">
                  <label>
                    NPM
                  </label>

                  <input
                    className="input"
                    value={
                      npm
                    }
                    onChange={(
                      event
                    ) =>
                      setNpm(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Masukkan NPM"
                    autoComplete="off"
                    inputMode="numeric"
                    disabled={
                      sending
                    }
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    sending
                  }
                  style={{
                    width:
                      "100%",

                    marginTop:
                      16,

                    minHeight:
                      46,
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
                  marginTop:
                    16,
                }}
              >
                <strong>
                  ✓ Presensi berhasil
                </strong>

                {successDetail?.name && (
                  <div
                    style={{
                      marginTop:
                        7,
                    }}
                  >
                    {
                      successDetail.name
                    }
                  </div>
                )}

                {typeof successDetail?.distance ===
                  "number" && (
                  <div
                    style={{
                      marginTop:
                        5,
                    }}
                  >
                    Jarak dari titik kampus:{" "}
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
                  marginTop:
                    16,
                }}
              >
                {
                  message
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}