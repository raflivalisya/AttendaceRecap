"use client";

type Course = {
  id: string;
  name: string;
  class_name: string;
  lecturer: string;
};

type Props = {
  courses: Course[];
  selectedCourseId: string;
  onSelect: (courseId: string) => void;
};

export default function CourseByLecturer({
  courses,
  selectedCourseId,
  onSelect,
}: Props) {
  // Kelompokkan mata kuliah berdasarkan dosen
  const groupedCourses = courses.reduce<
    Record<string, Course[]>
  >((groups, course) => {
    const lecturer =
      course.lecturer?.trim() || "Belum Ada Dosen";

    if (!groups[lecturer]) {
      groups[lecturer] = [];
    }

    groups[lecturer].push(course);

    return groups;
  }, {});

  const lecturers = Object.keys(groupedCourses).sort();

  if (courses.length === 0) {
    return (
      <div className="panel">
        <div className="panel-body">
          Belum ada mata kuliah.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Mata Kuliah Berdasarkan Dosen</h2>

          <p>
            Pilih dosen pengampu kemudian pilih mata kuliah
            yang ingin dikelola.
          </p>
        </div>
      </div>

      <div className="panel-body">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {lecturers.map((lecturer) => (
            <details
              key={lecturer}
              open={groupedCourses[lecturer].some(
                (course) =>
                  course.id === selectedCourseId
              )}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#ffffff",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  padding: "16px 18px",
                  fontWeight: 700,
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>👨‍🏫 {lecturer}</span>

                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    background: "#e2e8f0",
                    padding: "4px 10px",
                    borderRadius: "999px",
                  }}
                >
                  {groupedCourses[lecturer].length} Mata Kuliah
                </span>
              </summary>

              <div
                style={{
                  padding: "14px",
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "10px",
                }}
              >
                {groupedCourses[lecturer]
                  .sort((a, b) =>
                    a.name.localeCompare(b.name)
                  )
                  .map((course) => {
                    const active =
                      course.id === selectedCourseId;

                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() =>
                          onSelect(course.id)
                        }
                        style={{
                          textAlign: "left",
                          cursor: "pointer",
                          borderRadius: "10px",
                          padding: "14px",
                          border: active
                            ? "2px solid #2563eb"
                            : "1px solid #e5e7eb",
                          background: active
                            ? "#eff6ff"
                            : "#ffffff",
                          transition: "0.2s",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            marginBottom: "5px",
                            color: active
                              ? "#1d4ed8"
                              : "#111827",
                          }}
                        >
                          {course.name}
                        </div>

                        <div
                          style={{
                            fontSize: "13px",
                            color: "#64748b",
                          }}
                        >
                          Kelas:{" "}
                          {course.class_name ||
                            "Belum ditentukan"}
                        </div>

                        {active && (
                          <div
                            style={{
                              marginTop: "8px",
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#2563eb",
                            }}
                          >
                            ✓ Kelas Aktif
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}