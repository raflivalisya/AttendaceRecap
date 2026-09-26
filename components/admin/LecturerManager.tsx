"use client";

import { useState } from "react";
import type { LecturerAccount } from "@/lib/auth/lecturers";

type Props = {
  lecturers: LecturerAccount[];
  loading: boolean;
  onCreated: (lecturer: LecturerAccount) => void;
};

async function readJson(response: Response) {
  const raw = await response.text();

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      `Server tidak mengembalikan JSON (HTTP ${response.status}).`,
    );
  }
}

export default function LecturerManager({
  lecturers,
  loading,
  onCreated,
}: Props) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function createLecturer() {
    if (saving) return;

    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/admin/lecturers", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          display_name: displayName,
          email,
          password,
        }),
      });

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(result.message || "Gagal membuat akun dosen.");
      }

      onCreated(result.lecturer as LecturerAccount);
      setDisplayName("");
      setEmail("");
      setPassword("");
      setMessage(
        "Akun dosen berhasil dibuat dan langsung bisa dipilih saat membuat mata kuliah.",
      );
    } catch (error: any) {
      setIsError(true);
      setMessage(error?.message || "Gagal membuat akun dosen.");
    } finally {
      setSaving(false);
    }
  }

  async function editLecturerName(lecturer: LecturerAccount) {
    const nextName = window.prompt(
      "Nama dosen:",
      lecturer.display_name,
    )?.trim();

    if (!nextName || nextName === lecturer.display_name) return;

    if (nextName.length < 3) {
      setIsError(true);
      setMessage("Nama dosen minimal 3 karakter.");
      return;
    }

    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/admin/lecturers", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          user_id: lecturer.user_id,
          display_name: nextName,
        }),
      });

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(result.message || "Gagal mengubah nama dosen.");
      }

      // Reload agar nama baru langsung ikut terbarui di dropdown dosen,
      // sidebar kelas, dan courses.lecturer yang sudah diperbarui server.
      window.location.reload();
    } catch (error: any) {
      setIsError(true);
      setMessage(error?.message || "Gagal mengubah nama dosen.");
      setSaving(false);
    }
  }

  return (
    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <div>
          <h2>Kelola Dosen</h2>
          <p>Buat akun login dan edit nama dosen dari Super Admin.</p>
        </div>
        <span className="badge neutral">{lecturers.length} dosen</span>
      </div>

      <div className="panel-body">
        <div className="form-grid-3" style={{ marginBottom: 18 }}>
          <div className="field">
            <label>Nama Dosen *</label>
            <input
              className="input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Auliya Rahman Isnain, S.Kom., M.Cs."
              disabled={saving}
            />
          </div>

          <div className="field">
            <label>Email *</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="dosen@teknokrat.ac.id"
              disabled={saving}
            />
          </div>

          <div className="field">
            <label>Password Awal *</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimal 8 karakter"
              disabled={saving}
            />
          </div>

          <div className="form-actions-full">
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                saving ||
                !displayName.trim() ||
                !email.trim() ||
                password.length < 8
              }
              onClick={() => void createLecturer()}
            >
              {saving ? "Memproses..." : "+ Buat Akun Dosen"}
            </button>
          </div>
        </div>

        {message && (
          <div
            className={isError ? "error" : "success"}
            style={{ marginBottom: 16 }}
          >
            {message}
          </div>
        )}

        {loading ? (
          <p className="muted">Memuat daftar dosen...</p>
        ) : lecturers.length === 0 ? (
          <div className="empty-state">Belum ada akun dosen.</div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Dosen</th>
                  <th>Email</th>
                  <th>Mata Kuliah</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {lecturers
                  .filter((lecturer) => lecturer.role === "lecturer")
                  .map((lecturer, index) => (
                    <tr key={lecturer.user_id}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{lecturer.display_name}</strong>
                      </td>
                      <td>{lecturer.email || "-"}</td>
                      <td>{lecturer.course_count}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          disabled={saving}
                          onClick={() => void editLecturerName(lecturer)}
                        >
                          Edit Nama
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
