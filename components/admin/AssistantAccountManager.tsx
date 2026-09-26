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

export default function AssistantAccountManager() {
  const [items, setItems] = useState<AssistantDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    password: "",
    npm: "",
    program_study: "",
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
        setLoading(false);
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
        setSaving(false);
        return;
      }

      setForm({
        full_name: "",
        username: "",
        password: "",
        npm: "",
        program_study: "",
      });

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

  return (
    <section className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-head">
        <div>
          <h2>Kelola Asisten Dosen & Akun</h2>
          <p>Buat akun login username/password untuk Asisten Dosen.</p>
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
              onChange={(e) =>
                setForm({ ...form, full_name: e.target.value })
              }
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
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
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
              onChange={(e) =>
                setForm({ ...form, program_study: e.target.value })
              }
              placeholder="Informatika"
            />
          </div>

          <div className="field" style={{ justifyContent: "flex-end" }}>
            <label>&nbsp;</label>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Membuat..." : "+ Buat Akun Asdos"}
            </button>
          </div>
        </form>

        {message && (
          <div
            className={isError ? "error" : "success"}
            style={{ marginTop: 14 }}
          >
            {message}
          </div>
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
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.user_id}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.full_name}</strong>
                  </td>
                  <td>{item.username}</td>
                  <td>{item.npm || "—"}</td>
                  <td>{item.program_study || "—"}</td>
                  <td>
                    <span
                      className={`badge ${
                        item.is_active ? "good" : "neutral"
                      }`}
                    >
                      {item.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && items.length === 0 && (
            <div className="empty-state">
              Belum ada akun Asisten Dosen.
            </div>
          )}

          {loading && (
            <div className="empty-state">
              Memuat akun Asisten Dosen...
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
