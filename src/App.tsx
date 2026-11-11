import { useCallback, useEffect, useMemo, useState } from "react";
import katex from "katex";
import FormulaEditor from "./components/FormulaEditor";
import { openRepo } from "./db";
import { calculate, formatNumber, isDue } from "./math";
import type { Category, Formula, Repo, Variable } from "./types";

type View = "notes" | "quiz";

const Tex = ({ latex, block = false }: { latex: string; block?: boolean }) => (
  <span
    dangerouslySetInnerHTML={{
      __html: katex.renderToString(latex || "\\;", { throwOnError: false, displayMode: block }),
    }}
  />
);

const blank = (categoryId: string): Formula => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), categoryId, title: "", latex: "", expr: "", resultSymbol: "", resultUnit: "",
    description: "", variables: [], tags: [], favorite: false, box: 1, dueAt: now, createdAt: now, updatedAt: now,
  };
};

export default function App() {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [catId, setCatId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Formula | null>(null);
  const [view, setView] = useState<View>("notes");
  const [detailOpen, setDetailOpen] = useState(false);

  const reload = useCallback(async (r: Repo) => {
    setCategories(await r.categories());
    setFormulas(await r.formulas());
  }, []);

  useEffect(() => {
    openRepo().then((r) => { setRepo(r); return reload(r); });
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return formulas.filter((f) =>
      (catId === "all" || f.categoryId === catId) &&
      (!favOnly || f.favorite) &&
      (!q || f.title.toLowerCase().includes(q) || f.latex.toLowerCase().includes(q) ||
        f.tags.some((t) => t.toLowerCase().includes(q))));
  }, [formulas, catId, query, favOnly]);

  const selected = formulas.find((f) => f.id === selId) ?? filtered[0] ?? null;

  const act = async (fn: (r: Repo) => Promise<unknown>) => {
    if (!repo) return;
    await fn(repo);
    await reload(repo);
  };

  if (!repo) return <div className="loading">불러오는 중…</div>;

  return (
    <div className={`app${detailOpen ? " show-detail" : ""}`}>
      <aside className="sidebar">
        <h1>⚡ 공식 노트</h1>
        <nav>
          <button className={view === "notes" ? "active" : ""} onClick={() => setView("notes")}>노트</button>
          <button className={view === "quiz" ? "active" : ""} onClick={() => setView("quiz")}>
            암기 퀴즈 ({formulas.filter((f) => isDue(f)).length})
          </button>
        </nav>
        <h2>분류</h2>
        <ul>
          <li className={catId === "all" ? "active" : ""} onClick={() => { setCatId("all"); setView("notes"); }}>전체 ({formulas.length})</li>
          {categories.map((c) => (
            <li key={c.id} className={catId === c.id ? "active" : ""} onClick={() => { setCatId(c.id); setView("notes"); }}>
              {c.name} ({formulas.filter((f) => f.categoryId === c.id).length})
            </li>
          ))}
        </ul>
        <button onClick={() => {
          const name = prompt("새 분류 이름");
          if (name?.trim()) act((r) => r.addCategory(name.trim()));
        }}>+ 분류 추가</button>
      </aside>

      {view === "quiz" ? (
        <Quiz formulas={formulas.filter((f) => isDue(f))} onReview={(id, ok) => act((r) => r.review(id, ok))} />
      ) : (
        <>
          <section className="list">
            <div className="toolbar">
              <input placeholder="제목·태그·LaTeX 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
              <label><input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} /> ★만</label>
              <button className="primary" onClick={() => setEditing(blank(catId === "all" ? categories[0]?.id ?? "" : catId))}>
                + 새 공식
              </button>
            </div>
            <ul>
              {filtered.map((f) => (
                <li key={f.id} className={selected?.id === f.id ? "active" : ""} onClick={() => { setSelId(f.id); setDetailOpen(true); }}>
                  <div className="row">
                    <strong>{f.title}</strong>
                    <span>{f.favorite ? "★" : ""}</span>
                  </div>
                  <Tex latex={f.latex} />
                </li>
              ))}
              {!filtered.length && <li className="empty">결과 없음</li>}
            </ul>
          </section>

          <main className="detail">
            {selected ? (
              <Detail
                f={selected}
                onBack={() => setDetailOpen(false)}
                category={categories.find((c) => c.id === selected.categoryId)?.name ?? ""}
                onFav={() => act((r) => r.toggleFavorite(selected.id))}
                onEdit={() => setEditing(structuredClone(selected))}
                onDelete={() => { if (confirm("삭제할까요?")) act((r) => r.remove(selected.id)); }}
              />
            ) : <p className="empty">공식을 선택하세요.</p>}
          </main>
        </>
      )}

      {editing && (
        <EditDialog
          f={editing}
          categories={categories}
          onCancel={() => setEditing(null)}
          onSave={async (f) => {
            await act((r) => r.save({ ...f, updatedAt: new Date().toISOString() }));
            setSelId(f.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Detail({ f, category, onBack, onFav, onEdit, onDelete }: {
  f: Formula; category: string; onBack: () => void; onFav: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [vals, setVals] = useState<Record<string, number>>({});
  useEffect(() => {
    setVals(Object.fromEntries(f.variables.map((v) => [v.symbol, v.defaultValue])));
  }, [f]);

  const result = f.expr ? calculate(f.expr, vals) : null;

  return (
    <div>
      <button className="back" onClick={onBack}>← 목록</button>
      <div className="row">
        <h2>{f.title}</h2>
        <div className="actions">
          <button onClick={onFav}>{f.favorite ? "★" : "☆"}</button>
          <button onClick={onEdit}>편집</button>
          <button className="danger" onClick={onDelete}>삭제</button>
        </div>
      </div>
      <p className="meta">{category} · 박스 {f.box}/5 {f.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</p>
      <div className="formula-view"><Tex latex={f.latex} block /></div>
      {f.description && <p>{f.description}</p>}

      {f.variables.length > 0 && (
        <>
          <h3>변수</h3>
          <table>
            <tbody>
              {f.variables.map((v) => (
                <tr key={v.symbol}>
                  <td><code>{v.symbol}</code></td>
                  <td>{v.name}</td>
                  <td>
                    {f.expr ? (
                      <input type="number" value={vals[v.symbol] ?? 0}
                        onChange={(e) => setVals({ ...vals, [v.symbol]: Number(e.target.value) })} />
                    ) : v.defaultValue}
                  </td>
                  <td>{v.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {f.expr && (
        <div className="result">
          {f.resultSymbol || "결과"} = <strong>{result === null ? "계산 불가" : formatNumber(result)}</strong> {f.resultUnit}
        </div>
      )}
    </div>
  );
}

function Quiz({ formulas, onReview }: { formulas: Formula[]; onReview: (id: string, ok: boolean) => void }) {
  const [show, setShow] = useState(false);
  const f = formulas[0];
  if (!f) return <main className="detail"><p className="empty">오늘 복습할 공식이 없습니다. 🎉</p></main>;
  const answer = (ok: boolean) => { setShow(false); onReview(f.id, ok); };
  return (
    <main className="detail quiz">
      <p className="meta">남은 문제 {formulas.length}개 · 박스 {f.box}/5</p>
      <h2>{f.title}</h2>
      {f.description && <p>{f.description}</p>}
      <div className="formula-view">{show ? <Tex latex={f.latex} block /> : <span className="hidden">? ? ?</span>}</div>
      {!show ? (
        <button className="primary" onClick={() => setShow(true)}>정답 보기</button>
      ) : (
        <div className="actions">
          <button className="danger" onClick={() => answer(false)}>틀렸다</button>
          <button className="primary" onClick={() => answer(true)}>맞았다</button>
        </div>
      )}
    </main>
  );
}

function EditDialog({ f, categories, onSave, onCancel }: {
  f: Formula; categories: Category[]; onSave: (f: Formula) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<Formula>(f);
  const set = <K extends keyof Formula>(k: K, v: Formula[K]) => setD((p) => ({ ...p, [k]: v }));
  const onLatex = useCallback((l: string) => setD((p) => (p.latex === l ? p : { ...p, latex: l })), []);
  const setVar = (i: number, patch: Partial<Variable>) =>
    set("variables", d.variables.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="modal">
      <form className="dialog" onSubmit={(e) => { e.preventDefault(); if (d.title.trim() && d.categoryId) onSave(d); }}>
        <h2>공식 편집</h2>
        <div className="grid2">
          <label>제목<input value={d.title} onChange={(e) => set("title", e.target.value)} required /></label>
          <label>분류
            <select value={d.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <label>공식</label>
        <FormulaEditor value={d.latex} onChange={onLatex} />
        <div className="preview"><Tex latex={d.latex} block /></div>
        <label>설명<textarea rows={2} value={d.description} onChange={(e) => set("description", e.target.value)} /></label>
        <label>태그 (쉼표 구분)
          <input value={d.tags.join(", ")}
            onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} />
        </label>
        <h3>계산기 (선택)</h3>
        <div className="grid3">
          <label>계산식 (mathjs)<input placeholder="예: V*I*cos(theta*pi/180)" value={d.expr} onChange={(e) => set("expr", e.target.value)} /></label>
          <label>결과 기호<input value={d.resultSymbol} onChange={(e) => set("resultSymbol", e.target.value)} /></label>
          <label>결과 단위<input value={d.resultUnit} onChange={(e) => set("resultUnit", e.target.value)} /></label>
        </div>
        {d.variables.map((x, i) => (
          <div key={i} className="grid5">
            <input placeholder="기호" value={x.symbol} onChange={(e) => setVar(i, { symbol: e.target.value })} />
            <input placeholder="이름" value={x.name} onChange={(e) => setVar(i, { name: e.target.value })} />
            <input placeholder="단위" value={x.unit} onChange={(e) => setVar(i, { unit: e.target.value })} />
            <input type="number" placeholder="기본값" value={x.defaultValue} onChange={(e) => setVar(i, { defaultValue: Number(e.target.value) })} />
            <button type="button" onClick={() => set("variables", d.variables.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" onClick={() => set("variables", [...d.variables, { symbol: "", name: "", unit: "", defaultValue: 0 }])}>
          + 변수 추가
        </button>
        <div className="actions end">
          <button type="button" onClick={onCancel}>취소</button>
          <button className="primary" type="submit">저장</button>
        </div>
      </form>
    </div>
  );
}
