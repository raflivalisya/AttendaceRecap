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
  const [editing, setEditing] = useState<Account | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const uniqueStudents = useMemo(() => {
    const map = new Map<string, string>();

    for (const student of students) {
      if (!map.has(student.npm)) map.set(student.npm, student.name);
    }

    return Array.from(map, ([studentNpm, name]) => ({
      npm: studentNpm,
      name,
    })).sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [students]);

  async function load() {
    setLoading(true);

    const response = await fetch("/api/admin/student-accounts", {
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      setAccounts((result.accounts ?? []) as Account[]);
    } else {
      setMessage(result.error || "Gagal memuat akun mahasiswa.");
      setIsError(true);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createAccount() {
    if (!npm) {
      setMessage("Pilih NPM mahasiswa.");
      setIsError(true);
      return;
    }

    setSaving(true);
    setMessage("");
    setIsError(false);

    const response = await fetch("/api/admin/student-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ npm }),
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      setNpm("");
      setMessage(
        `Akun ${result.account?.npm ?? ""} siap. Password awal = NPM.`,
      );
      await load();
    } else {
      setMessage(result.error || "Gagal membuat akun mahasiswa.");
      setIsError(true);
    }

    setSaving(false);
  }

  async function syncAllAccounts() {
    const ok = window.confirm(
      "Buat otomatis akun Student Portal untuk seluruh NPM yang belum punya akun? Password awal setiap akun akan sama dengan NPM.",
    );

    if (!ok) return;

    setSaving(true);
    setMessage("");
    setIsError(false);

    const response = await fetch("/api/admin/student-accounts", {
      method: "PUT",
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      setMessage(
        `Sinkronisasi selesai. ${result.created ?? 0} akun baru, ${result.existing ?? 0} akun sudah ada${
          result.errors?.length ? `, ${result.errors.length} gagal` : ""
        }.`,
      );
      setIsError(Boolean(result.errors?.length));
      await load();
    } else {
      setMessage(result.error || "Sinkronisasi akun gagal.");
      setIsError(true);
    }

    setSaving(false);
  }

  async function saveEdit(resetToNpm = false) {
    if (!editing) return;

    if (!resetToNpm && newPassword && newPassword.length < 6) {
      setMessage("Password baru minimal 6 karakter.");
      setIsError(true);
      return;
    }

    setSaving(true);
    setMessage("");
    setIsError(false);

    const response = await fetch("/api/admin/student-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: editing.user_id,
        new_password: resetToNpm ? "" : newPassword,
        reset_to_npm: resetToNpm,
        is_active: editing.is_active,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      setMessage(
        resetToNpm
          ? `Password ${editing.npm} sudah dikembalikan menjadi NPM.`
          : "Akun mahasiswa berhasil diperbarui.",
      );
      setEditing(null);
      setNewPassword("");
      await load();
    } else {
      setMessage(result.error || "Gagal memperbarui akun mahasiswa.");
      setIsError(true);
    }

    setSaving(false);
  }

  const accountNpms = new Set(accounts.map((account) => account.npm));

  const availableStudents = uniqueStudents.filter(
    (student) => !accountNpms.has(student.npm),
  );

  return (
    <section className="panel academic-feature-panel">
      <div className="panel-head">
        <div>
          <h2>Akun Student Portal</h2>
          <p>
            Username = NPM. Password default akun baru = NPM. Mahasiswa baru
            yang ditambahkan dari website akan dibuatkan akun otomatis.
          </p>
        </div>

        <span className="badge neutral">{accounts.length} akun</span>
      </div>

      <div className="panel-body">
        <div
          className="success"
          style={{ marginBottom: 16 }}
        >
          <strong>Aturan Login Mahasiswa</strong>
          <div style={{ marginTop: 4 }}>
            NPM <b>25316001</b> → password awal <b>25316001</b>.
          </div>
        </div>

        <div className="academic-account-create">
          <div className="field">
            <label>Buat akun untuk data lama</label>

            <select
              className="select"
              value={npm}
              onChange={(event) => setNpm(event.target.value)}
            >
              <option value="">— Pilih NPM / Nama —</option>

              {availableStudents.map((student) => (
                <option value={student.npm} key={student.npm}>
                  {student.npm} — {student.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !npm}
            onClick={() => void createAccount()}
          >
            Buat Akun (Password = NPM)
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={() => void syncAllAccounts()}
          >
            ↻ Sinkronkan Semua Akun
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

        {editing && (
          <div className="academic-account-edit">
            <div>
              <strong>{editing.full_name}</strong>
              <span>NPM {editing.npm}</span>
            </div>

            <div className="field">
              <label>Password Baru (opsional)</label>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Kosongkan jika tidak diubah"
              />
            </div>

            <label className="academic-switch-row">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    is_active: event.target.checked,
                  })
                }
              />
              <span>Akun aktif</span>
            </label>

            <div className="admin-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={() => void saveEdit(false)}
              >
                Simpan
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => void saveEdit(true)}
              >
                Reset Password = NPM
              </button>

              <button
                type="button"
                className="btn btn-secondary"
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

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>NPM</th>
                <th>Nama</th>
                <th>Password Default</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody>
              {accounts.map((account) => (
                <tr key={account.user_id}>
                  <td>{account.npm}</td>

                  <td>
                    <strong>{account.full_name}</strong>
                  </td>

                  <td>
                    <span className="badge neutral">NPM</span>
                  </td>

                  <td>
                    <span
                      className={`badge ${
                        account.is_active ? "good" : "warn"
                      }`}
                    >
                      {account.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>

                  <td>
                    {new Date(account.created_at).toLocaleDateString("id-ID")}
                  </td>

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
