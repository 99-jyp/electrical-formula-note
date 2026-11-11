import type { Category, Formula, Repo, Variable } from "./types";
import { nextReview } from "./math";
import { importBasic } from "./basicImport";

const DB_URL = "sqlite:formula_note.db";
const LS_KEY = "formula-note-v1";

export const SEED_CATEGORIES: Category[] = [
  { id: "c-circuit", name: "회로이론" },
  { id: "c-power", name: "전력공학" },
  { id: "c-machine", name: "전기기기" },
  { id: "c-emag", name: "전자기학" },
];

function seed(
  id: string, categoryId: string, title: string, latex: string, expr: string,
  resultSymbol: string, resultUnit: string, description: string,
  variables: Variable[], tags: string[],
): Formula {
  const now = new Date().toISOString();
  return {
    id, categoryId, title, latex, expr, resultSymbol, resultUnit, description,
    variables, tags, favorite: false, box: 1, dueAt: now, createdAt: now, updatedAt: now,
  };
}

const v = (symbol: string, name: string, unit: string, defaultValue: number): Variable => ({
  symbol, name, unit, defaultValue,
});

export const SEED_FORMULAS: Formula[] = [
  seed("f-p1", "c-circuit", "단상 교류 전력", "P = V I \\cos\\theta", "V*I*cos(theta*pi/180)", "P", "W",
    "유효전력. θ는 도(°) 단위로 입력.", [v("V", "전압", "V", 220), v("I", "전류", "A", 10), v("theta", "위상각", "°", 30)], ["전력", "교류"]),
  seed("f-vd", "c-power", "단상 2선식 전압강하", "e = 2I\\,(R\\cos\\theta + X\\sin\\theta)", "2*I*(R*cos(theta*pi/180)+X*sin(theta*pi/180))", "e", "V",
    "배전선로 전압강하.", [v("I", "전류", "A", 20), v("R", "저항", "Ω", 0.1), v("X", "리액턴스", "Ω", 0.05), v("theta", "위상각", "°", 30)], ["배전"]),
  seed("f-slip", "c-machine", "슬립", "s = \\frac{N_s - N}{N_s}", "(Ns-N)/Ns", "s", "",
    "유도전동기 슬립.", [v("Ns", "동기속도", "rpm", 1800), v("N", "회전속도", "rpm", 1740)], ["회전기", "유도기"]),
  seed("f-tr", "c-machine", "변압기 권수비", "a = \\frac{N_1}{N_2} = \\frac{V_1}{V_2} = \\frac{I_2}{I_1}", "V1/V2", "a", "",
    "1차/2차 권수비.", [v("V1", "1차전압", "V", 6600), v("V2", "2차전압", "V", 220)], ["변압기"]),
];

/* ---------------- localStorage (브라우저 개발용) ---------------- */

interface Store { categories: Category[]; formulas: Formula[] }

function localRepo(): Repo {
  const load = (): Store => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Store;
    const s: Store = { categories: SEED_CATEGORIES, formulas: SEED_FORMULAS };
    localStorage.setItem(LS_KEY, JSON.stringify(s));
    return s;
  };
  const persist = (s: Store) => localStorage.setItem(LS_KEY, JSON.stringify(s));
  return {
    categories: async () => load().categories,
    formulas: async () => load().formulas,
    async addCategory(name, id) {
      const s = load();
      const c = { id: id ?? crypto.randomUUID(), name };
      s.categories.push(c);
      persist(s);
      return c;
    },
    async save(f) {
      const s = load();
      const i = s.formulas.findIndex((x) => x.id === f.id);
      if (i >= 0) s.formulas[i] = f; else s.formulas.push(f);
      persist(s);
    },
    async remove(id) {
      const s = load();
      s.formulas = s.formulas.filter((x) => x.id !== id);
      persist(s);
    },
    async toggleFavorite(id) {
      const s = load();
      const f = s.formulas.find((x) => x.id === id);
      if (f) f.favorite = !f.favorite;
      persist(s);
    },
    async review(id, correct) {
      const s = load();
      const f = s.formulas.find((x) => x.id === id);
      if (f) Object.assign(f, nextReview(f.box, correct));
      persist(s);
    },
  };
}

/* ---------------- SQLite (Tauri) ---------------- */

interface Db {
  execute(sql: string, bind?: unknown[]): Promise<unknown>;
  select<T>(sql: string, bind?: unknown[]): Promise<T>;
}

