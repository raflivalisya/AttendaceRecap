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

function createDeviceId() {
  try {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        "function"
    ) {
      return window.crypto.randomUUID();
    }

    if (
      window.crypto &&
      typeof window.crypto.getRandomValues ===
        "function"
    ) {
      const values =
        new Uint32Array(4);

      window.crypto
        .getRandomValues(
          values
        );

      return Array.from(
        values
      )
        .map(
          (value) =>
            value.toString(16)
        )
        .join("-");
    }
  } catch {
    // fallback
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

function getDeviceId() {
  const key =
    "attendance_device_id";

  try {
    const stored =
      window.localStorage
        .getItem(key);

    if (stored) {
      return stored;
    }
  } catch {
    // Safari
  }

  const id =
    createDeviceId();

  try {
    window.localStorage
      .setItem(
        key,
        id
      );
  } catch {
    // abaikan
  }

  return id;
}

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
            "Browser tidak mendukung lokasi GPS."
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

          (
            error
          ) => {
            if (
              error.code ===
              1
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
              2
            ) {
              reject(
                new Error(
                  "Lokasi tidak tersedia. Aktifkan GPS."
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

  async function submitPresensi() {
    if (
      sending
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

    setSending(true);
    setSuccess(false);
    setDetail(null);

    try {
      const deviceId =
        getDeviceId();

      setMessage(
        "Memeriksa lokasi..."
      );

      const location =
        await getLocation();

      setMessage(
        `Lokasi ditemukan. Akurasi ±${Math.round(
          location.accuracy
        )} meter.`
      );

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
             * Explicit supaya cookie
             * dikirim pada Safari.
             */
            credentials:
              "same-origin",

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

                deviceId,

                latitude:
                  location.latitude,

                longitude:
                  location.longitude,

                accuracy:
                  location.accuracy,
              }),
          }
        );

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
        throw new Error(
          "Response server tidak valid."
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

      setSuccess(true);

      setMessage(
        result.message
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
    } catch (
      error: any
    ) {
      console.error(
        error
      );

      setMessage(
        error?.message ||
          "Presensi gagal."
      );
    } finally {
      setSending(false);
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
                padding:
                  14,

                marginTop:
                  14,

                marginBottom:
                  20,

                background:
                  "#f1f5f9",

                borderRadius:
                  10,
              }}
            >
              📍{" "}
              <strong>
                Universitas Teknokrat Indonesia
              </strong>

              <br />

              Radius{" "}
              {
                initialInfo.radiusMeters
              }{" "}
              meter
            </div>

            {!success && (
              <>
                <div className="field">
                  <label>
                    NPM
                  </label>

                  <input
                    type="text"

                    className="input"

                    value={npm}

                    onChange={(
                      event
                    ) =>
                      setNpm(
                        event.target.value
                      )
                    }

                    inputMode="numeric"

                    autoComplete="off"

                    disabled={
                      sending
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

                  onClick={() => {
                    void submitPresensi();
                  }}

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
                }}
              >
                <strong>
                  ✓ Presensi berhasil
                </strong>

                {detail?.name && (
                  <div>
                    {
                      detail.name
                    }
                  </div>
                )}

                {typeof detail?.distance ===
                  "number" && (
                  <div>
                    Jarak:{" "}
                    {
                      detail.distance
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
                    15,

                  padding:
                    12,
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