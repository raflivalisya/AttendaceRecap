"use client";

import { useMemo, useState, type ReactNode } from "react";
import { buildGradeMap, calculateFinalScore } from "@/lib/grades";
import type { Assessment, Attendance, Course, Grade, Meeting, Student } from "@/lib/types";

type Props = {
  courses: Course[];
  students: Student[];
  meetings: Meeting[];
  attendance: Attendance[];
  assessments: Assessment[];
  grades: Grade[];
  defaultCourseId?: string;
};

type RiskRow = {
  key: string;
  npm: string;
  name: string;
  course: string;
  attendancePct: number | null;
  finalScore: number | null;
  reasons: string[];
};

function pct(value: number) {
  return `${Math.round(value)}%`;
}

export default function AdminAnalyticsDashboard({
  courses,
  students,
  meetings,
  attendance,
  assessments,
  grades,
  defaultCourseId = "",
}: Props) {
  const [courseFilter, setCourseFilter] = useState(defaultCourseId);

  const data = useMemo(() => {
    const scopeCourses = courseFilter
      ? courses.filter((course) => course.id === courseFilter)
      : courses;

    const courseIds = new Set(scopeCourses.map((course) => course.id));
    const scopeStudents = students.filter((student) => courseIds.has(student.course_id));
    const scopeMeetings = meetings.filter((meeting) => courseIds.has(meeting.course_id));
    const meetingIds = new Set(scopeMeetings.map((meeting) => meeting.id));
    const scopeAttendance = attendance.filter((row) => meetingIds.has(row.meeting_id));
    const scopeAssessments = assessments.filter((assessment) => courseIds.has(assessment.course_id));
    const assessmentIds = new Set(scopeAssessments.map((assessment) => assessment.id));
    const scopeGrades = grades.filter((grade) => assessmentIds.has(grade.assessment_id));

    const uniqueStudents = new Set(scopeStudents.map((student) => student.npm)).size;

    const attendanceByMeeting = new Map<string, Attendance[]>();
    for (const row of scopeAttendance) {
      const current = attendanceByMeeting.get(row.meeting_id) ?? [];
      current.push(row);
      attendanceByMeeting.set(row.meeting_id, current);
    }

    const studentsByCourse = new Map<string, Student[]>();
    for (const course of scopeCourses) {
      studentsByCourse.set(
        course.id,
        scopeStudents.filter((student) => student.course_id === course.id),
      );
    }

    const recordedMeetings = scopeMeetings.filter(
      (meeting) => (attendanceByMeeting.get(meeting.id)?.length ?? 0) > 0,
    );

    let expectedAttendance = 0;
    let presentAttendance = 0;

    for (const meeting of recordedMeetings) {
      expectedAttendance += studentsByCourse.get(meeting.course_id)?.length ?? 0;
      presentAttendance += (attendanceByMeeting.get(meeting.id) ?? []).filter(
        (row) => row.status === "H",
      ).length;
    }

    const attendanceRate = expectedAttendance
      ? (presentAttendance / expectedAttendance) * 100
      : 0;

    const gradeMap = buildGradeMap(scopeGrades);
    const scores: number[] = [];
    const risks: RiskRow[] = [];

    for (const course of scopeCourses) {
      const courseStudents = studentsByCourse.get(course.id) ?? [];
      const courseMeetings = recordedMeetings.filter(
        (meeting) => meeting.course_id === course.id,
      );
      const courseAssessments = scopeAssessments
        .filter((assessment) => assessment.course_id === course.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      const courseAssessmentIds = new Set(courseAssessments.map((a) => a.id));

      for (const student of courseStudents) {
        const presentCount = courseMeetings.filter((meeting) =>
          (attendanceByMeeting.get(meeting.id) ?? []).some(
            (row) => row.student_id === student.id && row.status === "H",
          ),
        ).length;

        const attendancePct = courseMeetings.length
          ? (presentCount / courseMeetings.length) * 100
          : null;

        const hasGrade = scopeGrades.some(
          (grade) =>
            grade.student_id === student.id &&
            courseAssessmentIds.has(grade.assessment_id),
        );

        const final = courseAssessments.length
          ? calculateFinalScore(student.id, courseAssessments, gradeMap).score
          : 0;

        if (hasGrade) scores.push(final);

        const reasons: string[] = [];
        if (
          attendancePct !== null &&
          attendancePct < Number(course.min_attendance_pct ?? 80)
        ) {
          reasons.push("Kehadiran rendah");
        }
        if (hasGrade && final < 60) {
          reasons.push("Nilai di bawah 60");
        }

        if (reasons.length > 0) {
          risks.push({
            key: `${course.id}:${student.id}`,
            npm: student.npm,
            name: student.name,
            course: `${course.name} · ${course.class_name}`,
            attendancePct,
            finalScore: hasGrade ? final : null,
            reasons,
          });
        }
      }
    }

    const averageScore = scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;

    const meetingTrend = Array.from(
      new Set(recordedMeetings.map((meeting) => meeting.meeting_no)),
    )
      .sort((a, b) => a - b)
      .map((meetingNo) => {
        const sameNo = recordedMeetings.filter(
          (meeting) => meeting.meeting_no === meetingNo,
        );
        let denominator = 0;
        let numerator = 0;

        for (const meeting of sameNo) {
          denominator += studentsByCourse.get(meeting.course_id)?.length ?? 0;
          numerator += (attendanceByMeeting.get(meeting.id) ?? []).filter(
            (row) => row.status === "H",
          ).length;
        }

        return {
          meetingNo,
          value: denominator ? (numerator / denominator) * 100 : 0,
        };
      });

    const assessmentMap = new Map(scopeAssessments.map((item) => [item.id, item]));
    const categoryBuckets = new Map<string, number[]>();

    for (const grade of scopeGrades) {
      const assessment = assessmentMap.get(grade.assessment_id);
      if (!assessment || Number(assessment.max_score) <= 0) continue;

      const category = assessment.category || assessment.name || "Lainnya";
      const normalized = (Number(grade.score) / Number(assessment.max_score)) * 100;
      const bucket = categoryBuckets.get(category) ?? [];
      bucket.push(normalized);
      categoryBuckets.set(category, bucket);
    }

    const categoryAverages = Array.from(categoryBuckets.entries())
      .map(([category, values]) => ({
        category,
        value: values.reduce((sum, value) => sum + value, 0) / values.length,
      }))
      .sort((a, b) => b.value - a.value);

    const courseSummary = scopeCourses.map((course) => {
      const courseStudents = studentsByCourse.get(course.id) ?? [];
      const courseMeetings = recordedMeetings.filter(
        (meeting) => meeting.course_id === course.id,
      );
      let expected = 0;
      let present = 0;

      for (const meeting of courseMeetings) {
        expected += courseStudents.length;
        present += (attendanceByMeeting.get(meeting.id) ?? []).filter(
          (row) => row.status === "H",
        ).length;
      }

      return {
        id: course.id,
        name: course.name,
        className: course.class_name,
        lecturer: course.lecturer,
        students: courseStudents.length,
        attendance: expected ? (present / expected) * 100 : 0,
      };
    });

    return {
      scopeCourses,
      uniqueStudents,
      recordedMeetings: recordedMeetings.length,
      attendanceRate,
      averageScore,
      risks: risks.sort((a, b) => {
        const aAttendance = a.attendancePct ?? 101;
        const bAttendance = b.attendancePct ?? 101;
        return aAttendance - bAttendance;
      }),
      meetingTrend,
      categoryAverages,
      courseSummary,
    };
  }, [attendance, assessments, courseFilter, courses, grades, meetings, students]);

  return (
    <section
      style={{
        border: "1px solid #dbeafe",
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
        borderRadius: 16,
        padding: 18,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 14,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <div className="eyebrow">Dashboard Analitik</div>
          <h2 style={{ margin: "4px 0 0" }}>Ringkasan Akademik</h2>
          <p className="muted" style={{ margin: "5px 0 0" }}>
            Kehadiran, nilai, tren pertemuan, dan mahasiswa yang perlu perhatian.
          </p>
        </div>

        <div className="field" style={{ minWidth: 240 }}>
          <label>Filter Mata Kuliah</label>
          <select
            className="select"
            value={courseFilter}
            onChange={(event) => setCourseFilter(event.currentTarget.value)}
          >
            <option value="">Semua Mata Kuliah</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name} — {course.class_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <StatCard label="Mata Kuliah" value={data.scopeCourses.length} />
        <StatCard label="Mahasiswa" value={data.uniqueStudents} />
        <StatCard label="Kehadiran" value={pct(data.attendanceRate)} />
        <StatCard label="Rata-rata Nilai" value={data.averageScore.toFixed(1)} />
        <StatCard label="Perlu Perhatian" value={data.risks.length} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <ChartCard title="Tren Kehadiran" subtitle={`${data.recordedMeetings} pertemuan memiliki data`}>
          {data.meetingTrend.length === 0 ? (
            <EmptyText text="Belum ada data absensi untuk dianalisis." />
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {data.meetingTrend.map((item) => (
                <HorizontalBar
                  key={item.meetingNo}
                  label={`P${item.meetingNo}`}
                  value={item.value}
                />
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Rata-rata Komponen Nilai" subtitle="Dinormalisasi ke skala 100">
          {data.categoryAverages.length === 0 ? (
            <EmptyText text="Belum ada nilai yang tersimpan." />
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {data.categoryAverages.map((item) => (
                <HorizontalBar
                  key={item.category}
                  label={item.category}
                  value={item.value}
                />
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <div style={{ marginBottom: 16 }}>
        <ChartCard title="Ringkasan per Kelas" subtitle="Kehadiran dihitung dari pertemuan yang sudah memiliki data absensi">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mata Kuliah</th>
                  <th>Kelas</th>
                  <th>Mahasiswa</th>
                  <th>Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {data.courseSummary.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <strong>{course.name}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {course.lecturer}
                      </div>
                    </td>
                    <td>{course.className}</td>
                    <td>{course.students}</td>
                    <td>{pct(course.attendance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Mahasiswa Perlu Perhatian" subtitle="Kehadiran di bawah batas kelas atau nilai akhir di bawah 60">
        {data.risks.length === 0 ? (
          <EmptyText text="Belum ada mahasiswa yang terdeteksi berisiko dari data saat ini." />
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>NPM</th>
                  <th>Nama</th>
                  <th>Mata Kuliah</th>
                  <th>Kehadiran</th>
                  <th>Nilai</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {data.risks.slice(0, 12).map((row) => (
                  <tr key={row.key}>
                    <td>{row.npm}</td>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.course}</td>
                    <td>{row.attendancePct === null ? "-" : pct(row.attendancePct)}</td>
                    <td>{row.finalScore === null ? "-" : row.finalScore.toFixed(1)}</td>
                    <td>{row.reasons.join(" • ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 25 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 15,
        minWidth: 0,
      }}
    >
      <div style={{ marginBottom: 13 }}>
        <strong>{title}</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
          {subtitle}
        </div>
      </div>
      {children}
    </div>
  );
}

function HorizontalBar({ label, value }: { label: string; value: number }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr 50px",
        gap: 9,
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </div>
      <div style={{ height: 9, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            width: `${safe}%`,
            height: "100%",
            background: "#2563eb",
            borderRadius: 999,
          }}
        />
      </div>
      <div style={{ fontSize: 12, textAlign: "right" }}>{safe.toFixed(0)}%</div>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div
      className="muted"
      style={{
        padding: 18,
        background: "#f8fafc",
        borderRadius: 9,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}
