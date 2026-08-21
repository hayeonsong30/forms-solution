"use client";

import { useEffect, useState } from "react";
import { arrayBufferToBase64 } from "@/lib/base64";

type Placeholder = { label: string; dataKey: string; type: string; system?: boolean };
type ValidationError = { code: string; key: string; sheet: string; cell: string; suggestedKey?: string };
type ValidationResult = {
  status: "valid" | "invalid";
  validPlaceholders: { key: string; sheet: string; cell: string }[];
  errors: ValidationError[];
};
type ExcelTemplateMeta = {
  id: string;
  name: string;
  fileName: string;
  status: "validating" | "invalid" | "active";
  placeholderCount: number;
  updatedAt: string;
};

// PRD_Excel_플레이스홀더_간단버전 §5: "Excel 템플릿 설정" — 고객이 자기 엑셀 서식에
// [데이터키]를 넣어 올리면 검사하고, 확정 문서로 치환 출력할 수 있게 등록해준다.
export function ExcelTemplateModal({ versionId, onClose }: { versionId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white rounded-lg"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-slate-900">Data Template 설정</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg leading-none">
            ×
          </button>
        </div>
        <div className="p-5">
          <PlaceholderList versionId={versionId} />
          <ExcelTemplateSection versionId={versionId} type="doc" title="Doc Excel (문서 1건 출력)" />
          <ExcelTemplateSection versionId={versionId} type="list" title="List Excel (반복행 고정 슬롯 출력)" />
        </div>
      </div>
    </div>
  );
}

function PlaceholderList({ versionId }: { versionId: string }) {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/template-versions/${versionId}/excel-placeholders`)
      .then((r) => r.json())
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
      .then((d) => setPlaceholders(d.placeholders));
  }, [versionId]);

  function copy(key: string) {
    navigator.clipboard.writeText(`[${key}]`);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  }

  const regular = placeholders.filter((p) => !p.system);
  const system = placeholders.filter((p) => p.system);

  return (
    <section className="bg-white border border-slate-200 rounded-lg mb-6">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">① 사용 가능한 플레이스홀더</h3>
        <p className="text-xs text-slate-400 mt-0.5">고객 엑셀 셀에 그대로 붙여넣으세요. (List Excel은 반복행 [데이터키.NN]도 별도 지원)</p>
      </div>
      <div className="max-h-56 overflow-auto">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {[...regular, ...system].map((p) => (
              <tr key={p.dataKey}>
                <td className="px-4 py-2 text-slate-700">{p.label}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">[{p.dataKey}]</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => copy(p.dataKey)}
                    className="text-xs text-slate-500 border border-slate-200 rounded px-2 py-1 cursor-pointer hover:bg-slate-50"
                  >
                    {copied === p.dataKey ? "복사됨" : "복사"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// PRD_Excel_플레이스홀더_간단버전 §5 화면 목업: "Excel 파일을 끌어놓거나 선택하세요."
function Dropzone({ busy, onFile }: { busy: boolean; onFile: (file: File) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const inputId = "excel-template-file-input";

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
        dragOver ? "border-slate-500 bg-slate-50" : "border-slate-200"
      } ${busy ? "opacity-50 pointer-events-none" : ""}`}
    >
      <p className="text-sm text-slate-500">.xlsx 파일을 끌어놓거나 선택하세요.</p>
      <label
        htmlFor={inputId}
        className="inline-block mt-3 text-sm bg-slate-900 text-white rounded-md px-3.5 py-2 cursor-pointer hover:bg-slate-800"
      >
        {busy ? "검사 중…" : "파일 선택"}
      </label>
      <input
        id={inputId}
        type="file"
        accept=".xlsx"
        disabled={busy}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
    </div>
  );
}

