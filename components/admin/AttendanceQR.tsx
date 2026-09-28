"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from "@/lib/system-settings";

type Props = {
  meetingId: string;
  meetingNo: number;
  courseName: string;
  classLabel: string;
  participantCount?: number;
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
    if (typeof window !== "undefined" && window.crypto?.randomUUID) {
      return window.crypto.randomUUID().replace(/-/g, "");
    }
  } catch {
    // Fallback below.
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export default function AttendanceQR({
  meetingId,
  meetingNo,
  courseName,
  classLabel,
  participantCount = 0,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [session, setSession] = useState<Session | null>(null);
  const [duration, setDuration] = useState(15);
  const [radius, setRadius] = useState(DEFAULT_SYSTEM_SETTINGS.default_radius_meters);
  const [qrCode, setQrCode] = useState("");
  const [qrExpiresAt, setQrExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const qrTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/system/settings", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((result) => {
        if (!active || !result?.settings) return;
        setSettings({ ...DEFAULT_SYSTEM_SETTINGS, ...result.settings });
        setRadius(Number(result.settings.default_radius_meters) || DEFAULT_SYSTEM_SETTINGS.default_radius_meters);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (!meetingId) return;
      const { data, error } = await supabase
        .from("attendance_sessions")
        .select("*")
        .eq("meeting_id", meetingId)
        .eq("is_active", true)
        .gt("ends_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setMessage(error.message);
        return;
      }
      setSession(data as Session | null);
      if (data?.radius_meters) setRadius(Number(data.radius_meters));
    }

    setQrCode("");
    setQrExpiresAt(0);
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [meetingId, supabase]);

  useEffect(() => {
    if (!session?.id) {
      setQrCode("");
      setQrExpiresAt(0);
      return;
    }

    let active = true;
    const refreshMs = Math.max(10, Math.min(25, Number(settings.qr_refresh_seconds) || 20)) * 1000;

    async function refreshQr() {
      if (!active || !session) return;
      try {
        const response = await fetch(
          `/api/admin/presensi/qr?sessionId=${encodeURIComponent(session.id)}&t=${Date.now()}`,
          { cache: "no-store", headers: { Accept: "application/json" } },
        );
        const result = await response.json().catch(() => ({}));
        if (!active) return;

        if (!response.ok) {
          if (response.status === 410) {
            setSession(null);
            setQrCode("");
            setQrExpiresAt(0);
            setMessage(result.message || "Sesi presensi berakhir.");
            return;
          }
          throw new Error(result.message || "Gagal memperbarui QR.");
        }

        setQrCode(String(result.code ?? ""));
        setQrExpiresAt(Number(result.expiresAt ?? 0));
        setMessage("");
        qrTimeoutRef.current = window.setTimeout(() => void refreshQr(), refreshMs);
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Koneksi QR terputus. Mencoba kembali…");
        qrTimeoutRef.current = window.setTimeout(() => void refreshQr(), 5000);
      }
    }

    void refreshQr();

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (qrTimeoutRef.current) window.clearTimeout(qrTimeoutRef.current);
      void refreshQr();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (qrTimeoutRef.current) window.clearTimeout(qrTimeoutRef.current);
    };
  }, [session?.id, settings.qr_refresh_seconds]);

  async function openSession() {
    setLoading(true);
    setMessage("");

    try {
      const { error: closeError } = await supabase
        .from("attendance_sessions")
        .update({ is_active: false })
        .eq("meeting_id", meetingId)
        .eq("is_active", true);
      if (closeError) throw closeError;

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Anda belum login.");

      const start = new Date();
      const end = new Date(start.getTime() + duration * 60_000);
      const { data, error } = await supabase
        .from("attendance_sessions")
        .insert({
          meeting_id: meetingId,
          token: makeSessionToken(),
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          is_active: true,
          created_by: userData.user.id,
          latitude: settings.campus_latitude,
          longitude: settings.campus_longitude,
          radius_meters: radius,
          max_accuracy_m: settings.max_accuracy_meters,
          require_location: true,
        })
        .select("*")
        .single();
      if (error) throw error;
      setSession(data as Session);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuka QR.");
    } finally {
      setLoading(false);
    }
  }

  async function closeSession() {
    if (!session) return;
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase
        .from("attendance_sessions")
        .update({ is_active: false })
        .eq("id", session.id);
      if (error) throw error;
      setSession(null);
      setQrCode("");
      setQrExpiresAt(0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menutup absensi.");
    } finally {
      setLoading(false);
    }
  }

  const qrUrl =
    typeof window !== "undefined" && session && qrCode
      ? `${window.location.origin}/api/presensi/scan/${encodeURIComponent(session.token)}?code=${encodeURIComponent(qrCode)}`
      : "";

  const qrCountdown = qrExpiresAt > now ? Math.ceil((qrExpiresAt - now) / 1000) : 0;
  const sessionRemaining = session ? Math.max(0, Math.ceil((new Date(session.ends_at).getTime() - now) / 1000)) : 0;
  const sessionMinutes = Math.floor(sessionRemaining / 60);
  const sessionSeconds = sessionRemaining % 60;

  return (
    <section className="attendance-qr-card">
      <div className="attendance-qr-head">
        <div>
          <strong>QR Presensi Aman</strong>
          <p className="muted">
            {courseName} — {classLabel}<br />Pertemuan {meetingNo} · 📍 {settings.campus_name}
          </p>
        </div>
        {session && (
          <span className="qr-participant-badge" title="Peserta unik yang sudah check-in melalui QR">
            👥 {participantCount} check-in
          </span>
        )}
      </div>

      {!session ? (
        <div className="attendance-qr-controls">
          <div className="field">
            <label>Durasi</label>
            <select className="select" value={duration} onChange={(event) => setDuration(Number(event.currentTarget.value))}>
              <option value={5}>5 menit</option>
              <option value={10}>10 menit</option>
              <option value={15}>15 menit</option>
              <option value={30}>30 menit</option>
              <option value={60}>60 menit</option>
            </select>
          </div>
          <div className="field">
            <label>Radius</label>
            <select className="select" value={radius} onChange={(event) => setRadius(Number(event.currentTarget.value))}>
              {[100, 150, 200, 250, 300, 500, 750, 1000].map((value) => (
                <option value={value} key={value}>{value} meter</option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void openSession()}>
            {loading ? "Membuka…" : "Buka Absensi QR"}
          </button>
        </div>
      ) : qrUrl ? (
        <div className="attendance-qr-active">
          <div className="attendance-qr-code-wrap">
            <QRCodeSVG key={qrCode} value={qrUrl} size={280} level="H" style={{ width: "100%", height: "auto" }} />
          </div>
          <div className="attendance-qr-status-row">
            <strong>QR aktif {qrCountdown} detik</strong>
            <span>{participantCount} peserta masuk</span>
          </div>
          <p className="muted">
            QR diperbarui otomatis setiap {Math.max(10, Math.min(25, Number(settings.qr_refresh_seconds) || 20))} detik<br />
            Sisa sesi: {sessionMinutes}:{String(sessionSeconds).padStart(2, "0")} · GPS wajib · radius {session.radius_meters} meter
          </p>
          <button type="button" className="btn btn-danger" disabled={loading} onClick={() => void closeSession()}>
            {loading ? "Menutup…" : "Tutup Absensi"}
          </button>
        </div>
      ) : (
        <div className="inline-loading"><span className="global-spinner" /> Membuat QR…</div>
      )}

      {message && <div className="error attendance-qr-message">{message}</div>}
    </section>
  );
}
