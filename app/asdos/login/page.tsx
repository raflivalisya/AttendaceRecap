"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AsdosLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim() || !password) {
      setMessage("Username dan password wajib diisi.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/asdos/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const raw = await response.text();

      let result: {
        ok?: boolean;
        error?: string;
        message?: string;
      } = {};

      try {
        result = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          `Server tidak mengembalikan JSON (HTTP ${response.status}).`
        );
      }

      if (!response.ok || result.ok === false) {
        throw new Error(
          result.error ||
            result.message ||
            "Username atau password salah."
        );
      }

      router.push("/asdos");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Login gagal. Silakan coba lagi."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#f4f7fb",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "520px",
          border: "1px solid #d7e0ea",
          borderRadius: "20px",
          background: "#ffffff",
          padding: "28px",
          boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            color: "#1670c5",
            fontWeight: 800,
            fontSize: "13px",
            letterSpacing: "1.1px",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          Portal Asisten Dosen
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: "clamp(32px, 7vw, 44px)",
            lineHeight: 1.05,
            color: "#0b1f33",
          }}
        >
          Masuk sebagai Asdos
        </h1>

        <p
          style={{
            margin: "14px 0 24px",
            color: "#5f7185",
            lineHeight: 1.6,
          }}
        >
          Gunakan username dan password yang dibuat oleh Super Admin.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "14px" }}>
            <label
              htmlFor="username"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                fontWeight: 800,
                color: "#18324d",
              }}
            >
              Username
            </label>

            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="contoh: raflivalisya"
              disabled={loading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #c9d6e4",
                borderRadius: "12px",
                padding: "13px 14px",
                fontSize: "15px",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                fontWeight: 800,
                color: "#18324d",
              }}
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #c9d6e4",
                borderRadius: "12px",
                padding: "13px 14px",
                fontSize: "15px",
                outline: "none",
              }}
            />
          </div>

          {message && (
            <div
              style={{
                marginBottom: "14px",
                padding: "11px 12px",
                borderRadius: "10px",
                background: "#fff0f0",
                color: "#c53030",
                fontSize: "14px",
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              border: 0,
              borderRadius: "12px",
              padding: "13px 16px",
              background: "#123f65",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Memproses..." : "Masuk Portal Asdos"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/rekap")}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "10px",
              border: "1px solid #d7e0ea",
              borderRadius: "12px",
              padding: "12px 16px",
              background: "#ffffff",
              color: "#18324d",
              fontSize: "14px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            ← Kembali ke Rekap
          </button>
        </form>
      </section>
    </main>
  );
}
