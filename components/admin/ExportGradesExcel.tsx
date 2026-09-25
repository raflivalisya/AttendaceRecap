"use client";

type Course = {
  id: string;
  name: string;
  class_name: string;
  lecturer: string;
  semester?: string;
  academic_year?: string;
};

type Student = {
  id: string;
  course_id: string;
  npm: string;
  name: string;
};

type Assessment = {
  id: string;
  course_id: string;
  name: string;
  category: string;
  max_score: number;
  weight: number;
  sort_order: number;
};

type Grade = {
  id: string;
  assessment_id: string;
  student_id: string;
  score: number;
};

type Props = {
  course: Course;
  students: Student[];
  assessments: Assessment[];
  grades: Grade[];
};

export default function ExportGradesExcel({
  course,
  students,
  assessments,
  grades,
}: Props) {
  async function exportExcel() {
    const XLSX = await import("xlsx");

    const courseStudents = students
      .filter((student) => student.course_id === course.id)
      .sort((a, b) => a.name.localeCompare(b.name));

    const courseAssessments = assessments
      .filter((assessment) => assessment.course_id === course.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    function getScore(
      studentId: string,
      assessmentId: string
    ) {
      const grade = grades.find(
        (item) =>
          item.student_id === studentId &&
          item.assessment_id === assessmentId
      );

      return grade ? Number(grade.score) : "";
    }

    function getFinalScore(studentId: string) {
      let total = 0;

      courseAssessments.forEach((assessment) => {
        const grade = grades.find(
          (item) =>
            item.student_id === studentId &&
            item.assessment_id === assessment.id
        );

        if (!grade) return;

        const score = Number(grade.score);
        const maxScore = Number(assessment.max_score);
        const weight = Number(assessment.weight);

        if (maxScore > 0) {
          total += (score / maxScore) * weight;
        }
      });

      return Number(total.toFixed(2));
    }

    const headers = [
      "No",
      "NPM",
      "Nama Mahasiswa",

      ...courseAssessments.map(
        (assessment) =>
          `${assessment.name} (${assessment.weight}%)`
      ),

      "Nilai Akhir",
    ];

    const rows: (string | number)[][] = [];

    // Judul
    rows.push([
      `REKAP NILAI - ${course.name}`,
    ]);

    rows.push([
      "Mata Kuliah",
      course.name,
    ]);

    rows.push([
      "Kelas",
      course.class_name,
    ]);

    rows.push([
      "Dosen Pengampu",
      course.lecturer,
    ]);

    rows.push([
      "Semester",
      course.semester || "-",
    ]);

    rows.push([
      "Tahun Akademik",
      course.academic_year || "-",
    ]);

    rows.push([]);

    // Header tabel
    rows.push(headers);

    // Data mahasiswa
    courseStudents.forEach(
      (student, index) => {
        rows.push([
          index + 1,
          student.npm,
          student.name,

          ...courseAssessments.map(
            (assessment) =>
              getScore(
                student.id,
                assessment.id
              )
          ),

          getFinalScore(student.id),
        ]);
      }
    );

    const worksheet =
      XLSX.utils.aoa_to_sheet(rows);

    // Gabungkan judul
    worksheet["!merges"] = [
      {
        s: { r: 0, c: 0 },
        e: {
          r: 0,
          c: headers.length - 1,
        },
      },
    ];

    // Lebar kolom
    worksheet["!cols"] = [
      { wch: 6 },  // No
      { wch: 15 }, // NPM
      { wch: 32 }, // Nama

      ...courseAssessments.map(() => ({
        wch: 16,
      })),

      { wch: 15 }, // Nilai akhir
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Nilai"
    );

    const safeCourseName =
      course.name
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/\s+/g, "-");

    const safeClassName =
      course.class_name
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/\s+/g, "-");

    XLSX.writeFile(
      workbook,
      `Nilai-${safeCourseName}-${safeClassName}.xlsx`,
      {
        compression: true,
      }
    );
  }

  return (
    <button
      type="button"
      className="btn btn-success"
      onClick={exportExcel}
    >
      📊 Export Nilai Excel
    </button>
  );
}