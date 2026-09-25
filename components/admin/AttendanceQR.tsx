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
  CAMPUS_LOCATION,
} from "@/lib/campus";

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

  latitude: number | null;
  longitude: number | null;

  radius_meters: number;
  max_accuracy_m: number;

  require_location: boolean;
};

function makeSessionToken() {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto
        .randomUUID()
        .replace(/-/g, "");
    }

    if (
      typeof crypto !== "undefined" &&
      typeof crypto.getRandomValues === "function"
    ) {
      const values =
        new Uint32Array(4);

      crypto.getRandomValues(
        values
      );

      return Array.from(values)
        .map((value) =>
          value.toString(16)
        )
        .join("");
    }
  } catch {
    // fallback
  }

  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2) +
    Math.random()
      .toString(36)
      .slice(2)
  );
}

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
  useState<number>(
    CAMPUS_LOCATION.defaultRadius
  );

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
    useState(
      Date.now()
    );

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

  /*
   * Load session QR aktif
   * ketika meeting berubah.
   */
  useEffect(() => {
    void loadSession();
  }, [meetingId]);

  /*
   * Timer countdown.
   */
  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setNow(
            Date.now()
          );
        },
        1000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, []);

  /*
   * QR otomatis diperbarui
   * setiap 30 detik.
   */
  useEffect(() => {
    if (!session?.id) {
      setQrCode("");
      setQrExpiresAt(0);

      return;
    }

    let cancelled =
      false;

    async function fetchQr() {
      try {
        const response =
          await fetch(
            `/api/admin/presensi/qr?sessionId=${encodeURIComponent(
              session!.id
            )}`,
            {
              cache: "no-store",
            }
          );

        const result =
          await response.json();

        if (cancelled) {
          return;
        }

        if (!response.ok) {
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

            setQrCode("");
          }

          return;
        }

        setQrCode(
          result.code
        );

        setQrExpiresAt(
          Number(
            result.expiresAt
          )
        );
      } catch (error) {
        console.error(
          "QR REFRESH ERROR:",
          error
        );

        if (
          !cancelled
        ) {
          setMessage(
            "Gagal memperbarui QR."
          );
        }
      }
    }

    /*
     * Buat QR pertama.
     */
    void fetchQr();

    /*
     * Auto refresh.
     */
    const interval =
      window.setInterval(
        () => {
          void fetchQr();
        },
        30_000
      );

    return () => {
      cancelled = true;

      window.clearInterval(
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
        "LOAD QR SESSION ERROR:",
        error
      );

      setMessage(
        error.message
      );

      return;
    }

    setSession(
      data as Session | null
    );
  }

  async function openSession() {
    setLoading(true);
    setMessage("");

    try {
      /*
       * Tutup session lama
       * di pertemuan yang sama.
       */
      const {
        error:
          closeError,
      } = await supabase
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

      if (closeError) {
        throw closeError;
      }

      const start =
        new Date();

      const end =
        new Date(
          start.getTime() +
            duration *
              60 *
              1000
        );

      const {
        data:
          userData,
        error:
          userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (
        !userData.user
      ) {
        throw new Error(
          "Session admin tidak ditemukan. Silakan login kembali."
        );
      }

      /*
       * Tidak mengambil GPS dosen.
       * Lokasi selalu kampus.
       */
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

          token:
            makeSessionToken(),

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
              .user
              .id,

          latitude:
            CAMPUS_LOCATION
              .latitude,

          longitude:
            CAMPUS_LOCATION
              .longitude,

          radius_meters:
            radius,

          max_accuracy_m:
            CAMPUS_LOCATION
              .maxAccuracy,

          require_location:
            true,
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
        `Absensi dibuka. Lokasi: ${CAMPUS_LOCATION.name}. Radius ${radius} meter. QR berganti otomatis setiap 30 detik.`
      );
    } catch (
      error: any
    ) {
      console.error(
        "OPEN QR ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Gagal membuka sesi QR."
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
    setMessage("");

    try {
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
        throw error;
      }

      setSession(
        null
      );

      setQrCode("");

      setQrExpiresAt(
        0
      );

      setMessage(
        "Presensi QR ditutup."
      );
    } catch (
      error: any
    ) {
      console.error(
        "CLOSE QR ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Gagal menutup presensi."
      );
    } finally {
      setLoading(false);
    }
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
        (
          qrExpiresAt -
          now
        ) / 1000
      )
    );

  const sessionSecondsRemaining =
    session
      ? Math.max(
          0,
          Math.ceil(
            (
              new Date(
                session.ends_at
              ).getTime() -
              now
            ) / 1000
          )
        )
      : 0;

  const sessionMinutes =
    Math.floor(
      sessionSecondsRemaining /
        60
    );

  const sessionSeconds =
    sessionSecondsRemaining %
    60;

  return (
    <div
      className="attendance-qr"
      style={{
        border:
          "1px solid #e2e8f0",

        borderRadius:
          14,

        padding:
          18,

        marginBottom:
          20,

        background:
          "#f8fafc",

        width:
          "100%",
      }}
    >
      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-end",

          gap:
            16,

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
                5,
            }}
          >
            {courseName}
            {" — "}
            {classLabel}

            <br />

            Pertemuan{" "}
            {meetingNo}

            <br />

            📍{" "}
            {
              CAMPUS_LOCATION.name
            }
          </div>
        </div>

        {!session && (
          <div
            style={{
              display:
                "flex",

              flexWrap:
                "wrap",

              gap:
                10,

              alignItems:
                "flex-end",
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
                  event
                ) =>
                  setDuration(
                    Number(
                      event
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

                <option
                  value={60}
                >
                  60 menit
                </option>
              </select>
            </div>

            <div className="field">
  <label>
    Radius Kampus
  </label>

  <select
    className="select"
    value={radius}
    onChange={(event) => {
      setRadius(
        Number(event.currentTarget.value)
      );
    }}
  >
    <option value={100}>
      100 meter
    </option>

    <option value={150}>
      150 meter
    </option>

    <option value={200}>
      200 meter
    </option>

    <option value={250}>
      250 meter
    </option>

    <option value={300}>
      300 meter
    </option>

    <option value={500}>
      500 meter
    </option>
  </select>
</div>

            <button
              type="button"
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
                22,

              textAlign:
                "center",
            }}
          >
            <div
              style={{
                width:
                  "100%",

                maxWidth:
                  310,

                margin:
                  "0 auto",

                background:
                  "#ffffff",

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

                fontWeight:
                  800,
              }}
            >
              QR berganti otomatis dalam{" "}
              {qrCountdown} detik
            </div>

            <div
              className="muted"
              style={{
                marginTop:
                  7,
              }}
            >
              Sisa sesi:{" "}
              {sessionMinutes}:
              {String(
                sessionSeconds
              ).padStart(
                2,
                "0"
              )}

              <br />

              GPS wajib • radius{" "}
              {
                session.radius_meters
              }{" "}
              meter
            </div>

            <button
              type="button"
              className="btn btn-danger"
              onClick={
                closeSession
              }
              disabled={
                loading
              }
              style={{
                marginTop:
                  16,
              }}
            >
              Tutup Absensi
            </button>
          </div>
        )}

      {session &&
        !qrUrl && (
          <div
            className="muted"
            style={{
              marginTop:
                16,
            }}
          >
            Membuat QR...
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