"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AsdosLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/asdos/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Login gagal.");
      setLoading(false);
      return;
    }
    router.push("/asdos");
    router.refresh();
  }

  return (
    <section className="page">
      <div className="shell" style={{ maxWidth: 520 }}>
        <form className="login-card" onSubmit={submit}>
          <div className="eyebrow">Portal Asisten Dosen</div>
          <h1>Masuk sebagai Asdos</h1>
          <p className="muted">Gunakan username dan password yang dibuat oleh Super Admin.</p>

          <div className="field" style={{ marginTop: 20 }}>
            <label>Username</label>
            <input className="input" autoCapitalize="none" autoCorrect="off" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="rafliindra" required />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>

          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} disabled={loading}>{loading ? "Memproses..." : "Masuk Portal Asdos"}</button>
        </form>
      </div>
    </section>
  );
}
