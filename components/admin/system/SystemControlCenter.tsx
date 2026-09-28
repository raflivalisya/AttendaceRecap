"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_SYSTEM_SETTINGS,
  type SystemSettings,
} from "@/lib/system-settings";

type HealthCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

type HealthResult = {
  status: "healthy" | "degraded";
  checked_at: string;
  failed: number;
  checks: HealthCheck[];
};

export default function SystemControlCenter() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [settingsSource, setSettingsSource] = useState("");
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function loadSettings() {
    setLoadingSettings(true);
    try {
      const response = await fetch("/api/admin/system/settings", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Gagal memuat pengaturan sistem.");
      setSettings({ ...DEFAULT_SYSTEM_SETTINGS, ...(result.settings ?? {}) });
      setSettingsSource(result.source ?? "database");
      if (result.warning) {
        setMessage(result.warning);
        setIsError(true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat pengaturan sistem.");
      setIsError(true);
    } finally {
      setLoadingSettings(false);
    }
  }

  async function runHealthCheck() {
    setChecking(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/system/health", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Health check gagal.");
      setHealth(result as HealthResult);
      setIsError(result.status !== "healthy");
      setMessage(
        result.status === "healthy"
          ? "Semua pemeriksaan sistem berhasil."
          : `${result.failed} pemeriksaan memerlukan perhatian.`,
      );
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Health check gagal.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void loadSettings();
    void runHealthCheck();
  }, []);

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/system/settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(settings),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Gagal menyimpan pengaturan sistem.");
      setSettings({ ...DEFAULT_SYSTEM_SETTINGS, ...result.settings });
      setSettingsSource("database");
      setIsError(false);
      setMessage("Pengaturan sistem berhasil disimpan dan akan dipakai sesi QR berikutnya.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan pengaturan sistem.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadBackup() {
    setBackingUp(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/system/backup", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Backup gagal dibuat.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "AttendanceRecap-backup.json";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setIsError(false);
      setMessage("Backup JSON berhasil dibuat. Simpan file di lokasi yang aman.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Backup gagal dibuat.");
    } finally {
      setBackingUp(false);
    }
  }

  function setNumber<K extends keyof SystemSettings>(key: K, value: string) {
    setSettings((current) => ({ ...current, [key]: Number(value) }));
  }

  return (
    <div className="system-control-grid">
      <section className="panel system-settings-panel">
        <div className="panel-head">
          <div>
            <h2>System Settings</h2>
            <p>Konfigurasi operasional presensi yang berlaku lintas perangkat.</p>
          </div>
          <span className="badge neutral">{settingsSource === "database" ? "Database" : "Default"}</span>
        </div>
        <div className="panel-body">
          {loadingSettings ? (
            <div className="inline-loading"><span className="global-spinner" /> Memuat pengaturan…</div>
          ) : (
            <div className="system-settings-form">
              <div className="field">
                <label>Nama Aplikasi</label>
                <input className="input" value={settings.app_name} onChange={(e) => setSettings({ ...settings, app_name: e.target.value })} />
              </div>
              <div className="field">
                <label>Nama Kampus / Lokasi</label>
                <input className="input" value={settings.campus_name} onChange={(e) => setSettings({ ...settings, campus_name: e.target.value })} />
              </div>
              <div className="field">
                <label>Latitude</label>
                <input className="input" type="number" step="0.000001" value={settings.campus_latitude} onChange={(e) => setNumber("campus_latitude", e.target.value)} />
              </div>
              <div className="field">
                <label>Longitude</label>
                <input className="input" type="number" step="0.000001" value={settings.campus_longitude} onChange={(e) => setNumber("campus_longitude", e.target.value)} />
              </div>
              <div className="field">
                <label>Radius Presensi Default (m)</label>
                <input className="input" type="number" min="20" max="5000" value={settings.default_radius_meters} onChange={(e) => setNumber("default_radius_meters", e.target.value)} />
              </div>
              <div className="field">
                <label>Maks. Akurasi GPS (m)</label>
                <input className="input" type="number" min="10" max="2000" value={settings.max_accuracy_meters} onChange={(e) => setNumber("max_accuracy_meters", e.target.value)} />
              </div>
              <div className="field">
                <label>Refresh QR (detik)</label>
                <input className="input" type="number" min="10" max="25" value={settings.qr_refresh_seconds} onChange={(e) => setNumber("qr_refresh_seconds", e.target.value)} />
              </div>
              <div className="field">
                <label>Tiket Check-in (menit)</label>
                <input className="input" type="number" min="1" max="15" value={settings.checkin_ticket_minutes} onChange={(e) => setNumber("checkin_ticket_minutes", e.target.value)} />
              </div>
              <div className="field system-settings-wide">
                <label>Pesan Bantuan Presensi</label>
                <textarea className="input" rows={3} value={settings.support_message} onChange={(e) => setSettings({ ...settings, support_message: e.target.value })} />
              </div>
            </div>
          )}

          <div className="system-action-row">
            <button className="btn btn-primary" type="button" disabled={saving || loadingSettings} onClick={() => void saveSettings()}>
              {saving ? "Menyimpan…" : "Simpan Pengaturan"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel system-health-panel">
        <div className="panel-head">
          <div>
            <h2>Health Check & Backup</h2>
            <p>Verifikasi env, koneksi database, dan tabel produksi sebelum digunakan di kelas.</p>
          </div>
          {health && <span className={`badge ${health.status === "healthy" ? "good" : "warn"}`}>{health.status === "healthy" ? "Healthy" : "Degraded"}</span>}
        </div>
        <div className="panel-body">
          <div className="system-action-row system-action-row-top">
            <button className="btn btn-secondary" type="button" disabled={checking} onClick={() => void runHealthCheck()}>
              {checking ? "Memeriksa…" : "↻ Jalankan Health Check"}
            </button>
            <button className="btn btn-secondary" type="button" disabled={backingUp} onClick={() => void downloadBackup()}>
              {backingUp ? "Membuat Backup…" : "⬇ Backup JSON"}
            </button>
          </div>

          <div className="health-check-list">
            {health?.checks.map((check) => (
              <div className={`health-check-item ${check.ok ? "ok" : "failed"}`} key={check.key}>
                <span className="health-check-icon" aria-hidden="true">{check.ok ? "✓" : "!"}</span>
                <span><strong>{check.label}</strong><small>{check.detail}</small></span>
              </div>
            ))}
            {!health && !checking && <div className="empty-state compact">Belum ada hasil health check.</div>}
          </div>

          <div className="system-note">
            <strong>Backup tidak menyimpan secret environment atau password Auth.</strong>
            <span>File berisi data aplikasi yang dapat dipakai untuk investigasi dan pemulihan terkontrol.</span>
          </div>
        </div>
      </section>

      {message && <div className={`system-message ${isError ? "error" : "success"}`}>{message}</div>}
    </div>
  );
}
