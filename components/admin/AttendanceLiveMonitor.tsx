"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Attendance, AttendanceStatus, Student } from "@/lib/types";

type CheckinRow = {
  id: string;
  meeting_id: string;
  student_id: string;
  created_at: string;
  distance_m: number | null;
  accuracy_m: number | null;
};

type ConnectionState =
  | "CONNECTING"
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED";

type Props = {
  meetingId: string;
  students: Student[];
  onAttendanceChange?: (rows: Attendance[]) => void;
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  H: "Hadir",
  I: "Izin",
  S: "Sakit",
  A: "Alfa",
};

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

function roundMetric(value: number | null) {
  if (value === null || !Number.isFinite(Number(value))) return "-";
  return Math.round(Number(value));
}

export default function AttendanceLiveMonitor({
  meetingId,
  students,
  onAttendanceChange,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<Attendance[]>([]);
  const [connection, setConnection] =
    useState<ConnectionState>("CONNECTING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const onAttendanceChangeRef = useRef(onAttendanceChange);

  useEffect(() => {
    onAttendanceChangeRef.current = onAttendanceChange;
  }, [onAttendanceChange]);

  const studentMap = useMemo(() => {
    return new Map(students.map((student) => [student.id, student]));
  }, [students]);

  const loadData = useCallback(async () => {
    if (!meetingId) return;

    try {
      const [checkinResult, attendanceResult] = await Promise.all([
        supabase
          .from("attendance_checkins")
          .select("id,meeting_id,student_id,created_at,distance_m,accuracy_m")
          .eq("meeting_id", meetingId)
          .order("created_at", { ascending: false }),
        supabase
          .from("attendance")
          .select("*")
          .eq("meeting_id", meetingId),
      ]);

      if (checkinResult.error) throw checkinResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      const nextCheckins = (checkinResult.data ?? []) as CheckinRow[];
      const nextAttendance = (attendanceResult.data ?? []) as Attendance[];

      setCheckins(nextCheckins);
      setAttendanceRows(nextAttendance);
      setLastUpdated(new Date());
      setError("");
      onAttendanceChangeRef.current?.(nextAttendance);
    } catch (err: any) {
      console.error("LIVE ATTENDANCE LOAD ERROR:", err);
      setError(err?.message || "Gagal memuat monitoring presensi.");
    } finally {
      setLoading(false);
    }
  }, [meetingId, supabase]);

  useEffect(() => {
    setLoading(true);
    setConnection("CONNECTING");
    void loadData();

    const channel = supabase
      .channel(`attendance-live-${meetingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_checkins",
          filter: `meeting_id=eq.${meetingId}`,
        },
        () => {
          void loadData();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          filter: `meeting_id=eq.${meetingId}`,
        },
        () => {
          void loadData();
        },
      )
      .subscribe((status) => {
        setConnection(status as ConnectionState);
      });

    // Fallback: jika koneksi realtime terganggu, data tetap sinkron berkala.
    const polling = window.setInterval(() => {
      void loadData();
    }, 15000);

    return () => {
      window.clearInterval(polling);
      void supabase.removeChannel(channel);
    };
  }, [meetingId, loadData, supabase]);

  const counts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = {
      H: 0,
      I: 0,
      S: 0,
      A: 0,
    };

    for (const row of attendanceRows) {
      if (row.status in result) {
        result[row.status] += 1;
      }
    }

    return result;
  }, [attendanceRows]);

  const filledStudentIds = useMemo(
    () => new Set(attendanceRows.map((row) => row.student_id)),
    [attendanceRows],
  );

  const notFilled = Math.max(0, students.length - filledStudentIds.size);
  const presentPercentage = students.length
    ? Math.round((counts.H / students.length) * 100)
    : 0;

  const isLive = connection === "SUBSCRIBED";

  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        background: "#ffffff",
        padding: 18,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>
            Monitoring Presensi
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            Data otomatis diperbarui saat mahasiswa check-in.
          </div>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 10px",
            borderRadius: 999,
            background: isLive ? "#dcfce7" : "#fef3c7",
            color: isLive ? "#166534" : "#92400e",
            fontWeight: 800,
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "currentColor",
              display: "inline-block",
            }}
          />
          {isLive ? "LIVE" : connection === "CONNECTING" ? "Menghubungkan..." : "Polling"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Metric label="Hadir" value={counts.H} />
        <Metric label="Total" value={students.length} />
        <Metric label="Belum" value={notFilled} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            marginBottom: 7,
          }}
        >
          <span style={{ fontWeight: 700 }}>Kehadiran</span>
          <span>{presentPercentage}%</span>
        </div>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            overflow: "hidden",
            background: "#e2e8f0",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, presentPercentage)}%`,
              background: "#16a34a",
              transition: "width .25s ease",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 8,
          marginBottom: 18,
        }}
      >
        <SmallStatus label="H" value={counts.H} />
        <SmallStatus label="I" value={counts.I} />
        <SmallStatus label="S" value={counts.S} />
        <SmallStatus label="A" value={counts.A} />
      </div>

      <div style={{ fontWeight: 800, marginBottom: 10 }}>Check-in terbaru</div>

      {loading && checkins.length === 0 ? (
        <div className="muted">Memuat data check-in...</div>
      ) : checkins.length === 0 ? (
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            background: "#f8fafc",
            color: "#64748b",
            textAlign: "center",
          }}
        >
          Belum ada mahasiswa yang check-in menggunakan QR.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8, maxHeight: 360, overflowY: "auto" }}>
          {checkins.slice(0, 20).map((row) => {
            const student = studentMap.get(row.student_id);

            return (
              <div
                key={row.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 11,
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#475569",
                    minWidth: 62,
                  }}
                >
                  {formatTime(row.created_at)}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>
                    {student?.name ?? "Mahasiswa"}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {student?.npm ?? row.student_id}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6, color: "#475569" }}>
                    📍 {roundMetric(row.distance_m)} m &nbsp;•&nbsp; GPS ±{roundMetric(row.accuracy_m)} m
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      <div className="muted" style={{ marginTop: 12, fontSize: 11 }}>
        Status: {connection}. {lastUpdated ? `Terakhir sinkron ${formatTime(lastUpdated.toISOString())}.` : ""}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: 12,
        background: "#f8fafc",
        borderRadius: 10,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>
        {label}
      </div>
    </div>
  );
}

function SmallStatus({ label, value }: { label: string; value: number }) {
  return (
    <div
      title={STATUS_LABEL[label as AttendanceStatus]}
      style={{
        padding: "9px 8px",
        background: "#f8fafc",
        borderRadius: 9,
        textAlign: "center",
      }}
    >
      <strong>{label}</strong>
      <div style={{ fontSize: 12, marginTop: 3 }}>{value}</div>
    </div>
  );
}
