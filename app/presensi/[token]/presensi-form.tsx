"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

type Props = {
  token: string;
};

type SessionInfo = {
  meetingNo: number;
  meetingDate: string;
  courseName: string;
  className: string;
  lecturer: string;
  schedule: string;
  endsAt: string;
};

export default function PresensiForm({
  token,
}: Props) {
  const [info, setInfo] =
    useState<SessionInfo | null>(
      null
    );

  const [npm, setNpm] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [success, setSuccess] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  useEffect(() => {
    async function loadSession() {
      try {
        const response =
          await fetch(
            `/api/presensi/${token}`,
            {
              cache: "no-store",
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          setMessage(
            result.message ||
              "Presensi tidak tersedia."
          );

          return;
        }

        setInfo(result.data);
      } catch {
        setMessage(
          "Gagal memuat presensi."
        );
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [token]);

  async function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!npm.trim()) {
      setMessage(
        "Masukkan NPM terlebih dahulu."
      );

      return;
    }

    setSending(true);
    setMessage("");

    try {
      const response =
        await fetch(
          `/api/presensi/${token}`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              npm: npm.trim(),
            }),
          }
        );

      const result =
        await response.json();

      setMessage(
        result.message
      );

      if (response.ok) {
        setSuccess(true);
      }
    } catch {
      setMessage(
        "Gagal mengirim presensi."
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <section className="page">
        <div className="shell">
          <div className="panel">
            <div className="panel-body">
              Memuat presensi...
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!info) {
    return (
      <section className="page">
        <div
  className="shell"
  style={{
    width: "100%",
    maxWidth: 600,
    margin: "0 auto",
  }}
>
          <div className="panel">
            <div className="panel-body">
              <h2>
                Presensi Tidak Tersedia
              </h2>

              <p>
                {message}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div
        className="shell"
        style={{
          maxWidth: 600,
        }}
      >
        <div className="hero">
          <div>
            <div className="eyebrow">
              Presensi Mahasiswa
            </div>

            <h1>
              {info.courseName}
            </h1>

            <p>
              Pertemuan{" "}
              {info.meetingNo}
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body">

            <div
              style={{
                marginBottom: 24,
              }}
            >
              <p>
                <strong>Kelas:</strong>{" "}
                {info.className}
              </p>

              <p>
                <strong>
                  Dosen:
                </strong>{" "}
                {info.lecturer}
              </p>

              <p>
                <strong>
                  Jadwal:
                </strong>{" "}
                {info.schedule || "-"}
              </p>

              <p>
                <strong>
                  Pertemuan:
                </strong>{" "}
                {info.meetingNo}
              </p>
            </div>

            {!success ? (
              <form
                onSubmit={submit}
              >
                <div className="field">
                  <label>
                    NPM
                  </label>

                  <input
                    className="input"
                    value={npm}
                    onChange={(e) =>
                      setNpm(
                        e.target.value
                      )
                    }
                    placeholder="Masukkan NPM"
                    autoComplete="off"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sending}
                  style={{
                    width: "100%",
                    marginTop: 16,
                  }}
                >
                  {sending
                    ? "Mengirim..."
                    : "Kirim Presensi"}
                </button>
              </form>
            ) : (
              <div
                className="success"
                style={{
                  marginTop: 16,
                }}
              >
                ✓ Presensi berhasil.
              </div>
            )}

            {message && (
              <div
                className={
                  success
                    ? "success"
                    : "error"
                }
                style={{
                  marginTop: 16,
                }}
              >
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}