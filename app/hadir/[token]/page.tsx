export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ code?: string | string[] }>;
};

const CLIENT_SCRIPT = '\n(function () {\n  if (window.__HADIR_HARD_BYPASS_V6_STARTED__) return;\n  window.__HADIR_HARD_BYPASS_V6_STARTED__ = true;\n\n  var root = document.getElementById("hadir-v6-root");\n  if (!root) return;\n\n  var token = root.getAttribute("data-token") || "";\n  var qrCode = root.getAttribute("data-code") || "";\n\n  var statusEl = document.getElementById("hadir-v6-status");\n  var versionEl = document.getElementById("hadir-v6-version");\n  var formEl = document.getElementById("hadir-v6-form");\n  var npmEl = document.getElementById("hadir-v6-npm");\n  var buttonEl = document.getElementById("hadir-v6-submit");\n  var messageEl = document.getElementById("hadir-v6-message");\n  var infoEl = document.getElementById("hadir-v6-info");\n\n  var courseEl = document.getElementById("hadir-v6-course");\n  var meetingEl = document.getElementById("hadir-v6-meeting");\n  var classEl = document.getElementById("hadir-v6-class");\n  var lecturerEl = document.getElementById("hadir-v6-lecturer");\n  var scheduleEl = document.getElementById("hadir-v6-schedule");\n  var campusEl = document.getElementById("hadir-v6-campus");\n  var radiusEl = document.getElementById("hadir-v6-radius");\n\n  var ticket = "";\n  var dev = "";\n  var ready = false;\n  var sending = false;\n\n  if (versionEl) {\n    versionEl.textContent = "Engine: HARD-BYPASS-V6 · JavaScript aktif";\n  }\n\n  function setStatus(text, kind) {\n    if (!statusEl) return;\n    statusEl.textContent = text;\n\n    statusEl.style.background = "#eef4f8";\n    statusEl.style.color = "#38566f";\n    statusEl.style.borderColor = "#d8e3ec";\n\n    if (kind === "success") {\n      statusEl.style.background = "#ecfdf3";\n      statusEl.style.color = "#166534";\n      statusEl.style.borderColor = "#bbf7d0";\n    } else if (kind === "error") {\n      statusEl.style.background = "#fef2f2";\n      statusEl.style.color = "#991b1b";\n      statusEl.style.borderColor = "#fecaca";\n    }\n  }\n\n  function setMessage(text, success) {\n    if (!messageEl) return;\n\n    if (!text) {\n      messageEl.style.display = "none";\n      messageEl.textContent = "";\n      return;\n    }\n\n    messageEl.style.display = "block";\n    messageEl.textContent = text;\n    messageEl.style.padding = "12px";\n    messageEl.style.borderRadius = "10px";\n    messageEl.style.marginTop = "14px";\n    messageEl.style.fontWeight = "700";\n\n    if (success) {\n      messageEl.style.background = "#ecfdf3";\n      messageEl.style.color = "#166534";\n      messageEl.style.border = "1px solid #bbf7d0";\n    } else {\n      messageEl.style.background = "#fef2f2";\n      messageEl.style.color = "#991b1b";\n      messageEl.style.border = "1px solid #fecaca";\n    }\n  }\n\n  function setButton(text, disabled) {\n    if (!buttonEl) return;\n    buttonEl.textContent = text;\n    buttonEl.disabled = !!disabled;\n    buttonEl.style.opacity = disabled ? "0.72" : "1";\n  }\n\n  function newDeviceId() {\n    try {\n      if (\n        typeof crypto !== "undefined" &&\n        typeof crypto.randomUUID === "function"\n      ) {\n        return crypto.randomUUID();\n      }\n    } catch (e) {}\n\n    return (\n      String(Date.now()) +\n      "-" +\n      Math.random().toString(36).slice(2) +\n      "-" +\n      Math.random().toString(36).slice(2)\n    );\n  }\n\n  function getCookie(name) {\n    var prefix = name + "=";\n    var list = document.cookie ? document.cookie.split(";") : [];\n    var i;\n\n    for (i = 0; i < list.length; i += 1) {\n      var item = list[i].replace(/^\\s+|\\s+$/g, "");\n      if (item.indexOf(prefix) === 0) {\n        try {\n          return decodeURIComponent(item.slice(prefix.length));\n        } catch (e) {\n          return item.slice(prefix.length);\n        }\n      }\n    }\n\n    return "";\n  }\n\n  function getDeviceId() {\n    var key = "attendance_device_id";\n    var value = getCookie(key);\n\n    if (value) return value;\n\n    try {\n      value = window.localStorage.getItem(key) || "";\n      if (value) return value;\n    } catch (e) {}\n\n    value = newDeviceId();\n\n    try {\n      window.localStorage.setItem(key, value);\n    } catch (e) {}\n\n    try {\n      document.cookie =\n        key +\n        "=" +\n        encodeURIComponent(value) +\n        "; Max-Age=31536000; Path=/; SameSite=Lax; Secure";\n    } catch (e) {}\n\n    return value;\n  }\n\n  function xhrJson(method, url, data, timeout, done) {\n    var xhr = new XMLHttpRequest();\n    var finished = false;\n\n    function finish(error, json, statusCode) {\n      if (finished) return;\n      finished = true;\n      done(error, json, statusCode);\n    }\n\n    try {\n      xhr.open(method, url, true);\n      xhr.timeout = timeout || 20000;\n      xhr.setRequestHeader("Accept", "application/json");\n\n      if (data !== null) {\n        xhr.setRequestHeader("Content-Type", "application/json");\n      }\n    } catch (e) {\n      finish(new Error("Browser tidak dapat membuka koneksi ke server."));\n      return;\n    }\n\n    xhr.onreadystatechange = function () {\n      if (xhr.readyState !== 4) return;\n\n      var json = {};\n\n      try {\n        json = xhr.responseText ? JSON.parse(xhr.responseText) : {};\n      } catch (e) {\n        finish(\n          new Error(\n            "Respons server tidak valid. Tutup halaman ini lalu scan QR terbaru."\n          ),\n          null,\n          xhr.status\n        );\n        return;\n      }\n\n      if (xhr.status >= 200 && xhr.status < 300) {\n        finish(null, json, xhr.status);\n      } else {\n        finish(\n          new Error(\n            (json && json.message) ||\n              "Permintaan presensi ditolak oleh server."\n          ),\n          json,\n          xhr.status\n        );\n      }\n    };\n\n    xhr.onerror = function () {\n      finish(\n        new Error(\n          "Gagal terhubung ke server. Periksa internet lalu scan QR terbaru."\n        )\n      );\n    };\n\n    xhr.ontimeout = function () {\n      finish(\n        new Error(\n          "Koneksi terlalu lama. Periksa internet lalu scan QR terbaru."\n        )\n      );\n    };\n\n    try {\n      xhr.send(data === null ? null : JSON.stringify(data));\n    } catch (e) {\n      finish(new Error("Browser gagal mengirim permintaan."));\n    }\n  }\n\n  function getLocation(done) {\n    if (!navigator.geolocation) {\n      done(\n        new Error(\n          "Browser tidak mendukung GPS. Gunakan Chrome atau Safari terbaru."\n        )\n      );\n      return;\n    }\n\n    navigator.geolocation.getCurrentPosition(\n      function (position) {\n        done(null, {\n          latitude: position.coords.latitude,\n          longitude: position.coords.longitude,\n          accuracy: position.coords.accuracy\n        });\n      },\n      function (error) {\n        if (error && error.code === 1) {\n          done(\n            new Error(\n              "Izin lokasi ditolak. Izinkan Lokasi untuk website ini lalu coba lagi."\n            )\n          );\n        } else if (error && error.code === 2) {\n          done(\n            new Error(\n              "Lokasi tidak tersedia. Aktifkan GPS/Lokasi lalu coba lagi."\n            )\n          );\n        } else {\n          done(\n            new Error(\n              "GPS terlalu lama merespons. Aktifkan lokasi presisi lalu coba lagi."\n            )\n          );\n        }\n      },\n      {\n        enableHighAccuracy: true,\n        timeout: 20000,\n        maximumAge: 0\n      }\n    );\n  }\n\n  function renderSession(info) {\n    if (!info) return;\n\n    if (courseEl) courseEl.textContent = info.courseName || "Presensi";\n    if (meetingEl) {\n      meetingEl.textContent = "Pertemuan " + String(info.meetingNo || "-");\n    }\n    if (classEl) classEl.textContent = info.className || "-";\n    if (lecturerEl) lecturerEl.textContent = info.lecturer || "-";\n    if (scheduleEl) scheduleEl.textContent = info.schedule || "-";\n    if (campusEl) campusEl.textContent = info.campusName || "Kampus";\n    if (radiusEl) radiusEl.textContent = String(info.radiusMeters || "-");\n\n    if (infoEl) infoEl.style.display = "block";\n  }\n\n  function validateQr() {\n    setStatus("JavaScript aktif. Memvalidasi QR...", "info");\n    setButton("Memvalidasi QR...", true);\n    setMessage("", false);\n\n    if (!token || !qrCode) {\n      setStatus("QR tidak lengkap.", "error");\n      setMessage(\n        "Token/kode QR tidak lengkap. Scan QR terbaru dari layar dosen.",\n        false\n      );\n      return;\n    }\n\n    dev = getDeviceId();\n\n    if (!dev) {\n      setStatus("Perangkat tidak dapat diinisialisasi.", "error");\n      setMessage(\n        "Browser gagal membuat identitas perangkat. Gunakan Chrome/Safari.",\n        false\n      );\n      return;\n    }\n\n    var url =\n      "/api/presensi/" +\n      encodeURIComponent(token) +\n      "?code=" +\n      encodeURIComponent(qrCode) +\n      "&deviceId=" +\n      encodeURIComponent(dev) +\n      "&v=5&t=" +\n      String(Date.now());\n\n    xhrJson("GET", url, null, 20000, function (error, json) {\n      if (error) {\n        setStatus("QR gagal divalidasi.", "error");\n        setMessage(error.message, false);\n        setButton("Scan QR Terbaru", true);\n        return;\n      }\n\n      if (!json || !json.ticket || !json.data) {\n        setStatus("Respons QR tidak lengkap.", "error");\n        setMessage(\n          "Tutup halaman ini lalu scan QR terbaru dari layar dosen.",\n          false\n        );\n        return;\n      }\n\n      ticket = json.ticket;\n      ready = true;\n\n      renderSession(json.data);\n\n      if (npmEl) {\n        npmEl.disabled = false;\n        try {\n          npmEl.focus();\n        } catch (e) {}\n      }\n\n      setStatus("QR valid. Silakan masukkan NPM.", "success");\n      setButton("Kirim Presensi", false);\n    });\n  }\n\n  function submit(event) {\n    if (event && event.preventDefault) event.preventDefault();\n    if (sending) return false;\n\n    var npm = npmEl\n      ? npmEl.value.replace(/^\\s+|\\s+$/g, "")\n      : "";\n\n    if (!npm) {\n      setMessage("Masukkan NPM terlebih dahulu.", false);\n      return false;\n    }\n\n    if (!ready || !ticket) {\n      setMessage(\n        "Sesi QR belum siap atau sudah kedaluwarsa. Scan QR terbaru.",\n        false\n      );\n      return false;\n    }\n\n    sending = true;\n    setButton("Memeriksa GPS...", true);\n    setMessage("Meminta lokasi perangkat...", false);\n\n    getLocation(function (locationError, loc) {\n      if (locationError) {\n        sending = false;\n        setButton("Coba Kirim Lagi", false);\n        setMessage(locationError.message, false);\n        return;\n      }\n\n      setButton("Mengirim Presensi...", true);\n      setMessage("GPS ditemukan. Mengirim presensi...", false);\n\n      xhrJson(\n        "POST",\n        "/api/presensi/" + encodeURIComponent(token),\n        {\n          npm: npm,\n          deviceId: dev,\n          ticket: ticket,\n          latitude: loc.latitude,\n          longitude: loc.longitude,\n          accuracy: loc.accuracy\n        },\n        25000,\n        function (error, json) {\n          sending = false;\n\n          if (error) {\n            setButton("Coba Kirim Lagi", false);\n            setMessage(error.message, false);\n            return;\n          }\n\n          ready = false;\n\n          setStatus("Presensi berhasil.", "success");\n          setMessage(\n            (json && json.message) ||\n              "Presensi berhasil. Anda tercatat Hadir.",\n            true\n          );\n          setButton("✓ Presensi Berhasil", true);\n\n          if (npmEl) npmEl.disabled = true;\n        }\n      );\n    });\n\n    return false;\n  }\n\n  if (formEl) {\n    if (formEl.addEventListener) {\n      formEl.addEventListener("submit", submit, false);\n    } else {\n      formEl.onsubmit = submit;\n    }\n  }\n\n  setStatus("JavaScript aktif. Menyiapkan presensi...", "info");\n\n  validateQr();\n})();\n';

