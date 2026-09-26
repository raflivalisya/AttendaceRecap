"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentLoginForm() {
  const router = useRouter();
  const [npm, setNpm] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/student/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npm: npm.trim(), password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Login gagal.");
      router.push("/student");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="student-login-page">
      <section className="student-login-card">
        <div className="student-login-brand">
          <div className="student-brand-mark">UTI</div>
          <div>
            <span>PORTAL MAHASISWA</span>
            <strong>Universitas Teknokrat Indonesia</strong>
          </div>
        </div>

        <div className="student-login-copy">
          <span className="student-kicker">AKADEMIK</span>
          <h1>Masuk Student Portal</h1>
          <p>Lihat absensi, nilai yang dipublikasikan, dan jadwal kuliah menggunakan akun yang dibuat oleh Super Admin.</p>
        </div>

        <form onSubmit={submit}>
          <label>
            <span>NPM</span>
            <input
              value={npm}
              onChange={(e) => setNpm(e.target.value)}
              placeholder="Contoh: 23111001"
              autoComplete="username"
              disabled={loading}
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </label>

          {message && <div className="student-login-error">{message}</div>}

          <button type="submit" disabled={loading || !npm.trim() || !password}>
            {loading ? "Memproses..." : "Masuk Student Portal"}
          </button>
        </form>

        <small className="student-login-help">Jika belum memiliki akun atau lupa password, hubungi dosen / Super Admin.</small>
      </section>
    </main>
  );
}
