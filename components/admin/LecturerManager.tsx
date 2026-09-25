"use client";

import { useState } from "react";
import type { LecturerAccount } from "@/lib/auth/lecturers";

type Props = {
  lecturers: LecturerAccount[];
  loading: boolean;
  onCreated: (lecturer: LecturerAccount) => void;
};

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

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Gagal membuat akun dosen.");
      }

      onCreated(result.lecturer as LecturerAccount);
      setDisplayName("");
      setEmail("");
      setPassword("");
      setMessage("Akun dosen berhasil dibuat dan langsung bisa dipilih saat membuat mata kuliah.");
    } catch (error: any) {
      setIsError(true);
      setMessage(error?.message || "Gagal membuat akun dosen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <div>
          <h2>Kelola Dosen</h2>
          <p>Buat akun login dosen langsung dari Super Admin.</p>
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
              {saving ? "Membuat Akun..." : "+ Buat Akun Dosen"}
            </button>
          </div>
        </div>

        {message && (
          <div className={isError ? "error" : "success"} style={{ marginBottom: 16 }}>
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
                </tr>
              </thead>
              <tbody>
                {lecturers.map((lecturer, index) => (
                  <tr key={lecturer.user_id}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{lecturer.display_name}</strong>
                    </td>
                    <td>{lecturer.email || "-"}</td>
                    <td>{lecturer.course_count}</td>
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
