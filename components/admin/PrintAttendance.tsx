"use client";

type Course = {
  id: string;
  name: string;
  class_name: string;
  lecturer: string;
  schedule: string;
  semester?: string;
  academic_year?: string;
  min_attendance_pct: number;
};

type Student = {
  id: string;
  course_id: string;
  npm: string;
  name: string;
};

type Meeting = {
  id: string;
  course_id: string;
  meeting_no: number;
  meeting_date: string;
};

type Attendance = {
  id: string;
  meeting_id: string;
  student_id: string;
  status: "H" | "I" | "S" | "A";
};

type Props = {
  course: Course;
  students: Student[];
  meetings: Meeting[];
  attendance: Attendance[];
};

export default function PrintAttendance({
  course,
  students,
  meetings,
  attendance,
}: Props) {
  const courseStudents = students
    .filter((student) => student.course_id === course.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const courseMeetings = meetings
    .filter((meeting) => meeting.course_id === course.id)
    .sort((a, b) => a.meeting_no - b.meeting_no);

  function getStatus(
    studentId: string,
    meetingId: string
  ) {
    return (
      attendance.find(
        (item) =>
          item.student_id === studentId &&
          item.meeting_id === meetingId
      )?.status ?? ""
    );
  }

  function countStatus(
    studentId: string,
    status: "H" | "I" | "S" | "A"
  ) {
    return courseMeetings.filter(
      (meeting) =>
        getStatus(studentId, meeting.id) === status
    ).length;
  }

  // Pertemuan dianggap terlaksana jika minimal
  // sudah ada satu data absensi.
  const conductedMeetings = courseMeetings.filter(
    (meeting) =>
      attendance.some(
        (item) => item.meeting_id === meeting.id
      )
  );

  function attendancePercentage(studentId: string) {
    if (conductedMeetings.length === 0) {
      return 0;
    }

    const hadir = conductedMeetings.filter(
      (meeting) =>
        getStatus(studentId, meeting.id) === "H"
    ).length;

    return Math.round(
      (hadir / conductedMeetings.length) * 100
    );
  }

  function formatDate(date: string) {
    if (!date) return "-";

    const value = new Date(`${date}T00:00:00`);

    return value.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  }

  return (
    <>
      {/* TOMBOL CETAK */}
      <button
        type="button"
        className="print-button no-print"
        onClick={() => window.print()}
      >
        🖨 Cetak Absensi
      </button>

      {/* BAGIAN YANG AKAN DICETAK */}
      <div className="print-attendance-area">

        <div className="print-title">
          <h1>DAFTAR PRESENSI MAHASISWA</h1>

          <table className="print-info">
            <tbody>
              <tr>
                <td>Mata Kuliah</td>
                <td>:</td>
                <td>
                  <strong>{course.name}</strong>
                </td>

                <td>Dosen Pengampu</td>
                <td>:</td>
                <td>
                  <strong>{course.lecturer}</strong>
                </td>
              </tr>

              <tr>
                <td>Kelas</td>
                <td>:</td>
                <td>
                  <strong>{course.class_name}</strong>
                </td>

                <td>Semester</td>
                <td>:</td>
                <td>
                  {course.semester || "-"}
                </td>
              </tr>

              <tr>
                <td>Jadwal</td>
                <td>:</td>
                <td>{course.schedule || "-"}</td>

                <td>Tahun Akademik</td>
                <td>:</td>
                <td>
                  {course.academic_year || "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="attendance-print-table">
          <thead>
            <tr>
              <th rowSpan={3}>No</th>
              <th rowSpan={3}>NPM</th>
              <th rowSpan={3} className="student-name">
                Nama Mahasiswa
              </th>

              <th colSpan={courseMeetings.length}>
                PERTEMUAN
              </th>

              <th colSpan={6}>REKAP</th>
            </tr>

            <tr>
              {courseMeetings.map((meeting) => (
                <th key={meeting.id}>
                  {meeting.meeting_no}
                </th>
              ))}

              <th rowSpan={2}>H</th>
              <th rowSpan={2}>I</th>
              <th rowSpan={2}>S</th>
              <th rowSpan={2}>A</th>
              <th rowSpan={2}>% Hadir</th>
              <th rowSpan={2}>Status</th>
            </tr>

            <tr>
              {courseMeetings.map((meeting) => (
                <th
                  key={`date-${meeting.id}`}
                  className="meeting-date"
                >
                  {formatDate(meeting.meeting_date)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {courseStudents.map((student, index) => {
              const h = countStatus(
                student.id,
                "H"
              );

              const i = countStatus(
                student.id,
                "I"
              );

              const s = countStatus(
                student.id,
                "S"
              );

              const a = countStatus(
                student.id,
                "A"
              );

              const percentage =
                attendancePercentage(student.id);

              return (
                <tr key={student.id}>
                  <td>{index + 1}</td>

                  <td>{student.npm}</td>

                  <td className="student-name">
                    {student.name}
                  </td>

                  {courseMeetings.map((meeting) => (
                    <td
                      key={`${student.id}-${meeting.id}`}
                      className="status-cell"
                    >
                      {getStatus(
                        student.id,
                        meeting.id
                      )}
                    </td>
                  ))}

                  <td>{h}</td>
                  <td>{i}</td>
                  <td>{s}</td>
                  <td>{a}</td>

                  <td>
                    {percentage}%
                  </td>

                  <td>
                    {conductedMeetings.length === 0
                      ? "-"
                      : percentage >=
                        course.min_attendance_pct
                      ? "Memenuhi"
                      : "Belum"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="print-footer">
          <div>
            <strong>Keterangan:</strong>
            <div>H = Hadir</div>
            <div>I = Izin</div>
            <div>S = Sakit</div>
            <div>A = Alfa</div>
          </div>

          <div>
            Pertemuan terlaksana:{" "}
            <strong>
              {conductedMeetings.length}/
              {courseMeetings.length}
            </strong>
          </div>

          <div>
            Batas kehadiran:{" "}
            <strong>
              {course.min_attendance_pct}%
            </strong>
          </div>
        </div>
      </div>
    </>
  );
}