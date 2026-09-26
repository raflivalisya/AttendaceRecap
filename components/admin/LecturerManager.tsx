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

  const [editing, setEditing] = useState<LecturerAccount | null>(null);
  const [editName, setEditName] = useState("");
  const [newPassword, setNewPassword] = useState("");

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

  function startEdit(lecturer: LecturerAccount) {
    setEditing(lecturer);
    setEditName(lecturer.display_name);
    setNewPassword("");
    setMessage("");
    setIsError(false);
  }

  async function saveEdit() {
    if (!editing || saving) return;

    if (editName.trim().length < 3) {
      setIsError(true);
      setMessage("Nama dosen minimal 3 karakter.");
      return;
    }

    if (newPassword && newPassword.length < 8) {
      setIsError(true);
      setMessage("Password baru minimal 8 karakter.");
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
          user_id: editing.user_id,
          display_name: editName.trim(),
          new_password: newPassword,
        }),
      });

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          result.message || "Gagal memperbarui akun dosen.",
        );
      }

      setMessage(
        newPassword
          ? "Nama dosen dan password berhasil diperbarui."
          : "Nama dosen berhasil diperbarui.",
      );

      setEditing(null);
      setNewPassword("");

      window.setTimeout(() => window.location.reload(), 450);
    } catch (error: any) {
      setIsError(true);
      setMessage(error?.message || "Gagal memperbarui akun dosen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <div>
          <h2>Kelola Dosen & Akun</h2>
          <p>Buat akun, edit nama, dan reset password dosen.</p>
        </div>
        <span className="badge neutral">
          {lecturers.length} dosen
        </span>
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
              {saving ? "Menyimpan..." : "+ Buat Akun Dosen"}
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

        {editing && (
          <div
            className="panel"
            style={{
              padding: 16,
              marginBottom: 18,
              background: "#f8fafc",
            }}
          >
            <strong>Edit Akun Dosen</strong>
            <div className="form-grid-3" style={{ marginTop: 14 }}>
              <div className="field">
                <label>Nama Dosen</label>
                <input
                  className="input"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </div>

              <div className="field">
                <label>Email Login</label>
                <input
                  className="input"
                  value={editing.email}
                  disabled
                />
              </div>

              <div className="field">
                <label>Password Baru</label>
                <input
                  className="input"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Kosongkan jika tidak diubah"
                />
              </div>
            </div>

            <div className="admin-actions" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={() => void saveEdit()}
              >
                Simpan Perubahan
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => {
                  setEditing(null);
                  setNewPassword("");
                }}
              >
                Batal
              </button>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama</th>
                <th>Email</th>
                <th>Mata Kuliah</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody>
              {lecturers.map((lecturer, index) => (
                <tr key={lecturer.user_id}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{lecturer.display_name}</strong>
                  </td>
                  <td>{lecturer.email || "—"}</td>
                  <td>
                    <span className="badge neutral">
                      {lecturer.course_count} kelas
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      disabled={saving}
                      onClick={() => startEdit(lecturer)}
                    >
                      Edit / Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && lecturers.length === 0 && (
            <div className="empty-state">
              Belum ada akun dosen.
            </div>
          )}

          {loading && (
            <div className="empty-state">
              Memuat daftar dosen...
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
