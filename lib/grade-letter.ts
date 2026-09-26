export type GradeLetterScale = {
  id?: string;
  course_id: string;
  letter: string;
  min_score: number;
  max_score: number;
  sort_order: number;
};

export const DEFAULT_GRADE_SCALES: Omit<GradeLetterScale, "course_id" | "id">[] = [
  { letter: "A", min_score: 80, max_score: 100, sort_order: 1 },
  { letter: "B", min_score: 70, max_score: 79.99, sort_order: 2 },
  { letter: "C", min_score: 60, max_score: 69.99, sort_order: 3 },
  { letter: "D", min_score: 50, max_score: 59.99, sort_order: 4 },
  { letter: "E", min_score: 0, max_score: 49.99, sort_order: 5 },
];

export function resolveGradeLetter(
  score: number,
  scales: GradeLetterScale[],
) {
  if (!Number.isFinite(score) || !scales.length) return "—";

  const found = [...scales]
    .sort((a, b) => b.min_score - a.min_score)
    .find(
      (item) =>
        score >= Number(item.min_score) &&
        score <= Number(item.max_score),
    );

  return found?.letter ?? "—";
}

export function validateGradeScales(scales: GradeLetterScale[]) {
  if (!scales.length) {
    return "Minimal harus ada satu range huruf mutu.";
  }

  for (const item of scales) {
    if (!item.letter.trim()) return "Huruf mutu tidak boleh kosong.";

    const min = Number(item.min_score);
    const max = Number(item.max_score);

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return `Range ${item.letter || "?"} tidak valid.`;
    }

    if (min < 0 || max > 100 || min > max) {
      return `Range ${item.letter} harus berada di 0–100 dan nilai minimum tidak boleh lebih besar dari maksimum.`;
    }
  }

  const sorted = [...scales].sort(
    (a, b) => Number(a.min_score) - Number(b.min_score),
  );

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];

    if (Number(current.min_score) <= Number(previous.max_score)) {
      return `Range ${previous.letter} dan ${current.letter} bertumpuk.`;
    }
  }

  return "";
}
