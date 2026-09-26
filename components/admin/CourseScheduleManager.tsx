"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CourseScheduleSlot } from "@/lib/asdos/types";

type Props = {
  courseId: string;
  meetingCount: number;
};

type DraftSlot = {
  id?: string;
  weekday: number;
  day_name: string;
  start_time: string;
  end_time: string;
  room: string;
};

const DAYS = [
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
  { value: 7, label: "Minggu" },
];

function blankSlot(): DraftSlot {
  return {
    weekday: 1,
    day_name: "Senin",
    start_time: "09:00",
    end_time: "11:00",
    room: "",
  };
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

export default function CourseScheduleManager({
  courseId,
  meetingCount,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [slots, setSlots] = useState<DraftSlot[]>([]);
  const [newSlot, setNewSlot] = useState<DraftSlot>(blankSlot());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function load() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { data, error } = await supabase
      .from("course_schedules")
      .select("*")
      .eq("course_id", courseId)
      .order("weekday")
      .order("start_time");

    if (error) {
      setMessage(`Gagal memuat jadwal: ${error.message}`);
      setIsError(true);
      setLoading(false);
      return;
    }

    setSlots(
      ((data ?? []) as CourseScheduleSlot[]).map((item) => ({
        id: item.id,
        weekday: item.weekday,
        day_name: item.day_name,
        start_time: normalizeTime(item.start_time),
        end_time: normalizeTime(item.end_time),
        room: item.room ?? "",
      })),
    );

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [courseId]);

  function updateNewDay(weekday: number) {
    const day = DAYS.find((item) => item.value === weekday);
    setNewSlot((current) => ({
      ...current,
      weekday,
      day_name: day?.label ?? "Senin",
    }));
  }

  function addSlot() {
    if (!newSlot.start_time || !newSlot.end_time) {
      setMessage("Jam mulai dan selesai wajib diisi.");
      setIsError(true);
      return;
    }

    if (newSlot.start_time >= newSlot.end_time) {
      setMessage("Jam selesai harus lebih besar dari jam mulai.");
      setIsError(true);
      return;
    }

    const duplicate = slots.some(
      (slot) =>
        slot.weekday === newSlot.weekday &&
        slot.start_time === newSlot.start_time &&
        slot.end_time === newSlot.end_time,
    );

    if (duplicate) {
      setMessage("Slot jadwal yang sama sudah ada.");
      setIsError(true);
      return;
    }

    setSlots((current) =>
      [...current, { ...newSlot }].sort(
        (a, b) =>
          a.weekday - b.weekday ||
          a.start_time.localeCompare(b.start_time),
      ),
    );

    setNewSlot(blankSlot());
    setMessage("");
    setIsError(false);
  }

  function removeSlot(index: number) {
    setSlots((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function saveSchedules() {
    setSaving(true);
    setMessage("");
    setIsError(false);

    const payload = slots.map((slot) => ({
      weekday: slot.weekday,
      day_name: slot.day_name,
      start_time: slot.start_time,
      end_time: slot.end_time,
      room: slot.room.trim(),
    }));

    const { data, error } = await supabase.rpc("replace_course_schedules", {
      target_course_id: courseId,
      slots: payload,
    });

    if (error) {
      setMessage(`Gagal menyimpan jadwal: ${error.message}`);
      setIsError(true);
      setSaving(false);
      return;
    }

    setMessage(`${Number(data ?? payload.length)} slot jadwal berhasil disimpan.`);
    setIsError(false);
    setSaving(false);

    // Reload agar ringkasan courses.schedule di header/pengaturan ikut berubah.
    window.setTimeout(() => window.location.reload(), 450);
  }

  async function syncMeetings() {
    if (!slots.length) {
      setMessage("Isi minimal satu jadwal sebelum sinkronisasi P1-P16.");
      setIsError(true);
      return;
    }

    const preview = slots
      .map(
        (slot) =>
          `${slot.day_name} ${slot.start_time}–${slot.end_time}${
            slot.room ? ` (${slot.room})` : ""
          }`,
      )
      .join("\n");

    const ok = window.confirm(
      `Sinkronkan tanggal ${meetingCount} pertemuan berdasarkan jadwal berikut?\n\n${preview}\n\nJika ada 2 slot/minggu, urutannya menjadi P1 slot pertama, P2 slot kedua, lalu minggu berikutnya.`,
    );

    if (!ok) return;

    setSaving(true);
    setMessage("");
    setIsError(false);

    const { data, error } = await supabase.rpc(
      "sync_course_meetings_from_shared_schedule",
      { target_course_id: courseId },
    );

    if (error) {
      setMessage(`Gagal sinkronisasi pertemuan: ${error.message}`);
      setIsError(true);
      setSaving(false);
      return;
    }

    setMessage(`${Number(data ?? 0)} tanggal pertemuan berhasil disinkronkan.`);
    setSaving(false);
    setIsError(false);
  }

  return (
    <section
      style={{
        marginTop: 18,
        padding: 16,
        border: "1px solid #d8e1eb",
        borderRadius: 14,
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <strong>Jadwal Mingguan Mata Kuliah</strong>
          <div className="muted" style={{ marginTop: 4 }}>
            Satu sumber jadwal untuk Dosen/Admin dan Asdos. Bisa 1x, 2x, atau lebih per minggu.
          </div>
        </div>

        <span className={`badge ${slots.length > 1 ? "good" : "neutral"}`}>
          {slots.length} pertemuan/minggu
        </span>
      </div>

      {loading ? (
        <div className="muted">Memuat jadwal...</div>
      ) : (
        <>
          {slots.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Hari</th>
                    <th>Mulai</th>
                    <th>Selesai</th>
                    <th>Ruang</th>
                    <th>Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {slots.map((slot, index) => (
                    <tr key={`${slot.weekday}-${slot.start_time}-${index}`}>
                      <td>
                        <select
                          className="select"
                          value={slot.weekday}
                          onChange={(event) => {
                            const weekday = Number(event.target.value);
                            const label =
                              DAYS.find((item) => item.value === weekday)?.label ??
                              "Senin";

                            setSlots((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, weekday, day_name: label }
                                  : item,
                              ),
                            );
                          }}
                        >
                          {DAYS.map((day) => (
                            <option key={day.value} value={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          className="input"
                          type="time"
                          value={slot.start_time}
                          onChange={(event) =>
                            setSlots((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, start_time: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          type="time"
                          value={slot.end_time}
                          onChange={(event) =>
                            setSlots((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, end_time: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          value={slot.room}
                          placeholder="Lab / Ruang"
                          onChange={(event) =>
                            setSlots((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, room: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>

                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          onClick={() => removeSlot(index)}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="form-grid-3">
            <div className="field">
              <label>Hari</label>
              <select
                className="select"
                value={newSlot.weekday}
                onChange={(event) => updateNewDay(Number(event.target.value))}
              >
                {DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Jam Mulai</label>
              <input
                className="input"
                type="time"
                value={newSlot.start_time}
                onChange={(event) =>
                  setNewSlot((current) => ({
                    ...current,
                    start_time: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label>Jam Selesai</label>
              <input
                className="input"
                type="time"
                value={newSlot.end_time}
                onChange={(event) =>
                  setNewSlot((current) => ({
                    ...current,
                    end_time: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label>Ruang</label>
              <input
                className="input"
                value={newSlot.room}
                placeholder="Contoh: Lab 1 GSG"
                onChange={(event) =>
                  setNewSlot((current) => ({
                    ...current,
                    room: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field" style={{ justifyContent: "flex-end" }}>
              <label>&nbsp;</label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addSlot}
              >
                + Tambah Slot
              </button>
            </div>
          </div>

          <div className="admin-actions" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveSchedules()}
              disabled={saving}
            >
              {saving ? "Menyimpan..." : "Simpan Jadwal"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void syncMeetings()}
              disabled={saving || !slots.length}
            >
              Sinkronkan P1–P{meetingCount}
            </button>
          </div>

          {message && (
            <div
              className={isError ? "error" : "success"}
              style={{ marginTop: 14 }}
            >
              {message}
            </div>
          )}
        </>
      )}
    </section>
  );
}
