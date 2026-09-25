"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  QRCodeSVG,
} from "qrcode.react";

import {
  createClient,
} from "@/lib/supabase/client";

type Props = {
  meetingId: string;
  meetingNo: number;
  courseName: string;
  classLabel: string;
};

type Session = {
  id: string;
  token: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;

  latitude:
    | number
    | null;

  longitude:
    | number
    | null;

  radius_meters: number;
  require_location: boolean;
};

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export default function AttendanceQR({
  meetingId,
  meetingNo,
  courseName,
  classLabel,
}: Props) {
  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const [
    session,
    setSession,
  ] =
    useState<Session | null>(
      null
    );

  const [
    duration,
    setDuration,
  ] =
    useState(15);

  const [
    radius,
    setRadius,
  ] =
    useState(200);

  const [
    requireLocation,
    setRequireLocation,
  ] =
    useState(true);

  const [
    qrCode,
    setQrCode,
  ] =
    useState("");

  const [
    qrExpiresAt,
    setQrExpiresAt,
  ] =
    useState(0);

  const [
    now,
    setNow,
  ] =
    useState(Date.now());

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  useEffect(() => {
    loadSession();
  }, [meetingId]);

  useEffect(() => {
    const timer =
      setInterval(() => {
        setNow(
          Date.now()
        );
      }, 1000);

    return () =>
      clearInterval(
        timer
      );
  }, []);

  /*
   * AUTO REFRESH QR
   * setiap 30 detik.
   */
  useEffect(() => {
    if (!session?.id) {
      setQrCode("");
      return;
    }

    let cancelled =
      false;

    async function fetchQr() {
      try {
        const response =
          await fetch(
            `/api/admin/presensi/qr?sessionId=${session?.id}`,
            {
              cache:
                "no-store",
            }
          );

        const result =
          await response.json();

        if (
          cancelled
        ) {
          return;
        }

        if (
          !response.ok
        ) {
          setMessage(
            result.message ||
              "Gagal membuat QR."
          );

          if (
            response.status ===
            410
          ) {
            setSession(
              null
            );
          }

          return;
        }

        setQrCode(
          result.code
        );

        setQrExpiresAt(
          result.expiresAt
        );
      } catch {
        setMessage(
          "Gagal memperbarui QR."
        );
      }
    }

    fetchQr();

    const interval =
      setInterval(
        fetchQr,
        30_000
      );

    return () => {
      cancelled = true;

      clearInterval(
        interval
      );
    };
  }, [session?.id]);

  async function loadSession() {
    if (!meetingId) {
      return;
    }

    const nowIso =
      new Date()
        .toISOString();

    const {
      data,
      error,
    } = await supabase
      .from(
        "attendance_sessions"
      )
      .select("*")
      .eq(
        "meeting_id",
        meetingId
      )
      .eq(
        "is_active",
        true
      )
      .gt(
        "ends_at",
        nowIso
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        error
      );

      return;
    }

    setSession(
      data as Session | null
    );
  }

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
              "Browser tidak mendukung lokasi."
            )
          );

          return;
        }

        navigator.geolocation
          .getCurrentPosition(
            (position) => {
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
                  "Lokasi tidak dapat diambil. Izinkan akses lokasi pada browser."
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

  async function openSession() {
    setLoading(true);
    setMessage("");

    try {
      let location:
        | LocationData
        | null = null;

      /*
       * Lokasi dosen diambil otomatis
       * saat tombol dibuka.
       */
      if (
        requireLocation
      ) {
        setMessage(
          "Mengambil lokasi kelas..."
        );

        location =
          await getLocation();
      }

      /*
       * Tutup session lama.
       */
      await supabase
        .from(
          "attendance_sessions"
        )
        .update({
          is_active:
            false,
        })
        .eq(
          "meeting_id",
          meetingId
        )
        .eq(
          "is_active",
          true
        );

      const start =
        new Date();

      const end =
        new Date(
          start.getTime() +
            duration *
              60 *
              1000
        );

      const token =
        crypto
          .randomUUID()
          .replace(
            /-/g,
            ""
          );

      const {
        data: userData,
      } =
        await supabase
          .auth
          .getUser();

      const {
        data,
        error,
      } = await supabase
        .from(
          "attendance_sessions"
        )
        .insert({
          meeting_id:
            meetingId,

          token,

          starts_at:
            start
              .toISOString(),

          ends_at:
            end
              .toISOString(),

          is_active:
            true,

          created_by:
            userData
              .user?.id ??
            null,

          latitude:
            location
              ?.latitude ??
            null,

          longitude:
            location
              ?.longitude ??
            null,

          radius_meters:
            radius,

          max_accuracy_m:
            150,

          require_location:
            requireLocation,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      setSession(
        data as Session
      );

      setMessage(
        requireLocation
          ? `Absensi dibuka. Radius GPS ${radius} meter. QR akan berubah otomatis setiap 30 detik.`
          : "Absensi dibuka. QR akan berubah otomatis setiap 30 detik."
      );
    } catch (
      error: any
    ) {
      setMessage(
        error?.message ||
          "Gagal membuka QR."
      );
    } finally {
      setLoading(false);
    }
  }

  async function closeSession() {
    if (!session) {
      return;
    }

    setLoading(true);

    const {
      error,
    } = await supabase
      .from(
        "attendance_sessions"
      )
      .update({
        is_active:
          false,
      })
      .eq(
        "id",
        session.id
      );

    if (error) {
      setMessage(
        error.message
      );
    } else {
      setSession(
        null
      );

      setQrCode("");

      setMessage(
        "Presensi QR ditutup."
      );
    }

    setLoading(false);
  }

  const qrUrl =
    typeof window !==
      "undefined" &&
    session &&
    qrCode
      ? `${window.location.origin}/presensi/${session.token}?code=${encodeURIComponent(
          qrCode
        )}`
      : "";

  const qrCountdown =
    Math.max(
      0,
      Math.ceil(
        (qrExpiresAt -
          now) /
          1000
      )
    );

  const sessionRemaining =
    session
      ? Math.max(
          0,
          Math.ceil(
            (new Date(
              session.ends_at
            ).getTime() -
              now) /
              60000
          )
        )
      : 0;

  return (
    <div
      style={{
        border:
          "1px solid #e2e8f0",

        borderRadius:
          14,

        padding: 18,

        marginBottom:
          20,

        background:
          "#f8fafc",
      }}
    >
      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          gap: 16,

          flexWrap:
            "wrap",
        }}
      >
        <div>
          <strong>
            QR Presensi Aman
          </strong>

          <div
            className="muted"
            style={{
              marginTop:
                4,
            }}
          >
            {courseName}
            {" — "}
            {classLabel}

            <br />

            Pertemuan{" "}
            {meetingNo}
          </div>
        </div>

        {!session && (
          <div
            style={{
              display:
                "flex",

              flexWrap:
                "wrap",

              gap: 10,

              alignItems:
                "end",
            }}
          >
            <div className="field">
              <label>
                Durasi
              </label>

              <select
                className="select"
                value={
                  duration
                }
                onChange={(
                  e
                ) =>
                  setDuration(
                    Number(
                      e
                        .target
                        .value
                    )
                  )
                }
              >
                <option
                  value={5}
                >
                  5 menit
                </option>

                <option
                  value={10}
                >
                  10 menit
                </option>

                <option
                  value={15}
                >
                  15 menit
                </option>

                <option
                  value={30}
                >
                  30 menit
                </option>
              </select>
            </div>

            <div className="field">
              <label>
                Radius GPS
              </label>

              <select
                className="select"
                value={
                  radius
                }
                onChange={(
                  e
                ) =>
                  setRadius(
                    Number(
                      e
                        .target
                        .value
                    )
                  )
                }
                disabled={
                  !requireLocation
                }
              >
                <option
                  value={100}
                >
                  100 meter
                </option>

                <option
                  value={150}
                >
                  150 meter
                </option>

                <option
                  value={200}
                >
                  200 meter
                </option>

                <option
                  value={300}
                >
                  300 meter
                </option>

                <option
                  value={500}
                >
                  500 meter
                </option>
              </select>
            </div>

            <label
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap: 7,

                minHeight:
                  42,
              }}
            >
              <input
                type="checkbox"
                checked={
                  requireLocation
                }
                onChange={(
                  e
                ) =>
                  setRequireLocation(
                    e
                      .target
                      .checked
                  )
                }
              />

              Wajib GPS
            </label>

            <button
              className="btn btn-primary"
              onClick={
                openSession
              }
              disabled={
                loading
              }
            >
              {loading
                ? "Membuka..."
                : "Buka Absensi QR"}
            </button>
          </div>
        )}
      </div>

      {session &&
        qrUrl && (
          <div
            style={{
              marginTop:
                20,

              textAlign:
                "center",
            }}
          >
            <div
              style={{
                width:
                  "100%",

                maxWidth:
                  300,

                margin:
                  "0 auto",

                background:
                  "white",

                padding:
                  20,

                borderRadius:
                  16,
              }}
            >
              <QRCodeSVG
                value={
                  qrUrl
                }
                size={
                  280
                }
                level="H"
                style={{
                  width:
                    "100%",

                  height:
                    "auto",
                }}
              />
            </div>

            <div
              style={{
                marginTop:
                  14,
              }}
            >
              <strong>
                QR otomatis
                berganti dalam{" "}
                {qrCountdown}
                {" "}detik
              </strong>
            </div>

            <p
              className="muted"
              style={{
                marginTop:
                  5,
              }}
            >
              Sisa waktu
              presensi sekitar{" "}
              {sessionRemaining}
              {" "}menit
            </p>

            {session.require_location && (
              <p
                className="muted"
                style={{
                  marginTop:
                    4,
                }}
              >
                GPS wajib •
                radius{" "}
                {session.radius_meters}
                {" "}meter
              </p>
            )}

            <div
              style={{
                marginTop:
                  15,
              }}
            >
              <button
                className="btn btn-danger"
                onClick={
                  closeSession
                }
                disabled={
                  loading
                }
              >
                Tutup Absensi
              </button>
            </div>
          </div>
        )}

      {message && (
        <div
          className="muted"
          style={{
            marginTop:
              12,
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}