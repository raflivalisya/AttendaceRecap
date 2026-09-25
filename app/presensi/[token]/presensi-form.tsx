"use client";

import {
  FormEvent,
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

  radiusMeters:
    number;

  campusName:
    string;
};

type Props = {
  token:
    string;

  initialInfo:
    SessionInfo;

  initialTicket:
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

/* =====================================================
   DEVICE ID
===================================================== */

function createDeviceId() {
  try {
    if (
      typeof window !==
        "undefined" &&
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
          new Uint32Array(
            4
          );

        window.crypto
          .getRandomValues(
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
        return decodeURIComponent(
          cookie.slice(
            prefix.length
          )
        );
      }
    }
  } catch {
    return null;
  }

  return null;
}

/* =====================================================
   DEVICE
===================================================== */

function getDeviceId() {
  const key =
    "attendance_device_id";

  /*
   * 1. Cookie
   */
  try {
    const cookie =
      getCookie(
        key
      );

    if (cookie) {
      return cookie;
    }
  } catch {
    // lanjut
  }

  /*
   * 2. LocalStorage
   */
  try {
    const stored =
      window.localStorage
        .getItem(
          key
        );

    if (stored) {
      return stored;
    }
  } catch {
    // Safari Private
  }

  /*
   * 3. Baru
   */
  const id =
    createDeviceId();

  /*
   * LocalStorage.
   */
  try {
    window.localStorage
      .setItem(
        key,
        id
      );
  } catch {
    // abaikan
  }

  /*
   * Cookie.
   */
  try {
    document.cookie =
      `${key}=${encodeURIComponent(
        id
      )}; ` +
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
            if (
              error.code ===
              1
            ) {
              reject(
                new Error(
                  "Izin lokasi ditolak. Izinkan lokasi pada Safari lalu coba lagi."
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
                  "Lokasi tidak tersedia. Aktifkan Location Services lalu coba lagi."
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
                  "GPS terlalu lama merespons. Coba pindah ke area yang lebih terbuka lalu ulangi."
                )
              );

              return;
            }

            reject(
              new Error(
                "Gagal membaca lokasi."
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
      name?:
        string;

      distance?:
        number;

      accuracy?:
        number;
    } | null>(
      null
    );

  /* =====================================================
     SUBMIT
  ===================================================== */

  async function submit(
    event:
      FormEvent<HTMLFormElement>
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

    setSending(
      true
    );

    setSuccess(
      false
    );

    setDetail(
      null
    );

    setMessage(
      "Menyiapkan perangkat..."
    );

    try {
      /*
       * Device ID hanya dibuat
       * setelah tombol diklik.
       */
      const deviceId =
        getDeviceId();

      if (
        !deviceId
      ) {
        throw new Error(
          "Gagal membuat identitas perangkat."
        );
      }

      /*
       * GPS.
       */
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

      /*
       * Request timeout.
       */
      const controller =
        new AbortController();

      const timeout =
        window.setTimeout(
          () =>
            controller.abort(),
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
                    npm.trim(),

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

        const text =
          await response.text();

        let result:
          any;

        try {
          result =
            JSON.parse(
              text
            );
        } catch {
          throw new Error(
            "Server memberikan response yang tidak valid."
          );
        }

        if (
          !response.ok
        ) {
          throw new Error(
            result.message ||
              "Presensi gagal."
          );
        }

        setSuccess(
          true
        );

        setMessage(
          result.message ||
            "Presensi berhasil."
        );

        setDetail({
          name:
            result.student
              ?.name,

          distance:
            result.distance,

          accuracy:
            result.accuracy,
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
          "Server terlalu lama merespons. Periksa koneksi internet."
        );
      } else {
        setMessage(
          error?.message ||
            "Presensi gagal."
        );
      }
    } finally {
      setSending(
        false
      );
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
                    14,

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
                      48,
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
                  padding:
                    16,

                  marginTop:
                    16,
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
                    {
                      detail.name
                    }
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
                  <div>
                    Akurasi GPS: ±
                    {
                      detail.accuracy
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