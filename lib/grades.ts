import type { Assessment, Grade } from "./types";

export function buildGradeMap(grades: Grade[]) {
  const map = new Map<string, number>();
  grades.forEach((item) => {
    map.set(`${item.assessment_id}:${item.student_id}`, Number(item.score));
  });
  return map;
}

export function calculateFinalScore(
  studentId: string,
  assessments: Assessment[],
  gradeMap: Map<string, number>,
) {
  let final = 0;
  let completed = 0;

  assessments.forEach((assessment) => {
    const score = gradeMap.get(`${assessment.id}:${studentId}`);
    if (score === undefined) return;
    completed += 1;
    final += (score / Number(assessment.max_score || 100)) * Number(assessment.weight || 0);
  });

  return {
    score: Math.round(final * 100) / 100,
    completed,
    total: assessments.length,
  };
}