export default async function PresensiPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const code = Array.isArray(query.code) ? query.code[0] : query.code ?? "";

  return (
    <section
      className="page"
      style={{
        minHeight: "100dvh",
        padding: "18px 12px 40px",
        background: "#f4f7fa",
      }}
    >
      <div
        className="shell"
        style={{ width: "100%", maxWidth: 600, margin: "0 auto" }}
      >
        <div className="hero" style={{ marginBottom: 14 }}>
          <div>
            <div className="eyebrow">Presensi Mahasiswa</div>
            <h1 id="hadir-v6-course">Presensi Mahasiswa</h1>
            <p id="hadir-v6-meeting">Menyiapkan sesi...</p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body">
            <div
              id="hadir-v6-root"
              data-token={token}
              data-code={code}
            >
              <div
                id="hadir-v6-version"
                style={{
                  display: "inline-flex",
                  marginBottom: 10,
                  padding: "5px 9px",
                  borderRadius: 999,
                  background: "#e8eef4",
                  color: "#52687b",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                Engine: HARD-BYPASS-V6 · menunggu JavaScript
              </div>

              <div
                id="hadir-v6-status"
                style={{
                  marginBottom: 14,
                  padding: 12,
                  border: "1px solid #d8e3ec",
                  borderRadius: 10,
                  background: "#eef4f8",
                  color: "#38566f",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Menyiapkan halaman presensi...
              </div>

              <div id="hadir-v6-info" style={{ display: "none" }}>
                <p>
                  <strong>Kelas:</strong>{" "}
                  <span id="hadir-v6-class">-</span>
                </p>

                <p>
                  <strong>Dosen:</strong>{" "}
                  <span id="hadir-v6-lecturer">-</span>
                </p>

                <p>
                  <strong>Jadwal:</strong>{" "}
                  <span id="hadir-v6-schedule">-</span>
                </p>

                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 10,
                    background: "#f1f5f9",
                    lineHeight: 1.55,
                  }}
                >
                  📍 <strong id="hadir-v6-campus">Lokasi kampus</strong>
                  <br />
                  GPS wajib • radius maksimal{" "}
                  <strong>
                    <span id="hadir-v6-radius">-</span> meter
                  </strong>
                </div>
              </div>

              <form id="hadir-v6-form" style={{ marginTop: 18 }}>
                <div className="field">
                  <label htmlFor="hadir-v6-npm">NPM</label>
                  <input
                    id="hadir-v6-npm"
                    className="input"
                    placeholder="Masukkan NPM"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled
                  />
                </div>

                <button
                  id="hadir-v6-submit"
                  className="btn btn-primary"
                  type="submit"
                  disabled
                  style={{
                    width: "100%",
                    marginTop: 16,
                    minHeight: 48,
                  }}
                >
                  Menyiapkan...
                </button>
              </form>

              <div
                id="hadir-v6-message"
                role="status"
                aria-live="polite"
                style={{ display: "none" }}
              />

              <div
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: "1px solid #e5e7eb",
                  color: "#64748b",
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                Jika tetap berhenti di “Menyiapkan halaman presensi...”, buka
                QR menggunakan <strong>Chrome/Safari</strong> dan pastikan
                JavaScript situs tidak diblokir.
              </div>

              <noscript>
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 10,
                    background: "#fee2e2",
                    color: "#991b1b",
                    fontWeight: 700,
                  }}
                >
                  JavaScript memang dinonaktifkan pada browser ini.
                </div>
              </noscript>
            </div>
          </div>
        </div>
      </div>

      <script
        id="hadir-hard-bypass-v6-script"
        dangerouslySetInnerHTML={{ __html: CLIENT_SCRIPT }}
      />
    </section>
  );
}
