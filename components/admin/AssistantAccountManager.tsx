"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AssistantDirectoryItem } from "@/lib/asdos/types";

async function readApiResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {
      error: `Server tidak mengembalikan isi respons (HTTP ${response.status}).`,
    };
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const preview = text.replace(/\s+/g, " ").slice(0, 180);
    return {
      error: `Endpoint Asdos tidak mengembalikan JSON (HTTP ${response.status}). Respons: ${preview}`,
    };
  }
}

const emptyCreateForm = {
  full_name: "",
  username: "",
  password: "",
  npm: "",
  program_study: "",
};

export default function AssistantAccountManager() {
  const [items, setItems] = useState<AssistantDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [form, setForm] = useState(emptyCreateForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    username: "",
    npm: "",
    program_study: "",
    is_active: true,
    new_password: "",
  });

  async function load() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/admin/asdos/accounts", {
        cache: "no-store",
        credentials: "same-origin",
      });

      const result = await readApiResponse(response);

      if (!response.ok) {
        setMessage(
          typeof result.error === "string"
            ? result.error
            : "Gagal memuat akun Asdos.",
        );
        setIsError(true);
        return;
      }

      setItems(
        Array.isArray(result.assistants)
          ? (result.assistants as AssistantDirectoryItem[])
          : [],
      );
    } catch (error) {
      setMessage(
        `Gagal menghubungi endpoint akun Asdos: ${
          error instanceof Error ? error.message : "Network error"
        }`,
      );
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/admin/asdos/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(form),
      });

      const result = await readApiResponse(response);

      if (!response.ok) {
        setMessage(
          typeof result.error === "string"
            ? result.error
            : `Gagal membuat akun Asdos (HTTP ${response.status}).`,
        );
        setIsError(true);
        return;
      }

      setForm(emptyCreateForm);
      setMessage("Akun Asisten Dosen berhasil dibuat.");
      setIsError(false);
      await load();
    } catch (error) {
      setMessage(
        `Gagal menghubungi server: ${
          error instanceof Error ? error.message : "Network error"
        }`,
      );
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: AssistantDirectoryItem) {
    setEditingUserId(item.user_id);
    setEditForm({
      full_name: item.full_name,
      username: item.username,
      npm: item.npm ?? "",
      program_study: item.program_study ?? "",
      is_active: item.is_active,
      new_password: "",
    });
    setMessage("");
    setIsError(false);
  }

  function cancelEdit() {
    setEditingUserId(null);
    setEditForm({
      full_name: "",
      username: "",
      npm: "",
      program_study: "",
      is_active: true,
      new_password: "",
    });
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingUserId) return;

    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/admin/asdos/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          user_id: editingUserId,
          ...editForm,
        }),
      });

      const result = await readApiResponse(response);

      if (!response.ok) {
        setMessage(
          typeof result.error === "string"
            ? result.error
            : `Gagal memperbarui akun Asdos (HTTP ${response.status}).`,
        );
        setIsError(true);
        return;
      }

      setMessage("Akun Asisten Dosen berhasil diperbarui.");
      setIsError(false);
      cancelEdit();
      await load();
    } catch (error) {
      setMessage(
        `Gagal memperbarui akun: ${
          error instanceof Error ? error.message : "Network error"
        }`,
      );
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(item: AssistantDirectoryItem) {
    const warning = [
      `Hapus akun Asdos ${item.full_name} (@${item.username})?`,
      "",
      "Tindakan ini PERMANEN dan akan menghapus:",
      "• akun login Asdos",
      "• penugasan Asdos ke mata kuliah",
      "• jadwal asistensi",
      "• rekap kegiatan Asdos",
      "• riwayat import jadwal",
      "",
      "Jika hanya ingin menghentikan akses sementara, gunakan Edit → Nonaktif.",
    ].join("\n");

    if (!window.confirm(warning)) return;

    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/admin/asdos/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ user_id: item.user_id }),
      });

      const result = await readApiResponse(response);

      if (!response.ok) {
        setMessage(
          typeof result.error === "string"
            ? result.error
            : `Gagal menghapus akun Asdos (HTTP ${response.status}).`,
        );
        setIsError(true);
        return;
      }

      if (editingUserId === item.user_id) cancelEdit();
      setItems((current) => current.filter((row) => row.user_id !== item.user_id));
      setMessage(`Akun ${item.full_name} berhasil dihapus permanen.`);
      setIsError(false);
    } catch (error) {
      setMessage(
        `Gagal menghapus akun: ${
          error instanceof Error ? error.message : "Network error"
        }`,
      );
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-head">
        <div>
          <h2>Kelola Asisten Dosen & Akun</h2>
          <p>Buat, edit, nonaktifkan, reset password, atau hapus akun Asisten Dosen.</p>
        </div>
        <span className="badge neutral">{items.length} akun</span>
      </div>

      <div className="panel-body">
        <form className="form-grid-3" onSubmit={submit}>
          <div className="field">
            <label>Nama Lengkap *</label>
            <input
              className="input"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Rafli Indra Valisya"
              required
            />
          </div>

          <div className="field">
            <label>Username *</label>
            <input
              className="input"
              autoCapitalize="none"
              autoCorrect="off"
              value={form.username}
              onChange={(e) =>
                setForm({
                  ...form,
                  username: e.target.value.toLowerCase().replace(/\s+/g, ""),
                })
              }
              placeholder="rafliindra"
              minLength={3}
              maxLength={32}
              required
            />
          </div>

          <div className="field">
            <label>Password Awal *</label>
            <input
              className="input"
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimal 8 karakter"
              required
            />
          </div>

          <div className="field">
            <label>NPM</label>
            <input
              className="input"
              value={form.npm}
              onChange={(e) => setForm({ ...form, npm: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Program Studi</label>
            <input
              className="input"
              value={form.program_study}
              onChange={(e) => setForm({ ...form, program_study: e.target.value })}
              placeholder="Informatika"
            />
          </div>

          <div className="field" style={{ justifyContent: "flex-end" }}>
            <label>&nbsp;</label>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan..." : "+ Buat Akun Asdos"}
            </button>
          </div>
        </form>

        {message && (
          <div className={isError ? "error" : "success"} style={{ marginTop: 14 }}>
            {message}
          </div>
        )}

        {editingUserId && (
          <form
            onSubmit={saveEdit}
            className="panel"
            style={{ marginTop: 18, padding: 16, background: "#f8fafc" }}
          >
            <div style={{ marginBottom: 14 }}>
              <strong>Edit Akun Asisten Dosen</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                Password baru boleh dikosongkan jika tidak ingin mengganti password.
              </div>
            </div>

            <div className="form-grid-3">
              <div className="field">
                <label>Nama Lengkap *</label>
                <input
                  className="input"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="field">
                <label>Username *</label>
                <input
                  className="input"
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      username: e.target.value.toLowerCase().replace(/\s+/g, ""),
                    })
                  }
                  minLength={3}
                  maxLength={32}
                  required
                />
              </div>

              <div className="field">
                <label>Password Baru</label>
                <input
                  className="input"
                  type="password"
                  value={editForm.new_password}
                  onChange={(e) => setEditForm({ ...editForm, new_password: e.target.value })}
                  placeholder="Kosongkan jika tidak diubah"
                />
              </div>

              <div className="field">
                <label>NPM</label>
                <input
                  className="input"
                  value={editForm.npm}
                  onChange={(e) => setEditForm({ ...editForm, npm: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Program Studi</label>
                <input
                  className="input"
                  value={editForm.program_study}
                  onChange={(e) => setEditForm({ ...editForm, program_study: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Status Akun</label>
                <select
                  className="select"
                  value={editForm.is_active ? "active" : "inactive"}
                  onChange={(e) =>
                    setEditForm({ ...editForm, is_active: e.target.value === "active" })
                  }
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>
            </div>

            <div className="admin-actions" style={{ marginTop: 14 }}>
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                Batal
              </button>
            </div>
          </form>
        )}

        <div className="table-wrap" style={{ marginTop: 18 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama</th>
                <th>Username</th>
                <th>NPM</th>
                <th>Prodi</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.user_id}>
                  <td>{index + 1}</td>
                  <td><strong>{item.full_name}</strong></td>
                  <td>@{item.username}</td>
                  <td>{item.npm || "—"}</td>
                  <td>{item.program_study || "—"}</td>
                  <td>
                    <span className={`badge ${item.is_active ? "good" : "neutral"}`}>
                      {item.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => startEdit(item)}
                        disabled={saving}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={() => deleteAccount(item)}
                        disabled={saving}
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && items.length === 0 && (
            <div className="empty-state">Belum ada akun Asisten Dosen.</div>
          )}

          {loading && (
            <div className="empty-state">Memuat akun Asisten Dosen...</div>
          )}
        </div>
      </div>
    </section>
  );
}
