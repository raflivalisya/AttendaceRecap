import { CAMPUS_LOCATION } from "@/lib/campus";

export type SystemSettings = {
  app_name: string;
  campus_name: string;
  campus_latitude: number;
  campus_longitude: number;
  default_radius_meters: number;
  max_accuracy_meters: number;
  qr_refresh_seconds: number;
  checkin_ticket_minutes: number;
  support_message: string;
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  app_name: "AttendanceRecap",
  campus_name: CAMPUS_LOCATION.name,
  campus_latitude: CAMPUS_LOCATION.latitude,
  campus_longitude: CAMPUS_LOCATION.longitude,
  default_radius_meters: CAMPUS_LOCATION.defaultRadius,
  max_accuracy_meters: CAMPUS_LOCATION.maxAccuracy,
  qr_refresh_seconds: 20,
  checkin_ticket_minutes: 5,
  support_message:
    "Jika presensi gagal, pastikan GPS aktif, izin lokasi diberikan, dan gunakan QR terbaru.",
};

const numericKeys: Array<keyof SystemSettings> = [
  "campus_latitude",
  "campus_longitude",
  "default_radius_meters",
  "max_accuracy_meters",
  "qr_refresh_seconds",
  "checkin_ticket_minutes",
];

export function normalizeSystemSettings(
  rows: Array<{ key: string; value: unknown }> | null | undefined,
): SystemSettings {
  const next: SystemSettings = { ...DEFAULT_SYSTEM_SETTINGS };

  for (const row of rows ?? []) {
    if (!(row.key in next)) continue;

    const key = row.key as keyof SystemSettings;
    const raw = row.value;
    const unwrapped =
      raw && typeof raw === "object" && !Array.isArray(raw) && "value" in raw
        ? (raw as { value: unknown }).value
        : raw;

    if (numericKeys.includes(key)) {
      const numberValue = Number(unwrapped);
      if (Number.isFinite(numberValue)) {
        (next as Record<string, unknown>)[key] = numberValue;
      }
      continue;
    }

    if (typeof unwrapped === "string") {
      (next as Record<string, unknown>)[key] = unwrapped;
    }
  }

  return next;
}

export function validateSystemSettings(input: Partial<SystemSettings>) {
  const errors: string[] = [];

  const lat = Number(input.campus_latitude);
  const lng = Number(input.campus_longitude);
  const radius = Number(input.default_radius_meters);
  const accuracy = Number(input.max_accuracy_meters);
  const refresh = Number(input.qr_refresh_seconds);
  const ticket = Number(input.checkin_ticket_minutes);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.push("Latitude kampus harus berada di rentang -90 sampai 90.");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    errors.push("Longitude kampus harus berada di rentang -180 sampai 180.");
  }
  if (!Number.isFinite(radius) || radius < 20 || radius > 5000) {
    errors.push("Radius default harus 20–5000 meter.");
  }
  if (!Number.isFinite(accuracy) || accuracy < 10 || accuracy > 2000) {
    errors.push("Batas akurasi GPS harus 10–2000 meter.");
  }
  if (!Number.isFinite(refresh) || refresh < 10 || refresh > 25) {
    errors.push("Refresh QR harus 10–25 detik.");
  }
  if (!Number.isFinite(ticket) || ticket < 1 || ticket > 15) {
    errors.push("Masa berlaku tiket check-in harus 1–15 menit.");
  }

  return errors;
}
