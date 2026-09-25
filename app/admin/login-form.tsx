"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } 
from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email atau password admin tidak valid.");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <section className="page">
      <div className="shell">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="eyebrow">Administrator</div>
          <h1>Masuk ke Panel Admin</h1>
          <p className="muted">Gunakan akun yang sudah dibuat di Supabase Auth dan didaftarkan pada tabel <code>admin_profiles</code>.</p>
          <div className="field" style={{ marginTop: 20 }}><label>Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@kampus.ac.id" /></div>
          <div className="field" style={{ marginTop: 12 }}><label>Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" /></div>
          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} disabled={loading}>{loading ? "Memproses..." : "Masuk"}</button>
        </form>
      </div>
    </section>
  );
}