async function sqliteRepo(): Promise<Repo> {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db: Db = await Database.load(DB_URL);

  const categories = () => db.select<Category[]>("SELECT id, name FROM categories ORDER BY sort_order, name");

  const formulas = async (): Promise<Formula[]> => {
    const rows = await db.select<Record<string, unknown>[]>("SELECT * FROM formulas ORDER BY created_at");
    const vars = await db.select<Record<string, unknown>[]>(
      "SELECT formula_id, symbol, name, unit, default_value FROM variables ORDER BY formula_id, position");
    const tags = await db.select<{ formula_id: string; name: string }[]>(
      "SELECT ft.formula_id, t.name FROM formula_tags ft JOIN tags t ON t.id = ft.tag_id ORDER BY t.name");
    return rows.map((r) => ({
      id: r.id as string,
      categoryId: r.category_id as string,
      title: r.title as string,
      latex: r.latex as string,
      expr: r.expr as string,
      resultSymbol: r.result_symbol as string,
      resultUnit: r.result_unit as string,
      description: r.description as string,
      favorite: r.favorite === 1,
      box: r.box as number,
      dueAt: r.due_at as string,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      variables: vars.filter((x) => x.formula_id === r.id).map((x) => ({
        symbol: x.symbol as string, name: x.name as string, unit: x.unit as string,
        defaultValue: x.default_value as number,
      })),
      tags: tags.filter((t) => t.formula_id === r.id).map((t) => t.name),
    }));
  };

  const save = async (f: Formula) => {
    await db.execute(
      `INSERT INTO formulas (id, category_id, title, latex, expr, result_symbol, result_unit, description, favorite, box, due_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT(id) DO UPDATE SET category_id=$2, title=$3, latex=$4, expr=$5, result_symbol=$6,
         result_unit=$7, description=$8, favorite=$9, box=$10, due_at=$11, updated_at=$13`,
      [f.id, f.categoryId, f.title, f.latex, f.expr, f.resultSymbol, f.resultUnit, f.description,
      f.favorite ? 1 : 0, f.box, f.dueAt, f.createdAt, f.updatedAt]);
    await db.execute("DELETE FROM variables WHERE formula_id = $1", [f.id]);
    await db.execute("DELETE FROM formula_tags WHERE formula_id = $1", [f.id]);
    for (const [i, x] of f.variables.entries()) {
      await db.execute(
        "INSERT INTO variables (formula_id, position, symbol, name, unit, default_value) VALUES ($1,$2,$3,$4,$5,$6)",
        [f.id, i, x.symbol, x.name, x.unit, x.defaultValue]);
    }
    for (const t of f.tags) {
      await db.execute("INSERT OR IGNORE INTO tags (name) VALUES ($1)", [t]);
      await db.execute(
        "INSERT OR IGNORE INTO formula_tags (formula_id, tag_id) SELECT $1, id FROM tags WHERE name = $2", [f.id, t]);
    }
  };

  const [{ n }] = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM formulas");
  if (n === 0) {
    for (const [i, c] of SEED_CATEGORIES.entries()) {
      await db.execute("INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES ($1,$2,$3)", [c.id, c.name, i]);
    }
    for (const f of SEED_FORMULAS) await save(f);
  }

  return {
    categories,
    formulas,
    async addCategory(name, id) {
      const c = { id: id ?? crypto.randomUUID(), name };
      await db.execute("INSERT INTO categories (id, name, sort_order) VALUES ($1,$2,$3)", [c.id, name, id ? 10 : 99]);
      return c;
    },
    save,
    async remove(id) {
      await db.execute("DELETE FROM formulas WHERE id = $1", [id]);
    },
    async toggleFavorite(id) {
      await db.execute("UPDATE formulas SET favorite = 1 - favorite WHERE id = $1", [id]);
    },
    async review(id, correct) {
      const rows = await db.select<{ box: number }[]>("SELECT box FROM formulas WHERE id = $1", [id]);
      if (!rows.length) return;
      const r = nextReview(rows[0].box, correct);
      await db.execute("UPDATE formulas SET box=$1, due_at=$2 WHERE id=$3", [r.box, r.dueAt, id]);
      await db.execute("INSERT INTO reviews (formula_id, correct, reviewed_at) VALUES ($1,$2,$3)",
        [id, correct ? 1 : 0, new Date().toISOString()]);
    },
  };
}

export const isTauri = () => "__TAURI_INTERNALS__" in window;

export async function openRepo(): Promise<Repo> {
  const repo = isTauri() ? await sqliteRepo() : localRepo();
  await importBasic(repo);
  return repo;
}
