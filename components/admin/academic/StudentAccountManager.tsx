"use client";

import { useEffect, useMemo, useState } from "react";
import type { Student } from "@/lib/types";

type Account = {
  user_id: string;
  npm: string;
  full_name: string;
  auth_email: string;
  is_active: boolean;
  created_at: string;
};

type Props = { students: Student[] };

export default function StudentAccountManager({ students }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [npm, setNpm] = useState("");
  const [password, setPassword] = useState("");
  const [editing, setEditing] = useState<Account | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const uniqueStudents = useMemo(() => {
    const map = new Map<string, string>();
    for (const student of students) {
      if (!map.has(student.npm)) map.set(student.npm, student.name);
    }
    return Array.from(map, ([studentNpm, name]) => ({ npm: studentNpm, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [students]);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/student-accounts", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setAccounts((result.accounts ?? []) as Account[]);
    else setMessage(result.error || "Gagal memuat akun mahasiswa.");
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createAccount() {
    if (!npm || password.length < 8) {
      setMessage("Pilih NPM dan isi password minimal 8 karakter.");
      return;
    }

    setSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/student-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ npm, password }),
    });
    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      setNpm("");
      setPassword("");
      setMessage("Akun mahasiswa berhasil dibuat.");
      await load();
    } else {
      setMessage(result.error || "Gagal membuat akun mahasiswa.");
    }

    setSaving(false);
  }

  async function saveEdit() {
    if (!editing) return;
    if (newPassword && newPassword.length < 8) {
      setMessage("Password baru minimal 8 karakter.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/admin/student-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: editing.user_id,
        new_password: newPassword,
        is_active: editing.is_active,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      setMessage("Akun mahasiswa berhasil diperbarui.");
      setEditing(null);
      setNewPassword("");
      await load();
    } else {
      setMessage(result.error || "Gagal memperbarui akun mahasiswa.");
    }

    setSaving(false);
  }

  const accountNpms = new Set(accounts.map((account) => account.npm));
  const availableStudents = uniqueStudents.filter((student) => !accountNpms.has(student.npm));

  return (
    <section className="panel academic-feature-panel">
      <div className="panel-head">
        <div>
          <h2>Akun Student Portal</h2>
          <p>Mahasiswa login menggunakan NPM + password di /student/login.</p>
        </div>
        <span className="badge neutral">{accounts.length} akun</span>
      </div>

      <div className="panel-body">
        <div className="academic-account-create">
          <div className="field">
            <label>Mahasiswa</label>
            <select className="select" value={npm} onChange={(e) => setNpm(e.target.value)}>
              <option value="">— Pilih NPM / Nama —</option>
              {availableStudents.map((student) => (
                <option value={student.npm} key={student.npm}>
                  {student.npm} — {student.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Password Awal</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
            />
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !npm || password.length < 8}
            onClick={() => void createAccount()}
          >
            + Buat Akun Mahasiswa
          </button>
        </div>

        {message && <div className="success" style={{ marginTop: 14 }}>{message}</div>}

        {editing && (
          <div className="academic-account-edit">
            <div>
              <strong>{editing.full_name}</strong>
              <span>{editing.npm}</span>
            </div>

            <div className="field">
              <label>Password Baru</label>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Kosongkan jika tidak diubah"
              />
            </div>

            <label className="academic-switch-row">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
              />
              <span>Akun aktif</span>
            </label>

            <div className="admin-actions">
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveEdit()}>
                Simpan
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
                Batal
              </button>
            </div>
          </div>
        )}

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>NPM</th>
                <th>Nama</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.user_id}>
                  <td>{account.npm}</td>
                  <td><strong>{account.full_name}</strong></td>
                  <td>
                    <span className={`badge ${account.is_active ? "good" : "warn"}`}>
                      {account.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td>{new Date(account.created_at).toLocaleDateString("id-ID")}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => {
                        setEditing({ ...account });
                        setNewPassword("");
                      }}
                    >
                      Edit / Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && <div className="empty-state">Memuat akun...</div>}
      </div>
    </section>
  );
}
