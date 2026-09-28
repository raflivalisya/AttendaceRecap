
(function () {
  if (window.__HADIR_EXTERNAL_V7_STARTED__) return;
  window.__HADIR_EXTERNAL_V7_STARTED__ = true;

  var root = document.getElementById("hadir-v7-root");
  if (!root) return;

  var token = root.getAttribute("data-token") || "";
  var qrCode = root.getAttribute("data-code") || "";

  var statusEl = document.getElementById("hadir-v7-status");
  var versionEl = document.getElementById("hadir-v7-version");
  var formEl = document.getElementById("hadir-v7-form");
  var npmEl = document.getElementById("hadir-v7-npm");
  var buttonEl = document.getElementById("hadir-v7-submit");
  var messageEl = document.getElementById("hadir-v7-message");
  var infoEl = document.getElementById("hadir-v7-info");

  var courseEl = document.getElementById("hadir-v7-course");
  var meetingEl = document.getElementById("hadir-v7-meeting");
  var classEl = document.getElementById("hadir-v7-class");
  var lecturerEl = document.getElementById("hadir-v7-lecturer");
  var scheduleEl = document.getElementById("hadir-v7-schedule");
  var campusEl = document.getElementById("hadir-v7-campus");
  var radiusEl = document.getElementById("hadir-v7-radius");

  var ticket = "";
  var dev = "";
  var ready = false;
  var sending = false;

  if (versionEl) {
    versionEl.textContent = "Engine: EXTERNAL-V7 · JavaScript aktif";
  }

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text;

    statusEl.style.background = "#eef4f8";
    statusEl.style.color = "#38566f";
    statusEl.style.borderColor = "#d8e3ec";

    if (kind === "success") {
      statusEl.style.background = "#ecfdf3";
      statusEl.style.color = "#166534";
      statusEl.style.borderColor = "#bbf7d0";
    } else if (kind === "error") {
      statusEl.style.background = "#fef2f2";
      statusEl.style.color = "#991b1b";
      statusEl.style.borderColor = "#fecaca";
    }
  }

  function setMessage(text, success) {
    if (!messageEl) return;

    if (!text) {
      messageEl.style.display = "none";
      messageEl.textContent = "";
      return;
    }

    messageEl.style.display = "block";
    messageEl.textContent = text;
    messageEl.style.padding = "12px";
    messageEl.style.borderRadius = "10px";
    messageEl.style.marginTop = "14px";
    messageEl.style.fontWeight = "700";

    if (success) {
      messageEl.style.background = "#ecfdf3";
      messageEl.style.color = "#166534";
      messageEl.style.border = "1px solid #bbf7d0";
    } else {
      messageEl.style.background = "#fef2f2";
      messageEl.style.color = "#991b1b";
      messageEl.style.border = "1px solid #fecaca";
    }
  }

  function setButton(text, disabled) {
    if (!buttonEl) return;
    buttonEl.textContent = text;
    buttonEl.disabled = !!disabled;
    buttonEl.style.opacity = disabled ? "0.72" : "1";
  }

  function newDeviceId() {
    try {
      if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
      ) {
        return crypto.randomUUID();
      }
    } catch (e) {}

    return (
      String(Date.now()) +
      "-" +
      Math.random().toString(36).slice(2) +
      "-" +
      Math.random().toString(36).slice(2)
    );
  }

  function getCookie(name) {
    var prefix = name + "=";
    var list = document.cookie ? document.cookie.split(";") : [];
    var i;

    for (i = 0; i < list.length; i += 1) {
      var item = list[i].replace(/^\s+|\s+$/g, "");
      if (item.indexOf(prefix) === 0) {
        try {
          return decodeURIComponent(item.slice(prefix.length));
        } catch (e) {
          return item.slice(prefix.length);
        }
      }
    }

    return "";
  }

  function getDeviceId() {
    var key = "attendance_device_id";
    var value = getCookie(key);

    if (value) return value;

    try {
      value = window.localStorage.getItem(key) || "";
      if (value) return value;
    } catch (e) {}

    value = newDeviceId();

    try {
      window.localStorage.setItem(key, value);
    } catch (e) {}

    try {
      document.cookie =
        key +
        "=" +
        encodeURIComponent(value) +
        "; Max-Age=31536000; Path=/; SameSite=Lax; Secure";
    } catch (e) {}

    return value;
  }

  function xhrJson(method, url, data, timeout, done) {
    var xhr = new XMLHttpRequest();
    var finished = false;

    function finish(error, json, statusCode) {
      if (finished) return;
      finished = true;
      done(error, json, statusCode);
    }

    try {
      xhr.open(method, url, true);
      xhr.timeout = timeout || 20000;
      xhr.setRequestHeader("Accept", "application/json");

      if (data !== null) {
        xhr.setRequestHeader("Content-Type", "application/json");
      }
    } catch (e) {
      finish(new Error("Browser tidak dapat membuka koneksi ke server."));
      return;
    }

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      var json = {};

      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch (e) {
        finish(
          new Error(
            "Respons server tidak valid. Tutup halaman ini lalu scan QR terbaru."
          ),
          null,
          xhr.status
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        finish(null, json, xhr.status);
      } else {
        finish(
          new Error(
            (json && json.message) ||
              "Permintaan presensi ditolak oleh server."
          ),
          json,
          xhr.status
        );
      }
    };

    xhr.onerror = function () {
      finish(
        new Error(
          "Gagal terhubung ke server. Periksa internet lalu scan QR terbaru."
        )
      );
    };

    xhr.ontimeout = function () {
      finish(
        new Error(
          "Koneksi terlalu lama. Periksa internet lalu scan QR terbaru."
        )
      );
    };

    try {
      xhr.send(data === null ? null : JSON.stringify(data));
    } catch (e) {
      finish(new Error("Browser gagal mengirim permintaan."));
    }
  }

  function getLocation(done) {
    if (!navigator.geolocation) {
      done(
        new Error(
          "Browser tidak mendukung GPS. Gunakan Chrome atau Safari terbaru."
        )
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function (position) {
        done(null, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      function (error) {
        if (error && error.code === 1) {
          done(
            new Error(
              "Izin lokasi ditolak. Izinkan Lokasi untuk website ini lalu coba lagi."
            )
          );
        } else if (error && error.code === 2) {
          done(
            new Error(
              "Lokasi tidak tersedia. Aktifkan GPS/Lokasi lalu coba lagi."
            )
          );
        } else {
          done(
            new Error(
              "GPS terlalu lama merespons. Aktifkan lokasi presisi lalu coba lagi."
            )
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      }
    );
  }

  function renderSession(info) {
    if (!info) return;

    if (courseEl) courseEl.textContent = info.courseName || "Presensi";
    if (meetingEl) {
      meetingEl.textContent = "Pertemuan " + String(info.meetingNo || "-");
    }
    if (classEl) classEl.textContent = info.className || "-";
    if (lecturerEl) lecturerEl.textContent = info.lecturer || "-";
    if (scheduleEl) scheduleEl.textContent = info.schedule || "-";
    if (campusEl) campusEl.textContent = info.campusName || "Kampus";
    if (radiusEl) radiusEl.textContent = String(info.radiusMeters || "-");

    if (infoEl) infoEl.style.display = "block";
  }

  function validateQr() {
    setStatus("JavaScript aktif. Memvalidasi QR...", "info");
    setButton("Memvalidasi QR...", true);
    setMessage("", false);

    if (!token || !qrCode) {
      setStatus("QR tidak lengkap.", "error");
      setMessage(
        "Token/kode QR tidak lengkap. Scan QR terbaru dari layar dosen.",
        false
      );
      return;
    }

    dev = getDeviceId();

    if (!dev) {
      setStatus("Perangkat tidak dapat diinisialisasi.", "error");
      setMessage(
        "Browser gagal membuat identitas perangkat. Gunakan Chrome/Safari.",
        false
      );
      return;
    }

    var url =
      "/api/presensi/" +
      encodeURIComponent(token) +
      "?code=" +
      encodeURIComponent(qrCode) +
      "&deviceId=" +
      encodeURIComponent(dev) +
      "&v=5&t=" +
      String(Date.now());

    xhrJson("GET", url, null, 20000, function (error, json) {
      if (error) {
        setStatus("QR gagal divalidasi.", "error");
        setMessage(error.message, false);
        setButton("Scan QR Terbaru", true);
        return;
      }

      if (!json || !json.ticket || !json.data) {
        setStatus("Respons QR tidak lengkap.", "error");
        setMessage(
          "Tutup halaman ini lalu scan QR terbaru dari layar dosen.",
          false
        );
        return;
      }

      ticket = json.ticket;
      ready = true;

      renderSession(json.data);

      if (npmEl) {
        npmEl.disabled = false;
        try {
          npmEl.focus();
        } catch (e) {}
      }

      setStatus("QR valid. Silakan masukkan NPM.", "success");
      setButton("Kirim Presensi", false);
    });
  }

  function submit(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (sending) return false;

    var npm = npmEl
      ? npmEl.value.replace(/^\s+|\s+$/g, "")
      : "";

    if (!npm) {
      setMessage("Masukkan NPM terlebih dahulu.", false);
      return false;
    }

    if (!ready || !ticket) {
      setMessage(
        "Sesi QR belum siap atau sudah kedaluwarsa. Scan QR terbaru.",
        false
      );
      return false;
    }

    sending = true;
    setButton("Memeriksa GPS...", true);
    setMessage("Meminta lokasi perangkat...", false);

    getLocation(function (locationError, loc) {
      if (locationError) {
        sending = false;
        setButton("Coba Kirim Lagi", false);
        setMessage(locationError.message, false);
        return;
      }

      setButton("Mengirim Presensi...", true);
      setMessage("GPS ditemukan. Mengirim presensi...", false);

      xhrJson(
        "POST",
        "/api/presensi/" + encodeURIComponent(token),
        {
          npm: npm,
          deviceId: dev,
          ticket: ticket,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy
        },
        25000,
        function (error, json) {
          sending = false;

          if (error) {
            setButton("Coba Kirim Lagi", false);
            setMessage(error.message, false);
            return;
          }

          ready = false;

          setStatus("Presensi berhasil.", "success");
          setMessage(
            (json && json.message) ||
              "Presensi berhasil. Anda tercatat Hadir.",
            true
          );
          setButton("✓ Presensi Berhasil", true);

          if (npmEl) npmEl.disabled = true;
        }
      );
    });

    return false;
  }

  if (formEl) {
    if (formEl.addEventListener) {
      formEl.addEventListener("submit", submit, false);
    } else {
      formEl.onsubmit = submit;
    }
  }

  setStatus("JavaScript aktif. Menyiapkan presensi...", "info");

  validateQr();
})();
