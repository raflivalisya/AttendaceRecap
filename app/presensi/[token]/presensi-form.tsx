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
};

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

function getDeviceId() {
  const key =
    "attendance_device_id";

  let id =
    localStorage.getItem(
      key
    );

  if (!id) {
    id =
      crypto.randomUUID();

    localStorage.setItem(
      key,
      id
    );
  }

  return id;
}

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

  useEffect(() => {
    setDeviceId(
      getDeviceId()
    );
  }, []);

  useEffect(() => {
    if (!deviceId) {
      return;
    }

    async function validateQr() {
      try {
        if (!qrCode) {
          setMessage(
            "QR tidak valid. Scan QR dari layar dosen."
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
            `/api/presensi/${token}?${params.toString()}`,
            {
              cache:
                "no-store",
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
      } catch {
        setMessage(
          "Gagal memvalidasi QR."
        );
      } finally {
        setLoading(
          false
        );
      }
    }

    validateQr();
  }, [
    token,
    qrCode,
    deviceId,
  ]);

  function getLocation():
    Promise<LocationData> {
    return new Promise(
      (
        resolve,
        reject
      ) => {
        if (
          !navigator
            .geolocation
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

            () => {
              reject(
                new Error(
                  "Lokasi gagal diambil. Aktifkan GPS dan izinkan akses lokasi pada browser."
                )
              );
            },

            {
              enableHighAccuracy:
                true,

              timeout:
                15000,

              maximumAge:
                0,
            }
          );
      }
    );
  }

  async function submit(
    event: FormEvent
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
        "Sesi QR sudah tidak valid. Scan ulang QR."
      );

      return;
    }

    setSending(true);
    setMessage("");

    try {
      let location:
        | LocationData
        | null = null;

      if (
        info
          ?.requireLocation
      ) {
        setMessage(
          "Memeriksa lokasi..."
        );

        location =
          await getLocation();
      }

      const response =
        await fetch(
          `/api/presensi/${token}`,
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
                    ?.latitude,

                longitude:
                  location
                    ?.longitude,

                accuracy:
                  location
                    ?.accuracy,
              }),
          }
        );

      const result =
        await response.json();

      setMessage(
        result.message
      );

      if (
        response.ok
      ) {
        setSuccess(
          true
        );
      }
    } catch (
      error: any
    ) {
      setMessage(
        error?.message ||
          "Gagal mengirim presensi."
      );
    } finally {
      setSending(
        false
      );
    }
  }

  if (loading) {
    return (
      <section className="page">
        <div
          className="shell"
          style={{
            maxWidth:
              600,
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

  if (!info) {
    return (
      <section className="page">
        <div
          className="shell"
          style={{
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
                {message}
              </p>

              <p
                className="muted"
              >
                Scan QR terbaru
                yang tampil di
                layar dosen.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
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
                marginBottom:
                  24,
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

              {info.requireLocation && (
                <div
                  style={{
                    marginTop:
                      14,

                    padding:
                      12,

                    borderRadius:
                      8,

                    background:
                      "#f1f5f9",
                  }}
                >
                  📍 Presensi ini
                  menggunakan
                  verifikasi lokasi.

                  <br />

                  Radius maksimal:{" "}
                  <strong>
                    {
                      info.radiusMeters
                    }{" "}
                    meter
                  </strong>
                </div>
              )}
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
                      e
                    ) =>
                      setNpm(
                        e
                          .target
                          .value
                      )
                    }
                    placeholder="Masukkan NPM"
                    autoComplete="off"
                    inputMode="numeric"
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
                ✓ Presensi
                berhasil.
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
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}