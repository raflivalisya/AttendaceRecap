(function () {
  "use strict";

  var root = document.getElementById("presensi-checkin-root");
  if (!root) return;

  var TOKEN = root.getAttribute("data-token") || "";

  var button = document.getElementById("btn-kirim-presensi");
  var npmInput = document.getElementById("npm-presensi");
  var message = document.getElementById("presensi-message");
  var debug = document.getElementById("presensi-js-status");
  var resultBox = document.getElementById("presensi-result");

  if (debug) {
    debug.textContent = "JavaScript aktif · siap digunakan";
    debug.style.color = "#15803d";
  }

  if (!button) {
    console.error("BUTTON TIDAK DITEMUKAN");
    return;
  }

  if (!npmInput) {
    console.error("INPUT NPM TIDAK DITEMUKAN");
    return;
  }

  function setMessage(text, type) {
    if (!message) return;

    message.textContent = text;
    message.style.display = "block";

    if (type === "success") {
      message.style.background = "#dcfce7";
      message.style.color = "#166534";
    } else {
      message.style.background = "#fee2e2";
      message.style.color = "#991b1b";
    }
  }

  function getLocation() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error("Browser tidak mendukung GPS."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        function (position) {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        function (error) {
          if (error.code === 1) {
            reject(
              new Error(
                "Izin lokasi ditolak. Aktifkan lokasi dan izinkan browser menggunakan lokasi."
              )
            );
            return;
          }

          if (error.code === 2) {
            reject(
              new Error(
                "Lokasi tidak tersedia. Pastikan GPS aktif."
              )
            );
            return;
          }

          if (error.code === 3) {
            reject(
              new Error(
                "GPS terlalu lama merespons. Silakan coba kembali."
              )
            );
            return;
          }

          reject(new Error("Gagal membaca lokasi."));
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      );
    });
  }

  async function kirimPresensi() {
    if (button.disabled) return;

    var npm = npmInput.value.trim();

    if (!npm) {
      setMessage(
        "Masukkan NPM terlebih dahulu.",
        "error"
      );
      return;
    }

    button.disabled = true;
    button.textContent = "Memeriksa...";

    setMessage(
      "Meminta lokasi GPS...",
      "success"
    );

    try {
      var location = await getLocation();

      setMessage(
        "Lokasi ditemukan. Akurasi ±" +
          Math.round(location.accuracy) +
          " meter. Mengirim presensi...",
        "success"
      );

      var response = await fetch(
        "/api/presensi/" +
          encodeURIComponent(TOKEN),
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            npm: npm,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
          }),
        }
      );

      var raw = await response.text();
      var result = {};

      try {
        result = JSON.parse(raw);
      } catch (parseError) {
        console.error(
          "RAW SERVER RESPONSE:",
          raw
        );

        throw new Error(
          "Response server tidak valid."
        );
      }

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Presensi gagal (" +
              response.status +
              ")."
        );
      }

      setMessage(
        result.message ||
          "Presensi berhasil.",
        "success"
      );

      if (resultBox) {
        resultBox.style.display = "block";

        var studentName =
          result.student &&
          result.student.name
            ? result.student.name
            : "";

        var distance =
          typeof result.distance === "number"
            ? result.distance + " meter"
            : "-";

        var accuracy =
          typeof result.accuracy === "number"
            ? "±" +
              result.accuracy +
              " meter"
            : "-";

        resultBox.innerHTML =
          "<strong>✓ Presensi berhasil</strong>" +
          "<div style='margin-top:8px'>" +
          studentName +
          "</div>" +
          "<div>Jarak dari kampus: " +
          distance +
          "</div>" +
          "<div>Akurasi GPS: " +
          accuracy +
          "</div>";
      }

      npmInput.disabled = true;
      button.style.display = "none";
    } catch (error) {
      console.error(
        "PRESENSI ERROR:",
        error
      );

      setMessage(
        error && error.message
          ? error.message
          : "Presensi gagal.",
        "error"
      );

      button.disabled = false;
      button.textContent = "Kirim Presensi";
    }
  }

  button.addEventListener(
    "click",
    function (event) {
      event.preventDefault();
      kirimPresensi();
    }
  );
})();
