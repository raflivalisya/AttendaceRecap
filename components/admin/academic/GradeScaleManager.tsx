"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_GRADE_SCALES,
  type GradeLetterScale,
  validateGradeScales,
} from "@/lib/grade-letter";

type Props = {
  courseId: string;
  canEdit: boolean;
  scales: GradeLetterScale[];
  onChange: (scales: GradeLetterScale[]) => void;
};

function withCourse(
  courseId: string,
  items: typeof DEFAULT_GRADE_SCALES,
): GradeLetterScale[] {
  return items.map((item) => ({
    ...item,
    course_id: courseId,
  }));
}

export default function GradeScaleManager({
  courseId,
  canEdit,
  scales,
  onChange,
}: Props) {
  const supabase = createClient();
  const [draft, setDraft] = useState<GradeLetterScale[]>(scales);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDraft(scales);
    setMessage("");
  }, [courseId, scales]);

  function update(
    index: number,
    patch: Partial<GradeLetterScale>,
  ) {
    setDraft((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function addRange() {
    setDraft((items) => [
      ...items,
      {
        course_id: courseId,
        letter: "",
        min_score: 0,
        max_score: 0,
        sort_order: items.length + 1,
      },
    ]);
  }

  function useDefault() {
    setDraft(withCourse(courseId, DEFAULT_GRADE_SCALES));
    setMessage("Template A–E dimuat. Klik Simpan Range untuk menerapkan.");
  }

  async function save() {
    const normalized = draft.map((item, index) => ({
      ...item,
      course_id: courseId,
      letter: item.letter.trim().toUpperCase(),
      min_score: Number(item.min_score),
      max_score: Number(item.max_score),
      sort_order: index + 1,
    }));

    const validation = validateGradeScales(normalized);

    if (validation) {
      setMessage(validation);
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("replace_grade_letter_scales", {
      target_course_id: courseId,
      scales: normalized.map((item) => ({
        letter: item.letter,
        min_score: item.min_score,
        max_score: item.max_score,
        sort_order: item.sort_order,
      })),
    });

    if (error) {
      setMessage(`Gagal menyimpan range: ${error.message}`);
      setSaving(false);
      return;
    }

    const { data, error: reloadError } = await supabase
      .from("grade_letter_scales")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order");

    if (reloadError) {
      setMessage(
        `Range tersimpan, tetapi gagal dimuat ulang: ${reloadError.message}`,
      );
      setSaving(false);
      return;
    }

    const next = (data ?? []) as GradeLetterScale[];
    onChange(next);
    setDraft(next);
    setMessage("Range huruf mutu berhasil disimpan.");
    setSaving(false);
  }

  return (
    <section
      style={{
        marginBottom: 18,
        padding: 14,
        border: "1px solid #dce5ed",
        borderRadius: 12,
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div>
          <strong>Range Huruf Mutu</strong>
          <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
            Atur range nilai akhir 0–100. Range tidak boleh bertumpuk.
          </div>
        </div>

        {canEdit && (
          <div className="admin-actions">
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={useDefault}
            >
              Template A–E
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={addRange}
            >
              + Tambah Huruf
            </button>

            <button
              type="button"
              className="btn btn-primary btn-small"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Menyimpan..." : "Simpan Range"}
            </button>
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Huruf Mutu</th>
              <th>Nilai Minimum</th>
              <th>Nilai Maksimum</th>
              {canEdit && <th>Aksi</th>}
            </tr>
          </thead>

          <tbody>
            {draft.map((item, index) => (
              <tr key={`${index}-${item.letter}`}>
                <td>
                  {canEdit ? (
                    <input
                      className="input"
                      value={item.letter}
                      maxLength={8}
                      onChange={(event) =>
                        update(index, {
                          letter: event.target.value.toUpperCase(),
                        })
                      }
                      placeholder="A / AB / B+"
                    />
                  ) : (
                    <strong>{item.letter}</strong>
                  )}
                </td>

                <td>
                  {canEdit ? (
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.min_score}
                      onChange={(event) =>
                        update(index, {
                          min_score: Number(event.target.value),
                        })
                      }
                    />
                  ) : (
                    item.min_score
                  )}
                </td>

                <td>
                  {canEdit ? (
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.max_score}
                      onChange={(event) =>
                        update(index, {
                          max_score: Number(event.target.value),
                        })
                      }
                    />
                  ) : (
                    item.max_score
                  )}
                </td>

                {canEdit && (
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      disabled={draft.length <= 1}
                      onClick={() =>
                        setDraft((items) =>
                          items.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      Hapus
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && (
        <div
          className={
            message.toLowerCase().includes("gagal") ||
            message.toLowerCase().includes("tidak") ||
            message.toLowerCase().includes("harus") ||
            message.toLowerCase().includes("bertumpuk")
              ? "error"
              : "success"
          }
          style={{ marginTop: 12 }}
        >
          {message}
        </div>
      )}
    </section>
  );
}
