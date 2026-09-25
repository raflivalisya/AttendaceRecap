import {
  cookies,
} from "next/headers";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  verifyCheckinTicket,
} from "@/lib/presensi-ticket";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const runtime =
  "nodejs";

function getSupabase() {
  const url =
    process.env.SUPABASE_URL ||
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "SUPABASE URL belum tersedia."
    );
  }

  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum tersedia."
    );
  }

  return createClient(
    url,
    serviceKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    }
  );
}

/* =====================================================
   ERROR PAGE
===================================================== */

function ErrorPage({
  message,
}: {
  message: string;
}) {
  return (
    <section className="page">
      <div
        className="shell"
        style={{
          width:
            "100%",

          maxWidth:
            600,

          margin:
            "0 auto",
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

            <p className="muted">
              Silakan scan QR terbaru
              dari layar dosen.
            </p>

          </div>
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   PAGE
===================================================== */

export default async function CheckinPage({
  params,
}: {
  params: Promise<{
    token: string;
  }>;
}) {
  const {
    token,
  } =
    await params;

  try {
    /* =================================================
       COOKIE
    ================================================= */

    const cookieStore =
      await cookies();

    const ticket =
      cookieStore
        .get(
          "presensi_checkin_ticket"
        )
        ?.value ??
      "";

    const deviceId =
      cookieStore
        .get(
          "presensi_device_id"
        )
        ?.value ??
      "";

    if (!ticket) {
      return (
        <ErrorPage
          message="Ticket presensi tidak ditemukan. Scan QR terbaru."
        />
      );
    }

    if (!deviceId) {
      return (
        <ErrorPage
          message="Identitas perangkat tidak ditemukan. Scan QR terbaru."
        />
      );
    }

    /* =================================================
       DATABASE
    ================================================= */

    const supabase =
      getSupabase();

    const {
      data,
      error,
    } = await supabase
      .from(
        "attendance_sessions"
      )
      .select(`
        id,
        token,
        starts_at,
        ends_at,
        is_active,
        radius_meters,

        meetings!inner (
          id,
          meeting_no,
          meeting_date,
          course_id,

          courses!inner (
            id,
            name,
            class_name,
            lecturer,
            schedule
          )
        )
      `)
      .eq(
        "token",
        token
      )
      .maybeSingle();

    if (
      error ||
      !data
    ) {
      console.error(
        "CHECKIN SESSION:",
        error
      );

      return (
        <ErrorPage
          message="Sesi presensi tidak ditemukan."
        />
      );
    }

    /* =================================================
       SESSION
    ================================================= */

    if (
      !data.is_active
    ) {
      return (
        <ErrorPage
          message="Presensi sudah ditutup."
        />
      );
    }

    const sessionEnd =
      new Date(
        data.ends_at
      ).getTime();

    if (
      Date.now() >=
      sessionEnd
    ) {
      return (
        <ErrorPage
          message="Waktu presensi sudah berakhir."
        />
      );
    }

    /* =================================================
       TICKET
    ================================================= */

    const validTicket =
      verifyCheckinTicket(
        data.id,
        data.token,
        ticket
      );

    if (
      !validTicket
    ) {
      return (
        <ErrorPage
          message="Sesi check-in sudah berakhir. Scan QR terbaru."
        />
      );
    }

    /* =================================================
       MEETING
    ================================================= */

    const rawMeeting =
      data.meetings as any;

    const meeting =
      Array.isArray(
        rawMeeting
      )
        ? rawMeeting[0]
        : rawMeeting;

    if (!meeting) {
      return (
        <ErrorPage
          message="Data pertemuan tidak ditemukan."
        />
      );
    }

    /* =================================================
       COURSE
    ================================================= */

    const rawCourse =
      meeting.courses;

    const course =
      Array.isArray(
        rawCourse
      )
        ? rawCourse[0]
        : rawCourse;

    if (!course) {
      return (
        <ErrorPage
          message="Data kelas tidak ditemukan."
        />
      );
    }

    /* =================================================
       TOKEN UNTUK JAVASCRIPT
    ================================================= */

    const safeToken =
      JSON.stringify(
        token
      ).replace(
        /</g,
        "\\u003c"
      );

    /* =================================================
       JAVASCRIPT BROWSER BIASA

       TIDAK MENGGUNAKAN REACT HYDRATION.
    ================================================= */

    const browserScript =
      `
(function () {

  var TOKEN = ${safeToken};

  var button =
    document.getElementById(
      "btn-kirim-presensi"
    );

  var npmInput =
    document.getElementById(
      "npm-presensi"
    );

  var message =
    document.getElementById(
      "presensi-message"
    );

  var debug =
    document.getElementById(
      "presensi-js-status"
    );

  var resultBox =
    document.getElementById(
      "presensi-result"
    );

  if (debug) {
    debug.textContent =
      "Siap digunakan";

    debug.style.color =
      "#15803d";
  }

  if (!button) {
    console.error(
      "BUTTON TIDAK DITEMUKAN"
    );

    return;
  }

  if (!npmInput) {
    console.error(
      "INPUT NPM TIDAK DITEMUKAN"
    );

    return;
  }

  function setMessage(
    text,
    type
  ) {
    if (!message) {
      return;
    }

    message.textContent =
      text;

    message.style.display =
      "block";

    if (
      type === "success"
    ) {
      message.style.background =
        "#dcfce7";

      message.style.color =
        "#166534";
    } else {
      message.style.background =
        "#fee2e2";

      message.style.color =
        "#991b1b";
    }
  }

  function getLocation() {
    return new Promise(
      function (
        resolve,
        reject
      ) {
        if (
          !navigator.geolocation
        ) {
          reject(
            new Error(
              "Browser tidak mendukung GPS."
            )
          );

          return;
        }

        navigator.geolocation
          .getCurrentPosition(
            function (
              position
            ) {
              resolve({
                latitude:
                  position.coords
                    .latitude,

                longitude:
                  position.coords
                    .longitude,

                accuracy:
                  position.coords
                    .accuracy
              });
            },

            function (
              error
            ) {
              if (
                error.code === 1
              ) {
                reject(
                  new Error(
                    "Izin lokasi ditolak. Aktifkan Location Services dan izinkan Safari menggunakan lokasi."
                  )
                );

                return;
              }

              if (
                error.code === 2
              ) {
                reject(
                  new Error(
                    "Lokasi tidak tersedia. Pastikan GPS aktif."
                  )
                );

                return;
              }

              if (
                error.code === 3
              ) {
                reject(
                  new Error(
                    "GPS terlalu lama merespons. Silakan coba kembali."
                  )
                );

                return;
              }

              reject(
                new Error(
                  "Gagal membaca lokasi."
                )
              );
            },

            {
              enableHighAccuracy:
                true,

              timeout:
                20000,

              maximumAge:
                0
            }
          );
      }
    );
  }

  async function kirimPresensi() {

    if (
      button.disabled
    ) {
      return;
    }

    var npm =
      npmInput.value.trim();

    if (!npm) {
      setMessage(
        "Masukkan NPM terlebih dahulu.",
        "error"
      );

      return;
    }

    button.disabled =
      true;

    button.textContent =
      "Memeriksa...";

    setMessage(
      "Tombol berhasil ditekan. Meminta lokasi GPS...",
      "success"
    );

    try {

      /* ============================
         GPS
      ============================ */

      var location =
        await getLocation();

      setMessage(
        "Lokasi ditemukan. Akurasi ±" +
        Math.round(
          location.accuracy
        ) +
        " meter. Mengirim presensi...",
        "success"
      );

      /* ============================
         FETCH
      ============================ */

      var response =
        await fetch(
          "/api/presensi/" +
          encodeURIComponent(
            TOKEN
          ),
          {
            method:
              "POST",

            credentials:
              "include",

            cache:
              "no-store",

            headers: {
              "Content-Type":
                "application/json",

              "Accept":
                "application/json"
            },

            body:
              JSON.stringify({
                npm:
                  npm,

                latitude:
                  location.latitude,

                longitude:
                  location.longitude,

                accuracy:
                  location.accuracy
              })
          }
        );

      var raw =
        await response.text();

      var result =
        {};

      try {
        result =
          JSON.parse(
            raw
          );
      } catch (
        parseError
      ) {
        console.error(
          "RAW SERVER RESPONSE:",
          raw
        );

        throw new Error(
          "Response server tidak valid."
        );
      }

      if (
        !response.ok
      ) {
        throw new Error(
          result.message ||
          "Presensi gagal (" +
          response.status +
          ")."
        );
      }

      /* ============================
         SUCCESS
      ============================ */

      setMessage(
        result.message ||
        "Presensi berhasil.",
        "success"
      );

      if (
        resultBox
      ) {
        resultBox.style.display =
          "block";

        var studentName =
          result.student &&
          result.student.name
            ? result.student.name
            : "";

        var distance =
          typeof result.distance ===
          "number"
            ? result.distance +
              " meter"
            : "-";

        var accuracy =
          typeof result.accuracy ===
          "number"
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

      npmInput.disabled =
        true;

      button.style.display =
        "none";

    } catch (
      error
    ) {

      console.error(
        "PRESENSI ERROR:",
        error
      );

      setMessage(
        error &&
        error.message
          ? error.message
          : "Presensi gagal.",
        "error"
      );

      button.disabled =
        false;

      button.textContent =
        "Kirim Presensi";
    }
  }

  /*
   * CLICK EVENT
   */
  button.addEventListener(
    "click",
    function (
      event
    ) {
      event.preventDefault();

      kirimPresensi();
    }
  );

})();
`;

    /* =================================================
       UI
    ================================================= */

    return (
      <section className="page">
        <div
          className="shell"
          style={{
            width:
              "100%",

            maxWidth:
              600,

            margin:
              "0 auto",
          }}
        >
          <div className="hero">
            <div>
              <div className="eyebrow">
                Presensi Mahasiswa
              </div>

              <h1>
                {String(
                  course.name
                )}
              </h1>

              <p>
                Pertemuan{" "}
                {String(
                  meeting.meeting_no
                )}
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-body">

              <p>
                <strong>
                  Kelas:
                </strong>{" "}

                {String(
                  course.class_name
                )}
              </p>

              <p>
                <strong>
                  Dosen:
                </strong>{" "}

                {String(
                  course.lecturer
                )}
              </p>

              <p>
                <strong>
                  Jadwal:
                </strong>{" "}

                {String(
                  course.schedule ||
                  "-"
                )}
              </p>

              {/* ============================
                  LOKASI
              ============================ */}

              <div
                style={{
                  marginTop:
                    15,

                  marginBottom:
                    20,

                  padding:
                    14,

                  background:
                    "#f1f5f9",

                  borderRadius:
                    10,
                }}
              >
                📍{" "}

                <strong>
                  Universitas Teknokrat Indonesia
                </strong>

                <br />

                GPS wajib

                <br />

                Radius maksimal{" "}

                <strong>
                  {Number(
                    data.radius_meters ||
                    250
                  )}{" "}
                  meter
                </strong>
              </div>

              {/* ============================
                  STATUS JAVASCRIPT

                  INI PENTING UNTUK DEBUG
                  IPHONE
              ============================ */}

              <div
                style={{
                  fontSize:
                    13,

                  marginBottom:
                    15,

                  padding:
                    10,

                  borderRadius:
                    8,

                  background:
                    "#f8fafc",
                }}
              >
                Status tombol:{" "}

                <strong
                  id="presensi-js-status"

                  style={{
                    color:
                      "#dc2626",
                  }}
                >
                  JavaScript belum aktif
                </strong>
              </div>

              {/* ============================
                  INPUT
              ============================ */}

              <div className="field">
                <label
                  htmlFor="npm-presensi"
                >
                  NPM
                </label>

                <input
                  id="npm-presensi"

                  type="text"

                  className="input"

                  placeholder="Masukkan NPM"

                  inputMode="numeric"

                  autoComplete="off"

                  style={{
                    fontSize:
                      16,

                    width:
                      "100%",
                  }}
                />
              </div>

              {/* ============================
                  BUTTON

                  BUKAN REACT ONCLICK.
              ============================ */}

              <button
                id="btn-kirim-presensi"

                type="button"

                className="btn btn-primary"

                style={{
                  width:
                    "100%",

                  minHeight:
                    54,

                  marginTop:
                    16,

                  fontSize:
                    16,

                  cursor:
                    "pointer",

                  touchAction:
                    "manipulation",

                  WebkitAppearance:
                    "none",
                }}
              >
                Kirim Presensi
              </button>

              {/* ============================
                  MESSAGE
              ============================ */}

              <div
                id="presensi-message"

                style={{
                  display:
                    "none",

                  marginTop:
                    16,

                  padding:
                    12,

                  borderRadius:
                    8,
                }}
              />

              {/* ============================
                  SUCCESS RESULT
              ============================ */}

              <div
                id="presensi-result"

                style={{
                  display:
                    "none",

                  marginTop:
                    16,

                  padding:
                    16,

                  borderRadius:
                    10,

                  background:
                    "#dcfce7",

                  color:
                    "#166534",
                }}
              />

              <noscript>
                <div
                  style={{
                    marginTop:
                      16,

                    padding:
                      12,

                    background:
                      "#fee2e2",

                    color:
                      "#991b1b",

                    borderRadius:
                      8,
                  }}
                >
                  JavaScript dinonaktifkan.
                  Aktifkan JavaScript pada
                  Safari untuk menggunakan
                  presensi.
                </div>
              </noscript>

              {/* ============================
                  PLAIN BROWSER SCRIPT
              ============================ */}

              <script
                dangerouslySetInnerHTML={{
                  __html:
                    browserScript,
                }}
              />

            </div>
          </div>
        </div>
      </section>
    );
  } catch (error) {
    console.error(
      "CHECKIN PAGE ERROR:",
      error
    );

    return (
      <ErrorPage
        message="Terjadi kesalahan saat membuka halaman presensi."
      />
    );
  }
}