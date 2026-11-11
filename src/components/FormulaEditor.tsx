import { useEffect, useRef, useState } from "react";
import { MathfieldElement } from "mathlive";

MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;

interface Props {
  value: string;
  onChange: (latex: string) => void;
}

/** 시각 편집(MathLive)과 LaTeX 직접 입력을 동기화하는 이중 입력기 */
export default function FormulaEditor({ value, onChange }: Props) {
  const [mode, setMode] = useState<"visual" | "latex">("visual");
  const mf = useRef<MathfieldElement>(null);

  useEffect(() => {
    const el = mf.current;
    if (!el || mode !== "visual") return;
    if (el.getValue("latex") !== value) el.setValue(value);
    const handler = () => onChange(el.getValue("latex"));
    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, [mode, value, onChange]);

  return (
    <div className="formula-editor">
      <div className="tabs">
        <button type="button" className={mode === "visual" ? "active" : ""} onClick={() => setMode("visual")}>
          시각 편집
        </button>
        <button type="button" className={mode === "latex" ? "active" : ""} onClick={() => setMode("latex")}>
          LaTeX
        </button>
      </div>
      {mode === "visual" ? (
        <math-field ref={mf} />
      ) : (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      )}
    </div>
  );
}
