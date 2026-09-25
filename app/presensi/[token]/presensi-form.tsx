"use client";

import {
  useState,
} from "react";

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

type Props = {
  token: string;
  initialInfo: SessionInfo;
  initialTicket: string;
};

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

/* =====================================================
   DEVICE ID
===================================================== */

function createDeviceId() {
  try {
    if (
      typeof window !== "undefined" &&
      window.crypto
    ) {
      if (
        typeof window.crypto.randomUUID ===
        "function"
      ) {
        return window.crypto.randomUUID();
      }

      if (
        typeof window.crypto.getRandomValues ===
        "function"
      ) {
        const values =
          new Uint32Array(4);

        window.crypto.getRandomValues(
          values
        );

        return Array.from(values)
          .map((value) =>
            value.toString(16)
          )
          .join("-");
      }
    }
  } catch {
    // fallback di bawah
  }

  return (
    Date.now().toString(36) +
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

/* =====================================================
   COOKIE
===================================================== */

function getCookie(
  name: string
) {
  try {
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
  } catch {
    // abaikan
  }

  return null;
}

/* =====================================================
   GET DEVICE ID
===================================================== */

function getDeviceId() {
  const key =
    "attendance_device_id";

  /*
   * Coba cookie.
   */
  try {
    const cookieId =
      getCookie(key);

    if (cookieId) {
      return cookieId;
    }
  } catch {
    // lanjut
  }

  /*
   * Coba localStorage.
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
    // Safari Private Mode bisa membatasi storage.
  }

  /*
   * Generate ID baru.
   */
  const id =
    createDeviceId();

  /*
   * Simpan ke localStorage.
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
   * Simpan ke cookie.
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
          (position) => {
            resolve({
              latitude:
                position.coords
                  .latitude,

              longitude:
                position.coords
                  .longitude,

              accuracy:
                position.coords
                  .accuracy,
            });
          },

          (error) => {
            if (
              error.code ===
              1
            ) {
              reject(
                new Error(
                  "Izin lokasi ditolak. Izinkan akses lokasi pada Safari lalu coba kembali."
                )
              );

              return;
            }

            if (
              error.code ===
              2
            ) {
              reject(
                new Error(
                  "Lokasi tidak tersedia. Aktifkan Location Services lalu coba kembali."
                )
              );

              return;
            }

            if (
              error.code ===
              3
            ) {
              reject(
                new Error(
                  "Pengambilan lokasi terlalu lama. Pastikan GPS aktif lalu coba kembali."
                )
              );

              return;
            }

            reject(
              new Error(
                "Gagal membaca lokasi perangkat."
              )
            );
          },

          {
            enableHighAccuracy:
              true,

            timeout:
              20000,

            maximumAge:
              0,
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
  initialInfo,
  initialTicket,
}: Props) {
  const info =
    initialInfo;

  const ticket =
    initialTicket;

  const [
    npm,
    setNpm,
  ] =
    useState("");

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
    detail,
    setDetail,
  ] =
    useState<{
      name?: string;
      distance?: number;
      accuracy?: number;
    } | null>(
      null
    );

  /* =====================================================
     KIRIM PRESENSI

     Tidak memakai <form>.
     Safari tidak bisa melakukan native submit.
  ===================================================== */

  async function submitPresensi() {
    if (sending) {
      return;
    }

    const cleanNpm =
      npm.trim();

    if (!cleanNpm) {
      setMessage(
        "Masukkan NPM terlebih dahulu."
      );

      return;
    }

    if (!ticket) {
      setMessage(
        "Ticket presensi tidak tersedia. Scan QR terbaru kembali."
      );

      return;
    }

    setSending(true);
    setSuccess(false);
    setDetail(null);

    try {
      /* ==============================
         DEVICE ID
      ============================== */

      setMessage(
        "Menyiapkan perangkat..."
      );

      const deviceId =
        getDeviceId();

      if (!deviceId) {
        throw new Error(
          "Identitas perangkat gagal dibuat."
        );
      }

      /* ==============================
         GPS
      ============================== */

      setMessage(
        "Meminta lokasi GPS..."
      );

      const location =
        await getLocation();

      setMessage(
        `Lokasi ditemukan. Akurasi ±${Math.round(
          location.accuracy
        )} meter.`
      );

      /* ==============================
         REQUEST
      ============================== */

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
              method:
                "POST",

              cache:
                "no-store",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json",
              },

              body:
                JSON.stringify({
                  npm:
                    cleanNpm,

                  ticket,

                  deviceId,

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

        /*
         * Baca text dahulu.
         * Lebih aman di Safari.
         */
        const responseText =
          await response.text();

        let result:
          any = {};

        try {
          result =
            JSON.parse(
              responseText
            );
        } catch {
          console.error(
            "RAW RESPONSE:",
            responseText
          );

          throw new Error(
            "Server memberikan respons yang tidak valid."
          );
        }

        console.log(
          "PRESENSI RESPONSE:",
          response.status,
          result
        );

        if (!response.ok) {
          throw new Error(
            result.message ||
              `Presensi gagal (${response.status}).`
          );
        }

        /* ==============================
           SUCCESS
        ============================== */

        setSuccess(true);

        setMessage(
          result.message ||
            "Presensi berhasil."
        );

        setDetail({
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
      } finally {
        window.clearTimeout(
          timeout
        );
      }
    } catch (
      error: any
    ) {
      console.error(
        "PRESENSI ERROR:",
        error
      );

      if (
        error?.name ===
        "AbortError"
      ) {
        setMessage(
          "Server terlalu lama merespons. Periksa koneksi internet lalu coba kembali."
        );
      } else {
        setMessage(
          error?.message ||
            "Presensi gagal."
        );
      }
    } finally {
      setSending(false);
    }
  }

  /* =====================================================
     UI
  ===================================================== */

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
        {/* ==============================
            HEADER
        ============================== */}

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

        {/* ==============================
            PANEL
        ============================== */}

        <div className="panel">
          <div className="panel-body">

            {/* ==========================
                INFORMASI
            ========================== */}

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
                {info.schedule ||
                  "-"}
              </p>

              <div
                style={{
                  marginTop:
                    14,

                  padding:
                    14,

                  borderRadius:
                    10,

                  background:
                    "#f1f5f9",
                }}
              >
                📍{" "}
                <strong>
                  {info.campusName}
                </strong>

                <br />

                Lokasi GPS wajib

                <br />

                Radius maksimal{" "}
                <strong>
                  {
                    info.radiusMeters
                  }{" "}
                  meter
                </strong>
              </div>
            </div>

            {/* ==========================
                INPUT
            ========================== */}

            {!success && (
              <>
                <div className="field">
                  <label
                    htmlFor="npm"
                  >
                    NPM
                  </label>

                  <input
                    id="npm"

                    type="text"

                    className="input"

                    value={npm}

                    onChange={(
                      event
                    ) => {
                      setNpm(
                        event.target.value
                      );
                    }}

                    placeholder="Masukkan NPM"

                    autoComplete="off"

                    inputMode="numeric"

                    enterKeyHint="done"

                    disabled={
                      sending
                    }

                    style={{
                      fontSize:
                        16,
                    }}
                  />
                </div>

                {/* ======================
                    BUKAN submit button
                ====================== */}

                <button
                  type="button"

                  className="btn btn-primary"

                  disabled={
                    sending
                  }

                  onClick={() => {
                    void submitPresensi();
                  }}

                  style={{
                    width:
                      "100%",

                    marginTop:
                      16,

                    minHeight:
                      48,

                    touchAction:
                      "manipulation",
                  }}
                >
                  {sending
                    ? "Memeriksa..."
                    : "Kirim Presensi"}
                </button>
              </>
            )}

            {/* ==========================
                SUCCESS
            ========================== */}

            {success && (
              <div
                className="success"
                style={{
                  padding:
                    16,

                  marginTop:
                    16,

                  borderRadius:
                    10,
                }}
              >
                <strong>
                  ✓ Presensi Berhasil
                </strong>

                {detail?.name && (
                  <div
                    style={{
                      marginTop:
                        8,
                    }}
                  >
                    {detail.name}
                  </div>
                )}

                {typeof detail?.distance ===
                  "number" && (
                  <div
                    style={{
                      marginTop:
                        6,
                    }}
                  >
                    Jarak dari kampus:{" "}
                    {
                      detail.distance
                    }{" "}
                    meter
                  </div>
                )}

                {typeof detail?.accuracy ===
                  "number" && (
                  <div
                    style={{
                      marginTop:
                        3,
                    }}
                  >
                    Akurasi GPS: ±
                    {
                      detail.accuracy
                    }{" "}
                    meter
                  </div>
                )}
              </div>
            )}

            {/* ==========================
                MESSAGE
            ========================== */}

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

                  padding:
                    12,

                  borderRadius:
                    8,
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