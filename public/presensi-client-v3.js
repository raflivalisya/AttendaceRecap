(function () {
  "use strict";

  var runtime = document.getElementById("presensi-runtime");
  if (!runtime) return;

  var token = runtime.getAttribute("data-token") || "";
  var qrCode = runtime.getAttribute("data-code") || "";

  var statusBox = document.getElementById("presensi-browser-status");
  var infoBox = document.getElementById("presensi-info");
  var form = document.getElementById("presensi-form");
  var npmInput = document.getElementById("presensi-npm");
  var submitButton = document.getElementById("presensi-submit");
  var messageBox = document.getElementById("presensi-message");

  var courseTitle = document.getElementById("presensi-course-title");
  var meetingTitle = document.getElementById("presensi-meeting-title");
  var className = document.getElementById("presensi-class-name");
  var lecturer = document.getElementById("presensi-lecturer");
  var schedule = document.getElementById("presensi-schedule");
  var campusName = document.getElementById("presensi-campus-name");
  var radius = document.getElementById("presensi-radius");

  var ticket = "";
  var dev = "";
  var ready = false;
  var sending = false;

  function setStatus(text, tone) {
    if (!statusBox) return;

    statusBox.textContent = text;

    if (tone === "success") {
      statusBox.style.background = "#dcfce7";
      statusBox.style.color = "#166534";
    } else if (tone === "error") {
      statusBox.style.background = "#fee2e2";
      statusBox.style.color = "#991b1b";
    } else {
      statusBox.style.background = "#eef4f8";
      statusBox.style.color = "#38566f";
    }
  }

  function setMessage(text, success) {
    if (!messageBox) return;

    if (!text) {
      messageBox.style.display = "none";
      messageBox.textContent = "";
      return;
    }

    messageBox.style.display = "block";
    messageBox.textContent = text;
    messageBox.className = success ? "success" : "error";
  }

  function setButton(text, disabled) {
    if (!submitButton) return;
    submitButton.textContent = text;
    submitButton.disabled = !!disabled;
  }

  function makeDeviceId() {
    return (
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2) +
      "-" +
      Math.random().toString(36).slice(2)
    );
  }

  function readCookie(name) {
    var prefix = name + "=";
    var parts = document.cookie ? document.cookie.split(";") : [];

    for (var i = 0; i < parts.length; i += 1) {
      var value = parts[i].replace(/^\s+|\s+$/g, "");

      if (value.indexOf(prefix) === 0) {
        try {
          return decodeURIComponent(value.slice(prefix.length));
        } catch (_) {
          return value.slice(prefix.length);
        }
      }
    }

    return "";
  }

  function deviceId() {
    var key = "attendance_device_id";
    var value = readCookie(key);

    if (value) return value;

    try {
      value = window.localStorage.getItem(key) || "";
      if (value) return value;
    } catch (_) {}

    value = makeDeviceId();

    try {
      window.localStorage.setItem(key, value);
    } catch (_) {}

    try {
      document.cookie =
        key +
        "=" +
        encodeURIComponent(value) +
        "; Max-Age=31536000; Path=/; SameSite=Lax; Secure";
    } catch (_) {}

    return value;
  }

  function requestJson(method, url, body, timeoutMs, callback) {
    var xhr;

    try {
      xhr = new XMLHttpRequest();
    } catch (_) {
      callback(new Error("Browser tidak mendukung koneksi HTTP modern."));
      return;
    }

    var finished = false;

    function finish(error, data, status) {
      if (finished) return;
      finished = true;
      callback(error, data, status);
    }

    xhr.open(method, url, true);
    xhr.timeout = timeoutMs || 20000;
    xhr.setRequestHeader("Accept", "application/json");

    if (body !== null) {
      xhr.setRequestHeader("Content-Type", "application/json");
    }

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      var data = {};

      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch (_) {
        finish(
          new Error(
            "Server tidak mengembalikan data JSON. Muat ulang halaman dan scan QR terbaru."
          ),
          null,
          xhr.status
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        finish(null, data, xhr.status);
      } else {
        finish(
          new Error(data.message || "Permintaan presensi gagal."),
          data,
          xhr.status
        );
      }
    };

    xhr.onerror = function () {
      finish(
        new Error(
          "Koneksi ke server gagal. Periksa internet lalu scan QR kembali."
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
      xhr.send(body === null ? null : JSON.stringify(body));
    } catch (_) {
      finish(new Error("Browser gagal mengirim data ke server."));
    }
  }

  function getLocation(callback) {
    if (!navigator.geolocation) {
      callback(
        new Error(
          "Browser ini tidak mendukung GPS. Buka QR dengan Chrome atau Safari terbaru."
        )
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function (position) {
        callback(null, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      function (error) {
        if (error && error.code === 1) {
          callback(
            new Error(
              "Izin lokasi ditolak. Buka pengaturan browser, izinkan Lokasi, lalu coba lagi."
            )
          );
        } else if (error && error.code === 2) {
          callback(
            new Error(
              "Lokasi tidak tersedia. Aktifkan GPS/Lokasi lalu coba lagi."
            )
          );
        } else {
          callback(
            new Error(
              "Pengambilan lokasi terlalu lama. Pastikan GPS aktif lalu coba lagi."
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

  function renderInfo(info) {
    if (!info) return;

    if (courseTitle) courseTitle.textContent = info.courseName || "Presensi";
    if (meetingTitle) {
      meetingTitle.textContent =
        "Pertemuan " + String(info.meetingNo || "-");
    }
    if (className) className.textContent = info.className || "-";
    if (lecturer) lecturer.textContent = info.lecturer || "-";
    if (schedule) schedule.textContent = info.schedule || "-";
    if (campusName) campusName.textContent = info.campusName || "Kampus";
    if (radius) radius.textContent = String(info.radiusMeters || "-");

    if (infoBox) infoBox.style.display = "block";
  }

  function validateQr() {
    setStatus("JavaScript aktif. Memvalidasi QR...", "info");
    setButton("Memvalidasi QR...", true);
    setMessage("", false);

    if (!token || !qrCode) {
      setStatus("QR tidak valid.", "error");
      setMessage(
        "QR tidak memiliki token/kode yang lengkap. Scan QR terbaru dari layar dosen.",
        false
      );
      return;
    }

    dev = deviceId();

    if (!dev) {
      setStatus("Perangkat gagal diinisialisasi.", "error");
      setMessage(
        "Browser gagal membuat identitas perangkat. Buka QR dengan Chrome/Safari.",
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
      "&_ts=" +
      String(Date.now());

    requestJson("GET", url, null, 20000, function (error, json) {
      if (error) {
        setStatus("QR tidak dapat divalidasi.", "error");
        setMessage(error.message, false);
        setButton("Scan QR Terbaru", true);
        return;
      }

      if (!json || !json.data || !json.ticket) {
        setStatus("Respons QR tidak lengkap.", "error");
        setMessage(
          "Sesi QR tidak lengkap. Tutup halaman ini lalu scan QR terbaru.",
          false
        );
        return;
      }

      ticket = json.ticket;
      ready = true;

      renderInfo(json.data);

      if (npmInput) {
        npmInput.disabled = false;
        npmInput.focus();
      }

      setStatus(
        "Browser siap. Masukkan NPM lalu kirim presensi.",
        "success"
      );
      setButton("Kirim Presensi", false);
    });
  }

  function submitPresence(event) {
    if (event && event.preventDefault) event.preventDefault();

    if (sending) return false;

    var npm = npmInput ? npmInput.value.replace(/^\s+|\s+$/g, "") : "";

    if (!ready || !ticket) {
      setMessage(
        "Sesi QR belum siap atau sudah tidak valid. Scan QR terbaru.",
        false
      );
      return false;
    }

    if (!npm) {
      setMessage("Masukkan NPM terlebih dahulu.", false);
      if (npmInput) npmInput.focus();
      return false;
    }

    sending = true;
    setButton("Memeriksa lokasi...", true);
    setMessage("Memeriksa lokasi perangkat...", false);

    getLocation(function (locationError, loc) {
      if (locationError) {
        sending = false;
        setButton("Coba Kirim Lagi", false);
        setMessage(locationError.message, false);
        return;
      }

      setButton("Mengirim Presensi...", true);
      setMessage("Lokasi ditemukan. Mengirim presensi...", false);

      requestJson(
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
          setStatus("Presensi berhasil dikirim.", "success");
          setMessage(
            (json && json.message) || "Presensi berhasil.",
            true
          );
          setButton("✓ Presensi Berhasil", true);

          if (npmInput) npmInput.disabled = true;
        }
      );
    });

    return false;
  }

  if (form) {
    if (form.addEventListener) {
      form.addEventListener("submit", submitPresence, false);
    } else {
      form.onsubmit = submitPresence;
    }
  }

  // Tandai secepat mungkin bahwa JS memang hidup.
  setStatus("JavaScript aktif. Menyiapkan presensi...", "info");

  // Hindari halaman lama dari bfcache setelah mahasiswa scan ulang QR.
  window.addEventListener &&
    window.addEventListener("pageshow", function (event) {
      if (event.persisted) {
        window.location.reload();
      }
    });

  validateQr();
})();
