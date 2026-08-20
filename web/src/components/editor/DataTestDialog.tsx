"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldDTO, RepeatGroupDTO } from "@/types";
import { PdfPageCanvas } from "./PdfPageCanvas";

const FIELD_TYPE_LABEL: Record<FieldDTO["type"], string> = {
  text: "텍스트",
  number: "숫자",
  date: "날짜",
  time: "시간",
  check: "체크 판정",
  choice: "선택",
};

const CANVAS_WIDTH_FALLBACK = 620;
const CANVAS_MAX_WIDTH = 720;
const CANVAS_PANE_PADDING = 48; // p-6 양쪽

// PRD_양식편집기_상세 §14.1 "데이터 테스트": 빈 원본 양식에서 필드 순서·데이터 키가
// CSV/JSON 열로 어떻게 나오는지 읽기 전용으로 확인하는 화면. 프로토타입 app.js의
// openFormTest('test') + renderCsvPreview()와 동일한 구조(원본 뷰어 + 필드 목록 + CSV·JSON
// 미리보기)를 따른다 — "검사"(구조 오류 검사)와는 다른 별개 기능이다.
export function DataTestDialog({
  templateName,
  fields,
  repeatGroups,
  pdfBuffer,
  pageNo,
  onClose,
}: {
  templateName: string;
  fields: FieldDTO[];
  repeatGroups: RepeatGroupDTO[];
  pdfBuffer: ArrayBuffer | null;
  pageNo: number;
  onClose: () => void;
}) {
  const [pdfSize, setPdfSize] = useState<{ width: number; height: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(CANVAS_WIDTH_FALLBACK);

  // 좌측 원본 뷰어가 남는 공간을 그대로 회색 여백으로 낭비하지 않도록, 패널 실제 너비에 맞춰
  // PDF를 최대한 크게 렌더링한다.
  useEffect(() => {
    const el = previewPaneRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setCanvasWidth(Math.min(CANVAS_MAX_WIDTH, Math.max(320, width - CANVAS_PANE_PADDING)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const csvEntries = useMemo(() => {
    const entries: { key: string; sample: string }[] = [];
    for (const f of fields) {
      if (f.type === "choice" && f.config.choice?.mode === "multiple") {
        const policy = f.config.choice.csvPolicy ?? "delimiter";
        if (policy === "one_column_per_option" && f.choiceOptions.length > 0) {
          for (const o of f.choiceOptions) entries.push({ key: `${f.dataKey}_${o.storedValue}`, sample: "" });
          continue;
        }
      }
      entries.push({ key: f.dataKey, sample: "" });
    }
    return entries;
  }, [fields]);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-3">
        <div>
          <div className="text-xs text-slate-400">DATA TEST</div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">{templateName} 데이터 테스트</h2>
        </div>
        <span className="text-xs rounded-full bg-slate-100 text-slate-500 px-2 py-0.5">테스트</span>
        <div className="flex-1" />
        <button onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-[var(--foreground)] cursor-pointer" title="닫기">
          ×
        </button>
      </div>
      <p className="px-5 pt-3 text-xs text-slate-400">
        빈 값으로 필드 출력 구조와 CSV·JSON 열 구성을 확인합니다. 필드 순서와 데이터 키가 실제 출력 열 순서의 기준입니다.
      </p>

      <div className="flex-1 flex min-h-0 gap-4 p-5">
        <div ref={previewPaneRef} className="flex-1 overflow-auto bg-slate-100 rounded-lg p-6 flex items-start justify-center">
          {!pdfBuffer ? (
            <p className="text-sm text-slate-400">PDF가 없습니다.</p>
          ) : (
            <div className="relative bg-white shadow" style={{ width: pdfSize?.width ?? canvasWidth, height: pdfSize?.height }}>
              <PdfPageCanvas pdfBuffer={pdfBuffer} pageNo={pageNo} width={canvasWidth} onSize={setPdfSize} />
              <div className="absolute inset-0">
                {fields
                  .filter((f) => f.pageNo === pageNo)
                  .map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveId(f.id)}
                      className={`absolute border-2 text-[9px] px-0.5 overflow-hidden text-left cursor-pointer ${
                        activeId === f.id ? "border-[var(--color-brand-600)] bg-[var(--color-brand-50)]/80" : "border-slate-400 bg-white/50"
                      }`}
                      style={{ left: `${f.boxX * 100}%`, top: `${f.boxY * 100}%`, width: `${f.boxW * 100}%`, height: `${f.boxH * 100}%` }}
                      title={f.label}
                    >
                      {f.label}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-[640px] shrink-0 flex flex-col gap-4 min-h-0">
          <div className="border border-[var(--color-border)] rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="px-5 py-3 bg-slate-50 border-b border-[var(--color-border)]">
              <div className="text-base font-medium text-[var(--foreground)]">필드 출력 구조</div>
              <div className="text-sm text-slate-400">필드 순서와 데이터 키가 CSV 열로 어떻게 생성되는지 확인합니다.</div>
            </div>
            <ul className="divide-y divide-[var(--color-border)] flex-1 overflow-y-auto">
              {fields.map((f) => (
                <li
                  key={f.id}
                  onClick={() => setActiveId(f.id)}
                  className={`flex items-center justify-between px-5 py-3 text-base cursor-pointer ${activeId === f.id ? "bg-[var(--color-brand-50)]" : "hover:bg-slate-50"}`}
                >
                  <span className="font-medium">
                    {f.label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </span>
                  <span className="text-sm text-slate-400 font-mono">
                    {f.dataKey} · {FIELD_TYPE_LABEL[f.type]}
                  </span>
                </li>
              ))}
              {repeatGroups.map((g) => (
                <li key={g.id} className="flex items-center justify-between px-5 py-3 text-base bg-teal-50/40">
                  <span className="font-medium text-teal-700">{g.label} (반복행)</span>
                  <span className="text-sm text-teal-600 font-mono">{g.dataKey}[] · {g.columns.length}개 열</span>
                </li>
              ))}
              {fields.length === 0 && repeatGroups.length === 0 && (
                <li className="px-5 py-8 text-center text-base text-slate-400">정의된 필드가 없습니다.</li>
              )}
            </ul>
          </div>

          <div className="border border-[var(--color-border)] rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="px-5 py-3 bg-slate-50 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <div className="text-base font-medium text-[var(--foreground)]">CSV 자동 생성</div>
                <div className="text-sm text-slate-400">데이터 키가 열 이름으로 사용됩니다.</div>
              </div>
              <span className="text-sm text-slate-400">{csvEntries.length}개 열 · 1건</span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="text-sm min-w-full">
                <thead className="bg-slate-50 text-slate-400 sticky top-0">
                  <tr>
                    {csvEntries.map((e) => (
                      <th key={e.key} className="px-3 py-2.5 font-medium whitespace-nowrap text-left">
                        {e.key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {csvEntries.map((e) => (
                      <td key={e.key} className="px-3 py-2.5 text-slate-300 whitespace-nowrap">
                        {e.sample || "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {repeatGroups.length > 0 && (
              <p className="px-5 py-2.5 text-sm text-slate-400 border-t border-[var(--color-border)]">
                반복행({repeatGroups.map((g) => g.label).join(", ")})은 이 미리보기에는 포함되지 않고, 실제 CSV/Excel 다운로드에서는 행으로
                펼쳐집니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
