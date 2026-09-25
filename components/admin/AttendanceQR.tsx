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

  const [session, setSession] =
    useState<Session | null>(
      null
    );

  const [duration, setDuration] =
    useState(15);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    loadSession();
  }, [meetingId]);

  async function loadSession() {
    if (!meetingId) {
      return;
    }

    const now =
      new Date().toISOString();

    const { data, error } =
      await supabase
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
          now
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

    if (error) {
      console.error(error);
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
      // Tutup session lama
      await supabase
        .from(
          "attendance_sessions"
        )
        .update({
          is_active: false,
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
        data,
        error,
      } =
        await supabase
          .from(
            "attendance_sessions"
          )
          .insert({
            meeting_id:
              meetingId,

            token,

            starts_at:
              start.toISOString(),

            ends_at:
              end.toISOString(),

            is_active:
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
        "QR absensi berhasil dibuka."
      );
    } catch (error: any) {
      setMessage(
        error.message ||
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

    const { error } =
      await supabase
        .from(
          "attendance_sessions"
        )
        .update({
          is_active: false,
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
      setSession(null);

      setMessage(
        "Presensi QR ditutup."
      );
    }

    setLoading(false);
  }

  const qrUrl =
    typeof window !==
      "undefined" &&
    session
      ? `${window.location.origin}/presensi/${session.token}`
      : "";

  async function copyLink() {
    if (!qrUrl) return;

    await navigator.clipboard.writeText(
      qrUrl
    );

    setMessage(
      "Link presensi disalin."
    );
  }

  return (
    <div
      style={{
        border:
          "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong>
            QR Presensi
          </strong>

          <div
            className="muted"
            style={{
              marginTop: 4,
            }}
          >
            {courseName} —{" "}
            {classLabel}
            <br />
            Pertemuan{" "}
            {meetingNo}
          </div>
        </div>

        {!session && (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "end",
            }}
          >
            <div className="field">
              <label>
                Durasi
              </label>

              <select
                className="select"
                value={duration}
                onChange={(e) =>
                  setDuration(
                    Number(
                      e.target
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

            <button
              className="btn btn-primary"
              onClick={
                openSession
              }
              disabled={
                loading
              }
            >
              Buka Absensi QR
            </button>
          </div>
        )}
      </div>

      {session &&
        qrUrl && (
          <div
            style={{
              marginTop: 20,
              textAlign:
                "center",
            }}
          >
            <div
              style={{
                display:
                  "inline-block",
                background:
                  "#ffffff",
                padding: 20,
                borderRadius:
                  16,
              }}
            >
              <QRCodeSVG
                value={qrUrl}
                size={260}
                level="H"
              />
            </div>

            <p
              style={{
                marginTop:
                  12,
              }}
            >
              Aktif sampai{" "}
              <strong>
                {new Date(
                  session.ends_at
                ).toLocaleTimeString(
                  "id-ID",
                  {
                    hour:
                      "2-digit",
                    minute:
                      "2-digit",
                  }
                )}
              </strong>
            </p>

            <div
              className="admin-actions"
              style={{
                justifyContent:
                  "center",
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={
                  copyLink
                }
              >
                Salin Link
              </button>

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
          style={{
            marginTop: 12,
          }}
          className="muted"
        >
          {message}
        </div>
      )}
    </div>
  );
}