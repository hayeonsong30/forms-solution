"use client";

import { useEffect, useState } from "react";
import { arrayBufferToBase64 } from "@/lib/base64";
import { useLanguage, type Lang } from "@/lib/language";

const STRINGS = {
  ko: {
    modalTitle: "Data Template 설정",
    dropHint: ".xlsx 파일을 끌어놓거나 선택하세요.",
    validating: "검사 중…",
    selectFile: "파일 선택",
    statusLabel: "상태: ",
    available: (fileName: string) => `사용 가능 (${fileName})`,
    unregistered: "미등록",
    validationFailed: (fileName: string) => `검증 실패 (${fileName})`,
    download: "다운로드",
    delete: "삭제",
    unknownPlaceholderSuggested: (key: string, suggestedKey: string) => `[${key}] 없는 키 — [${suggestedKey}] 아닌가요?`,
    unknownPlaceholder: (key: string) => `[${key}] 없는 키`,
    invalidSyntax: (key: string) => `[${key}] 잘못된 문법`,
    repeatFieldNotSupported: (key: string) => `[${key}] 지원하지 않는 반복행 문법`,
    confirmDelete: "템플릿을 삭제할까요?",
    removeAttempt: "✕",
  },
  ja: {
    modalTitle: "データテンプレート設定",
    dropHint: ".xlsxファイルをドラッグ＆ドロップするか選択してください。",
    validating: "検査中…",
    selectFile: "ファイル選択",
    statusLabel: "状態: ",
    available: (fileName: string) => `利用可能（${fileName}）`,
    unregistered: "未登録",
    validationFailed: (fileName: string) => `検証失敗（${fileName}）`,
    download: "ダウンロード",
    delete: "削除",
    unknownPlaceholderSuggested: (key: string, suggestedKey: string) => `[${key}] 存在しないキー — [${suggestedKey}] ではありませんか?`,
    unknownPlaceholder: (key: string) => `[${key}] 存在しないキー`,
    invalidSyntax: (key: string) => `[${key}] 不正な構文`,
    repeatFieldNotSupported: (key: string) => `[${key}] 対応していない繰り返し行の構文`,
    confirmDelete: "テンプレートを削除しますか?",
    removeAttempt: "✕",
  },
} satisfies Record<
  Lang,
  {
    modalTitle: string;
    dropHint: string;
    validating: string;
    selectFile: string;
    statusLabel: string;
    available: (fileName: string) => string;
    unregistered: string;
    validationFailed: (fileName: string) => string;
    download: string;
    delete: string;
    unknownPlaceholderSuggested: (key: string, suggestedKey: string) => string;
    unknownPlaceholder: (key: string) => string;
    invalidSyntax: (key: string) => string;
    repeatFieldNotSupported: (key: string) => string;
    confirmDelete: string;
    removeAttempt: string;
  }
>;

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
// (2026-08-26: 이전엔 Doc Excel/List Excel 두 섹션으로 나눴으나, 실제 DigiDox 레퍼런스는
// 두 용도 모두 같은 반복행 슬롯 문법을 동일하게 지원해 굳이 나눌 이유가 없었다 — 템플릿
// 1개로 통합하고, 검증은 그 안의 [데이터키]가 실제로 존재하는 키인지만 확인한다.)
export function ExcelTemplateModal({ versionId, onClose }: { versionId: string; onClose: () => void }) {
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-lg"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-slate-900">{s.modalTitle}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg leading-none">
            ×
          </button>
        </div>
        <div className="p-5">
          <ExcelTemplateSection versionId={versionId} />
        </div>
      </div>
    </div>
  );
}

