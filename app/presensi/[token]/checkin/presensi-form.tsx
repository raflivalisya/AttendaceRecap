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
};

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

function readLocation():
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
            "Browser tidak mendukung akses lokasi."
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
              error.PERMISSION_DENIED
            ) {
              reject(
                new Error(
                  "Izin lokasi ditolak. Aktifkan Location Services dan izinkan Safari menggunakan lokasi."
                )
              );

              return;
            }

            if (
              error.code ===
              error.POSITION_UNAVAILABLE
            ) {
              reject(
                new Error(
                  "Lokasi tidak tersedia. Pastikan GPS aktif."
                )
              );

              return;
            }

            if (
              error.code ===
              error.TIMEOUT
            ) {
              reject(
                new Error(
                  "GPS terlalu lama merespons. Coba kembali."
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

export default function PresensiForm({
  token,
  initialInfo,
}: Props) {
  const [
    npm,
    setNpm,
  ] =
    useState("");

  const [
    loading,
    setLoading,
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

  async function kirimPresensi() {
    if (
      loading
    ) {
      return;
    }

    const cleanNpm =
      npm.trim();

    if (
      !cleanNpm
    ) {
      setMessage(
        "Masukkan NPM terlebih dahulu."
      );

      return;
    }

    setLoading(
      true
    );

    setSuccess(
      false
    );

    setDetail(
      null
    );

    try {
      /*
       * ====================================
       * GPS
       * ====================================
       */

      setMessage(
        "Meminta lokasi GPS..."
      );

      const location =
        await readLocation();

      setMessage(
        `Lokasi ditemukan. Akurasi ±${Math.round(
          location.accuracy
        )} meter. Mengirim presensi...`
      );

      /*
       * ====================================
       * SEND
       * ====================================
       */

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

              /*
               * WAJIB agar Safari
               * mengirim HttpOnly cookie.
               */
              credentials:
                "include",

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

        const raw =
          await response.text();

        let result:
          any = {};

        try {
          result =
            JSON.parse(
              raw
            );
        } catch {
          console.error(
            "SERVER RESPONSE:",
            raw
          );

          throw new Error(
            "Respons server tidak valid."
          );
        }

        if (
          !response.ok
        ) {
          throw new Error(
            result.message ||
              `Presensi gagal (${response.status}).`
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
          "Server terlalu lama merespons. Coba kembali."
        );
      } else {
        setMessage(
          error?.message ||
            "Presensi gagal."
        );
      }
    } finally {
      setLoading(
        false
      );
    }
  }

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
                initialInfo.courseName
              }
            </h1>

            <p>
              Pertemuan{" "}
              {
                initialInfo.meetingNo
              }
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body">

            <p>
              <strong>
                Kelas:
              </strong>{" "}
              {
                initialInfo.className
              }
            </p>

            <p>
              <strong>
                Dosen:
              </strong>{" "}
              {
                initialInfo.lecturer
              }
            </p>

            <div
              style={{
                marginTop:
                  14,

                marginBottom:
                  20,

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
                Universitas Teknokrat Indonesia
              </strong>

              <br />

              Radius maksimal{" "}

              {
                initialInfo.radiusMeters
              }{" "}

              meter
            </div>

            {!success && (
              <>
                <div className="field">
                  <label
                    htmlFor="student-npm"
                  >
                    NPM
                  </label>

                  <input
                    id="student-npm"

                    type="text"

                    className="input"

                    value={
                      npm
                    }

                    onChange={(
                      event
                    ) => {
                      setNpm(
                        event.currentTarget.value
                      );
                    }}

                    placeholder="Masukkan NPM"

                    inputMode="numeric"

                    autoComplete="off"

                    disabled={
                      loading
                    }

                    style={{
                      fontSize:
                        16,
                    }}
                  />
                </div>

                <button
                  type="button"

                  className="btn btn-primary"

                  disabled={
                    loading
                  }

                  onClick={() => {
                    void kirimPresensi();
                  }}

                  style={{
                    display:
                      "block",

                    width:
                      "100%",

                    minHeight:
                      52,

                    marginTop:
                      16,

                    cursor:
                      "pointer",

                    touchAction:
                      "manipulation",

                    WebkitAppearance:
                      "none",
                  }}
                >
                  {loading
                    ? "Memeriksa..."
                    : "Kirim Presensi"}
                </button>
              </>
            )}

            {success && (
              <div
                className="success"

                style={{
                  marginTop:
                    16,

                  padding:
                    16,

                  borderRadius:
                    10,
                }}
              >
                <strong>
                  ✓ Presensi berhasil
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
                  <div>
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

                  padding:
                    12,

                  borderRadius:
                    8,
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