function ExcelTemplateSection({ versionId, type, title }: { versionId: string; type: "doc" | "list"; title: string }) {
  const [meta, setMeta] = useState<ExcelTemplateMeta | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string; dataUri: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/template-versions/${versionId}/excel-template?type=${type}`);
    setMeta(res.ok ? await res.json() : null);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
  }, [versionId, type]);

  async function onFileSelected(file: File) {
    setBusy(true);
    setValidation(null);
    try {
      const buffer = await file.arrayBuffer();
      const fileDataUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${arrayBufferToBase64(buffer)}`;
      setPendingFile({ name: file.name, dataUri: fileDataUri });
      const res = await fetch(`/api/template-versions/${versionId}/excel-template/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, fileName: file.name, fileDataUri }),
      });
      const json = await res.json();
      setValidation(res.ok ? json : (json.validationResult ?? { status: "invalid", validPlaceholders: [], errors: [] }));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!pendingFile) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/template-versions/${versionId}/excel-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name: pendingFile.name, fileName: pendingFile.name, fileDataUri: pendingFile.dataUri }),
      });
      if (res.ok) {
        setPendingFile(null);
        setValidation(null);
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("템플릿을 삭제할까요?")) return;
    await fetch(`/api/template-versions/${versionId}/excel-template?type=${type}`, { method: "DELETE" });
    await refresh();
  }

  function download() {
    window.location.href = `/api/template-versions/${versionId}/excel-template/download?type=${type}`;
  }

  async function sample() {
    const res = await fetch(`/api/template-versions/${versionId}/excel-template/sample?type=${type}`, { method: "POST" });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sample_${meta?.fileName ?? "template.xlsx"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg mb-6">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            상태: {meta ? <span className="text-emerald-600 font-medium">사용 가능 ({meta.fileName})</span> : "미등록"}
          </p>
        </div>
        {meta && (
          <div className="flex gap-1.5">
            <button onClick={sample} className="text-xs border border-slate-300 rounded px-2.5 py-1.5 cursor-pointer hover:bg-slate-50">
              샘플 생성
            </button>
            <button onClick={download} className="text-xs border border-slate-300 rounded px-2.5 py-1.5 cursor-pointer hover:bg-slate-50">
              다운로드
            </button>
            <button onClick={remove} className="text-xs border border-red-200 text-red-600 rounded px-2.5 py-1.5 cursor-pointer hover:bg-red-50">
              삭제
            </button>
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <Dropzone busy={busy} onFile={onFileSelected} />

        {validation && (
          <div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-400">
                <tr>
                  <th className="px-2 py-1.5 font-medium">상태</th>
                  <th className="px-2 py-1.5 font-medium">플레이스홀더</th>
                  <th className="px-2 py-1.5 font-medium">위치</th>
                  <th className="px-2 py-1.5 font-medium">설명</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {validation.validPlaceholders.map((v, i) => (
                  <tr key={`v${i}`}>
                    <td className="px-2 py-1.5 text-emerald-600 font-medium">정상</td>
                    <td className="px-2 py-1.5 font-mono">[{v.key}]</td>
                    <td className="px-2 py-1.5 text-slate-500">
                      {v.sheet}!{v.cell}
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">사용 가능</td>
                  </tr>
                ))}
                {validation.errors.map((e, i) => (
                  <tr key={`e${i}`}>
                    <td className="px-2 py-1.5 text-red-600 font-medium">오류</td>
                    <td className="px-2 py-1.5 font-mono">[{e.key}]</td>
                    <td className="px-2 py-1.5 text-slate-500">
                      {e.sheet}!{e.cell}
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {e.code === "UNKNOWN_PLACEHOLDER" && (e.suggestedKey ? `없는 키 — [${e.suggestedKey}] 아닌가요?` : "없는 키")}
                      {e.code === "INVALID_PLACEHOLDER_SYNTAX" && "잘못된 문법"}
                      {e.code === "REPEAT_FIELD_NOT_SUPPORTED" && "지원하지 않는 반복행 문법"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={save}
              disabled={validation.status !== "valid" || busy}
              className="mt-3 text-sm bg-slate-900 text-white rounded-md px-3.5 py-2 cursor-pointer disabled:opacity-40 hover:bg-slate-800"
            >
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
