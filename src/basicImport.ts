import data from "./data/basic-formulas.json";
import { BASIC_LATEX } from "./basicLatex";
import type { Formula, Repo } from "./types";

const FLAG = "basic-top100-imported-v3";

// 정정·계산기 추가된 공식은 기존 DB 항목도 덮어쓴다(즐겨찾기·복습 상태는 유지).
const REFRESH = new Set([5, 41, 47, 48, 68, 82, 90, 96]);

// 중복으로 삭제된 항목: 기초 22·23번, 기초 공식과 겹치는 기본 예제.
const REMOVED = ["b-22", "b-23", "f-ohm", "f-p3", "f-res", "f-ns", "f-q", "f-wl"];

const v = (symbol: string, name: string, unit: string, defaultValue: number) => ({ symbol, name, unit, defaultValue });

const CALC: Record<number, Pick<Formula, "expr" | "resultSymbol" | "resultUnit" | "variables">> = {
  5: { expr: "I*R", resultSymbol: "V", resultUnit: "V", variables: [v("I", "전류", "A", 2), v("R", "저항", "Ω", 10)] },
  41: { expr: "C*V", resultSymbol: "Q", resultUnit: "C", variables: [v("C", "정전용량", "F", 0.001), v("V", "전압", "V", 100)] },
  68: { expr: "0.5*L*I^2", resultSymbol: "W_L", resultUnit: "J", variables: [v("L", "인덕턴스", "H", 0.5), v("I", "전류", "A", 4)] },
  82: { expr: "1/(2*pi*sqrt(L*C))", resultSymbol: "f0", resultUnit: "Hz", variables: [v("L", "인덕턴스", "H", 0.01), v("C", "정전용량", "F", 0.000001)] },
  90: { expr: "sqrt(3)*VL*IL*cos(theta*pi/180)", resultSymbol: "P", resultUnit: "W", variables: [v("VL", "선간전압", "V", 380), v("IL", "선전류", "A", 10), v("theta", "위상각", "°", 36.87)] },
  96: { expr: "120*f/P", resultSymbol: "Ns", resultUnit: "rpm", variables: [v("f", "주파수", "Hz", 60), v("P", "극수", "극", 4)] },
};

const CATEGORIES = [
  { id: "c-b1", name: "기초 · 직류회로", to: 20 },
  { id: "c-b2", name: "기초 · 전력·열", to: 34 },
  { id: "c-b3", name: "기초 · 전자기", to: 68 },
  { id: "c-b4", name: "기초 · 교류·기기", to: 100 },
];

/** 기초 공식 TOP100을 최초 1회 가져온다. 이미 있는 ID는 건너뛴다. */
export async function importBasic(repo: Repo): Promise<void> {
  if (localStorage.getItem(FLAG)) return;

  const known = new Set((await repo.categories()).map((c) => c.id));
  for (const c of CATEGORIES) if (!known.has(c.id)) await repo.addCategory(c.name, c.id);

  const existing = new Map((await repo.formulas()).map((f) => [f.id, f]));
  for (const id of REMOVED) if (existing.has(id)) await repo.remove(id);
  const now = new Date().toISOString();

  for (const item of data.formulas) {
    const no = item["번호"];
    const id = `b-${no}`;
    const old = existing.get(id);
    if (old && !REFRESH.has(no)) continue;
    const needsCheck = /검증 필요|오류/.test(item["검증상태"]);
    const f: Formula = {
      id,
      categoryId: CATEGORIES.find((c) => no <= c.to)!.id,
      title: `${no}. ${item["공식명"]}`,
      latex: BASIC_LATEX[no - 1],
      description: `${item["설명·주의사항"]}\n기호·단위: ${item["기호·단위"]}`,
      tags: ["기초100", item["구분"].split(" ")[0], ...(needsCheck ? ["검증필요"] : [])],
      favorite: old?.favorite ?? false,
      box: old?.box ?? 1,
      dueAt: old?.dueAt ?? now,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
      ...(CALC[no] ?? { expr: "", resultSymbol: "", resultUnit: "", variables: [] }),
    };
    await repo.save(f);
  }
  localStorage.setItem(FLAG, "1");
}