// PRD_Excel_플레이스홀더_간단버전 §5 화면 목업: "Excel 파일을 끌어놓거나 선택하세요."
function Dropzone({ busy, onFile }: { busy: boolean; onFile: (file: File) => void }) {
  const { lang } = useLanguage();
  const s = STRINGS[lang];
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
      <p className="text-sm text-slate-500">{s.dropHint}</p>
      <label
        htmlFor={inputId}
        className="inline-block mt-3 text-sm bg-slate-900 text-white rounded-md px-3.5 py-2 cursor-pointer hover:bg-slate-800"
      >
        {busy ? s.validating : s.selectFile}
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

function ExcelTemplateSection({ versionId }: { versionId: string }) {
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const [meta, setMeta] = useState<ExcelTemplateMeta | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [attemptedFileName, setAttemptedFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/template-versions/${versionId}/excel-template`);
    setMeta(res.ok ? await res.json() : null);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
  }, [versionId]);

  // 검증 결과 표/플레이스홀더 목록 없이 업로드 한 번으로 끝낸다 — 통과하면 바로 저장하고,
  // 실패하면 오류만 간단히 보여준다(2026-08-25, 사용자 결정).
  async function onFileSelected(file: File) {
    setBusy(true);
    setValidation(null);
    setAttemptedFileName(null);
    try {
      const buffer = await file.arrayBuffer();
      const fileDataUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${arrayBufferToBase64(buffer)}`;
      const validateRes = await fetch(`/api/template-versions/${versionId}/excel-template/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileDataUri }),
      });
      const validateJson = await validateRes.json();
      const result: ValidationResult = validateRes.ok
        ? validateJson
        : (validateJson.validationResult ?? { status: "invalid", validPlaceholders: [], errors: [] });
      if (result.status !== "valid") {
        setValidation(result);
        setAttemptedFileName(file.name);
        return;
      }
      const saveRes = await fetch(`/api/template-versions/${versionId}/excel-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, fileName: file.name, fileDataUri }),
      });
      if (saveRes.ok) await refresh();
    } finally {
      setBusy(false);
    }
  }

  // 아직 아무것도 저장된 게 없는 실패 시도를 지우는 것뿐이라 확인 팝업 없이 즉시 초기화한다.
  function clearAttempt() {
    setValidation(null);
    setAttemptedFileName(null);
  }

  async function remove() {
    if (!window.confirm(s.confirmDelete)) return;
    await fetch(`/api/template-versions/${versionId}/excel-template`, { method: "DELETE" });
    await refresh();
  }

  function download() {
    window.location.href = `/api/template-versions/${versionId}/excel-template/download`;
  }

  const hasFailedAttempt = !meta && attemptedFileName !== null;

  return (
    <section className="bg-white border border-slate-200 rounded-lg">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          {s.statusLabel}
          {meta && <span className="text-emerald-600 font-medium">{s.available(meta.fileName)}</span>}
          {hasFailedAttempt && <span className="text-red-600 font-medium">{s.validationFailed(attemptedFileName!)}</span>}
          {!meta && !hasFailedAttempt && s.unregistered}
          {hasFailedAttempt && (
            <button
              onClick={clearAttempt}
              className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 cursor-pointer"
            >
              {s.removeAttempt}
            </button>
          )}
        </p>
        {meta && (
          <div className="flex gap-1.5">
            <button onClick={download} className="text-xs border border-slate-300 rounded px-2.5 py-1.5 cursor-pointer hover:bg-slate-50">
              {s.download}
            </button>
            <button onClick={remove} className="text-xs border border-red-200 text-red-600 rounded px-2.5 py-1.5 cursor-pointer hover:bg-red-50">
              {s.delete}
            </button>
          </div>
        )}
      </div>
      {/* 등록된 상태에서는 드롭존을 숨긴다 — 새 파일로 바꾸려면 먼저 삭제해야 한다(2026-08-26 결정). */}
      {!meta && (
        <div className="p-4 space-y-3">
          <Dropzone busy={busy} onFile={onFileSelected} />

          {validation && validation.errors.length > 0 && (
            <ul className="text-xs text-red-600 space-y-1 list-disc pl-4">
              {validation.errors.map((e, i) => (
                <li key={i}>
                  {e.code === "UNKNOWN_PLACEHOLDER" &&
                    (e.suggestedKey ? s.unknownPlaceholderSuggested(e.key, e.suggestedKey) : s.unknownPlaceholder(e.key))}
                  {e.code === "INVALID_PLACEHOLDER_SYNTAX" && s.invalidSyntax(e.key)}
                  {e.code === "REPEAT_FIELD_NOT_SUPPORTED" && s.repeatFieldNotSupported(e.key)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
