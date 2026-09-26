"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Course } from "@/lib/types";

type Slot = {
  id: string;
  course_id: string;
  weekday: number;
  day_name: string;
  start_time: string;
  end_time: string;
  room: string | null;
};

type Props = {
  courses: Course[];
  onOpenCourse: (courseId: string) => void;
};

const DAYS = [
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
  { value: 7, label: "Minggu" },
];

export default function AcademicCalendarView({ courses, onOpenCourse }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!courses.length) {
        setSlots([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data } = await supabase
        .from("course_schedules")
        .select("id, course_id, weekday, day_name, start_time, end_time, room")
        .in("course_id", courses.map((course) => course.id))
        .order("weekday")
        .order("start_time");

      if (!cancelled) {
        setSlots((data ?? []) as Slot[]);
        setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [courses, supabase]);

  const visibleSlots = courseFilter
    ? slots.filter((slot) => slot.course_id === courseFilter)
    : slots;

  return (
    <section className="panel academic-feature-panel">
      <div className="panel-head">
        <div>
          <h2>Calendar View</h2>
          <p>Kalender mingguan seluruh jadwal kelas yang dapat diakses akun ini.</p>
        </div>
        <div className="field academic-calendar-filter">
          <label>Filter Mata Kuliah</label>
          <select className="select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="">Semua kelas</option>
            {courses.map((course) => (
              <option value={course.id} key={course.id}>
                {course.name} — {course.class_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel-body">
        {loading ? (
          <div className="empty-state">Memuat kalender...</div>
        ) : (
          <div className="academic-week-calendar">
            {DAYS.map((day) => {
              const daySlots = visibleSlots.filter((slot) => Number(slot.weekday) === day.value);

              return (
                <div className="academic-day-column" key={day.value}>
                  <div className="academic-day-head">
                    <strong>{day.label}</strong>
                    <span>{daySlots.length} kelas</span>
                  </div>

                  <div className="academic-day-body">
                    {daySlots.map((slot) => {
                      const course = courses.find((item) => item.id === slot.course_id);
                      if (!course) return null;

                      return (
                        <button
                          type="button"
                          className="academic-calendar-event"
                          key={slot.id}
                          onClick={() => onOpenCourse(course.id)}
                        >
                          <time>{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</time>
                          <strong>{course.name}</strong>
                          <span>{course.class_name}</span>
                          <small>{slot.room || course.lecturer}</small>
                        </button>
                      );
                    })}

                    {!daySlots.length && <div className="academic-calendar-empty">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
