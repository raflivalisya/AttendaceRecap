"use client";

import {
  useEffect,
  useMemo,
  useRef,
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

const QR_REFRESH_MS =
  20_000;

function makeSessionToken() {
  try {
    if (
      typeof window !== "undefined" &&
      window.crypto
    ) {
      if (
        typeof window.crypto.randomUUID ===
        "function"
      ) {
        return window.crypto
          .randomUUID()
          .replace(
            /-/g,
            ""
          );
      }

      if (
        typeof window.crypto.getRandomValues ===
        "function"
      ) {
        const values =
          new Uint32Array(
            4
          );

        window.crypto.getRandomValues(
          values
        );

        return Array.from(
          values
        )
          .map(
            (value) =>
              value.toString(
                16
              )
          )
          .join("");
      }
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
      () =>
        createClient(),
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
    useState<number>(
      15
    );

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

const qrTimeoutRef =
  useRef<number | null>(
    null
  );

  /*
   * ========================================
   * CLOCK
   * ========================================
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
   * ========================================
   * LOAD ACTIVE SESSION
   * ========================================
   */

  useEffect(() => {
    void loadSession();
  }, [meetingId]);

  /*
   * ========================================
   * DYNAMIC QR
   *
   * Tidak lagi memakai setInterval tetap.
   * Setelah QR berhasil dibuat, QR berikutnya
   * dijadwalkan 20 detik kemudian.
   * ========================================
   */

  useEffect(() => {
    if (
      !session?.id
    ) {
      setQrCode("");
      setQrExpiresAt(0);

      return;
    }

    let active =
      true;

    async function refreshQr() {
      if (
        !active ||
        !session
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            `/api/admin/presensi/qr?sessionId=${encodeURIComponent(
              session.id
            )}&t=${Date.now()}`,
            {
              method:
                "GET",

              cache:
                "no-store",

              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const result =
          await response.json();

        if (
          !active
        ) {
          return;
        }

        if (
          !response.ok
        ) {
          setMessage(
            result.message ||
              "Gagal memperbarui QR."
          );

          /*
           * Coba lagi 5 detik
           * kalau request gagal.
           */
          qrTimeoutRef.current =
            window.setTimeout(
              () => {
                void refreshQr();
              },
              5000
            );

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

        setMessage("");

        /*
         * Refresh lagi 20 detik.
         */
        qrTimeoutRef.current =
          window.setTimeout(
            () => {
              void refreshQr();
            },
            QR_REFRESH_MS
          );
      } catch (error) {
        console.error(
          "QR REFRESH ERROR:",
          error
        );

        if (
          !active
        ) {
          return;
        }

        setMessage(
          "Koneksi QR terputus. Mencoba kembali..."
        );

        qrTimeoutRef.current =
          window.setTimeout(
            () => {
              void refreshQr();
            },
            5000
          );
      }
    }

    /*
     * Buat QR pertama.
     */
    void refreshQr();

    /*
     * Kalau tab kembali aktif,
     * langsung refresh QR.
     */
    function handleVisibility() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        if (
          qrTimeoutRef.current
        ) {
          window.clearTimeout(
            qrTimeoutRef.current
          );
        }

        void refreshQr();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      active =
        false;

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      if (
        qrTimeoutRef.current
      ) {
        window.clearTimeout(
          qrTimeoutRef.current
        );
      }
    };
  }, [
    session?.id,
  ]);

  /*
   * ========================================
   * LOAD SESSION
   * ========================================
   */

  async function loadSession() {
    if (
      !meetingId
    ) {
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

    if (
      error
    ) {
      console.error(
        "LOAD SESSION ERROR:",
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

  /*
   * ========================================
   * OPEN SESSION
   * ========================================
   */

  async function openSession() {
    setLoading(
      true
    );

    setMessage(
      ""
    );

    try {
      /*
       * Tutup sesi sebelumnya.
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

      if (
        closeError
      ) {
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

      if (
        userError
      ) {
        throw userError;
      }

      if (
        !userData.user
      ) {
        throw new Error(
          "Admin belum login."
        );
      }

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
            start.toISOString(),

          ends_at:
            end.toISOString(),

          is_active:
            true,

          created_by:
            userData.user.id,

          latitude:
            CAMPUS_LOCATION.latitude,

          longitude:
            CAMPUS_LOCATION.longitude,

          radius_meters:
            radius,

          max_accuracy_m:
            CAMPUS_LOCATION.maxAccuracy,

          require_location:
            true,
        })
        .select("*")
        .single();

      if (
        error
      ) {
        throw error;
      }

      setSession(
        data as Session
      );
    } catch (
      error: any
    ) {
      console.error(
        "OPEN SESSION ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Gagal membuka QR."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  /*
   * ========================================
   * CLOSE SESSION
   * ========================================
   */

  async function closeSession() {
    if (
      !session
    ) {
      return;
    }

    setLoading(
      true
    );

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

      if (
        error
      ) {
        throw error;
      }

      setSession(
        null
      );

      setQrCode(
        ""
      );

      setQrExpiresAt(
        0
      );
    } catch (
      error: any
    ) {
      setMessage(
        error?.message ||
          "Gagal menutup absensi."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  /*
   * ========================================
   * QR URL
   *
   * PENTING:
   * QR langsung menuju SERVER SCAN.
   * ========================================
   */

  const qrUrl =
    typeof window !==
      "undefined" &&
    session &&
    qrCode
      ? `${window.location.origin}/api/presensi/scan/${encodeURIComponent(
          session.token
        )}?code=${encodeURIComponent(
          qrCode
        )}`
      : "";

  /*
   * ========================================
   * COUNTDOWN
   * ========================================
   */

  const qrCountdown =
    qrExpiresAt >
    now
      ? Math.ceil(
          (
            qrExpiresAt -
            now
          ) / 1000
        )
      : 0;

  const sessionRemaining =
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
      sessionRemaining /
        60
    );

  const sessionSeconds =
    sessionRemaining %
    60;

  /*
   * ========================================
   * UI
   * ========================================
   */

  return (
    <div
      style={{
        border:
          "1px solid #e2e8f0",

        borderRadius:
          14,

        padding:
          18,

        marginBottom:
          20,

        width:
          "100%",

        background:
          "#f8fafc",
      }}
    >
      <strong>
        QR Presensi Aman
      </strong>

      <div
        className="muted"
        style={{
          marginTop:
            6,
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

      {!session && (
        <div
          style={{
            display:
              "flex",

            flexWrap:
              "wrap",

            gap:
              12,

            marginTop:
              18,

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
              ) => {
                setDuration(
                  Number(
                    event.currentTarget.value
                  )
                );
              }}
            >
              <option value={5}>
                5 menit
              </option>

              <option value={10}>
                10 menit
              </option>

              <option value={15}>
                15 menit
              </option>

              <option value={30}>
                30 menit
              </option>
            </select>
          </div>

          <div className="field">
            <label>
              Radius
            </label>

            <select
              className="select"

              value={
                radius
              }

              onChange={(
                event
              ) => {
                setRadius(
                  Number(
                    event.currentTarget.value
                  )
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

            disabled={
              loading
            }

            onClick={() => {
              void openSession();
            }}
          >
            {loading
              ? "Membuka..."
              : "Buka Absensi QR"}
          </button>
        </div>
      )}

      {session &&
        qrUrl && (
          <div
            style={{
              marginTop:
                24,

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

                padding:
                  20,

                margin:
                  "0 auto",

                background:
                  "#ffffff",

                borderRadius:
                  16,
              }}
            >
              <QRCodeSVG
                key={
                  qrCode
                }

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
              QR aktif{" "}

              {qrCountdown}{" "}

              detik
            </div>

            <div
              className="muted"

              style={{
                marginTop:
                  8,
              }}
            >
              QR diperbarui otomatis setiap 20 detik

              <br />

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

              disabled={
                loading
              }

              onClick={() => {
                void closeSession();
              }}

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
          <p>
            Membuat QR...
          </p>
        )}

      {message && (
        <div
          className="error"

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