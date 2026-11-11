import { create, all } from "mathjs";
import type { Formula } from "./types";

const math = create(all, {});

export function calculate(expr: string, scope: Record<string, number>): number | null {
  try {
    const v = math.evaluate(expr, { ...scope });
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export function formatNumber(n: number): string {
  return Number(n.toPrecision(6)).toString();
}

const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];

/** 라이트너 방식: 정답이면 박스+1, 오답이면 박스 1로 복귀 */
export function nextReview(box: number, correct: boolean, now = new Date()) {
  const nextBox = correct ? Math.min(box + 1, 5) : 1;
  const due = new Date(now.getTime() + INTERVAL_DAYS[nextBox] * 86_400_000);
  return { box: nextBox, dueAt: due.toISOString() };
}

export function isDue(f: Formula, now = new Date()): boolean {
  return new Date(f.dueAt).getTime() <= now.getTime();
}
