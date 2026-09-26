"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Course, Student } from "@/lib/types";

type Tab = "attendance" | "grades" | "students" | "settings";

type Props = {
  courses: Course[];
  students: Student[];
  onOpen: (courseId: string, tab: Tab) => void;
};

type SearchItem =
  | {
      kind: "course";
      id: string;
      courseId: string;
      title: string;
      subtitle: string;
    }
  | {
      kind: "student";
      id: string;
      courseId: string;
      title: string;
      subtitle: string;
    };

export default function AdminGlobalSearch({
  courses,
  students,
  onOpen,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  const results = useMemo<SearchItem[]>(() => {
    const normalized = query.trim().toLowerCase();

    const courseItems: SearchItem[] = courses.map((course) => ({
      kind: "course",
      id: `course-${course.id}`,
      courseId: course.id,
      title: `${course.name} — ${course.class_name}`,
      subtitle: `Mata kuliah · ${course.lecturer}`,
    }));

    const studentItems: SearchItem[] = students
      .map((student) => {
        const course = courses.find((item) => item.id === student.course_id);

        if (!course) return null;

        return {
          kind: "student" as const,
          id: `student-${student.id}`,
          courseId: course.id,
          title: `${student.name} · ${student.npm}`,
          subtitle: `Mahasiswa · ${course.name} — ${course.class_name}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const all = [...courseItems, ...studentItems];

    if (!normalized) {
      return all.slice(0, 10);
    }

    return all
      .filter(
        (item) =>
          item.title.toLowerCase().includes(normalized) ||
          item.subtitle.toLowerCase().includes(normalized),
      )
      .slice(0, 14);
  }, [query, courses, students]);

  function choose(item: SearchItem) {
    onOpen(item.courseId, item.kind === "student" ? "students" : "attendance");
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        type="button"
        className="admin-pro-icon-action admin-pro-search-trigger"
        onClick={() => setOpen(true)}
        title="Cari kelas atau mahasiswa"
      >
        🔎
        <span>Cari</span>
        <kbd>Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="admin-pro-command-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="admin-pro-command" role="dialog" aria-modal="true">
            <div className="admin-pro-command-input">
              <span>🔎</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari mahasiswa, NPM, kelas, mata kuliah, dosen..."
              />
              <kbd>ESC</kbd>
            </div>

            <div className="admin-pro-command-results">
              {results.length ? (
                results.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => choose(item)}
                  >
                    <span className="admin-pro-result-icon">
                      {item.kind === "student" ? "👨‍🎓" : "📚"}
                    </span>

                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                    </span>

                    <span className="admin-pro-result-arrow">↵</span>
                  </button>
                ))
              ) : (
                <div className="admin-pro-command-empty">
                  Tidak ada hasil untuk “{query}”.
                </div>
              )}
            </div>

            <div className="admin-pro-command-footer">
              <span>Ctrl/⌘ + K untuk membuka</span>
              <span>ESC untuk menutup</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
