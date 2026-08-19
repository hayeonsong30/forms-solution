"use client";

import { use, useCallback, useEffect, useState } from "react";
import type { DocumentDetailDTO, DocumentStatus } from "@/types";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  printed: "인쇄됨",
  received: "필기 수신",
  processing: "처리 중",
  review_required: "검수 필요",
  confirmed: "확정",
  error: "오류",
};

export default function DocumentDetailPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = use(params);
  const [doc, setDoc] = useState<DocumentDetailDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [showReopen, setShowReopen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}`);
    if (res.ok) setDoc(await res.json());
  }, [documentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function runAction(path: string, body?: Record<string, unknown>) {
    setActionError(null);
    setBusy(path);
    try {
      const res = await fetch(`/api/documents/${documentId}/${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(describeError(json));
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      runAction("import", { pageImages: [dataUri] });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function saveFinalValue(fieldValueId: string, finalValue: string) {
    await fetch(`/api/documents/${documentId}/field-values/${fieldValueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finalValue: finalValue || null }),
    });
    await load();
  }

  if (!doc) return <main className="p-8 text-sm text-gray-500">불러오는 중…</main>;

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{doc.templateVersion.template.name}</h1>
        <p className="text-sm text-gray-500">
          {doc.ncode} · 상태: <span className="font-medium">{STATUS_LABEL[doc.status]}</span>
        </p>
      </div>

      {actionError && <div className="bg-red-50 border border-red-200 rounded px-4 py-2 text-sm text-red-700">{actionError}</div>}

      <div className="flex gap-2 items-center">
        {doc.status === "printed" && (
          <label className="text-sm bg-blue-600 text-white rounded px-3 py-1 cursor-pointer">
            필기 이미지 업로드 (SDK 연동 전 — 파일 직접 선택)
            <input type="file" accept="image/*" className="hidden" onChange={importFile} disabled={busy !== null} />
          </label>
        )}
        {(doc.status === "received" || doc.status === "error") && (
          <button
            className="text-sm bg-blue-600 text-white rounded px-3 py-1 disabled:opacity-50"
            onClick={() => runAction("process")}
            disabled={busy !== null}
          >
            {busy === "process" ? "AI 처리 중… (최대 2분)" : "처리 실행 (Gemini OCR)"}
          </button>
        )}
        {doc.status === "review_required" && (
          <button
            className="text-sm bg-blue-600 text-white rounded px-3 py-1 disabled:opacity-50"
            onClick={() => runAction("confirm")}
            disabled={busy !== null}
          >
            확정
          </button>
        )}
        {doc.status === "confirmed" && (
          <button className="text-sm border rounded px-3 py-1" onClick={() => setShowReopen(true)}>
            재검수 열기
          </button>
        )}
        {busy === "import" && <span className="text-xs text-gray-500">업로드 중…</span>}
      </div>

      {showReopen && (
        <div className="border rounded p-4 space-y-2">
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="재검수 사유"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="text-sm bg-blue-600 text-white rounded px-3 py-1"
              onClick={async () => {
                if (!reopenReason.trim()) return;
                await runAction("reopen", { reason: reopenReason });
                setShowReopen(false);
                setReopenReason("");
              }}
            >
              확인
            </button>
            <button className="text-sm border rounded px-3 py-1" onClick={() => setShowReopen(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {doc.fieldValues.length > 0 && (
        <table className="w-full text-sm border rounded overflow-hidden">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2">필드</th>
              <th className="px-3 py-2">원본 인식값</th>
              <th className="px-3 py-2">최종값</th>
              <th className="px-3 py-2">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {doc.fieldValues.map((v) => (
              <FieldValueRow key={v.id} value={v} onSave={saveFinalValue} />
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function FieldValueRow({
  value,
  onSave,
}: {
  value: DocumentDetailDTO["fieldValues"][number];
  onSave: (id: string, finalValue: string) => void;
}) {
  const [local, setLocal] = useState(value.finalValue ?? "");
  const source = value.field ?? value.repeatColumn;
  const label = source ? `${source.label}${value.rowIndex !== null ? ` [${value.rowIndex}]` : ""}` : "-";

  return (
    <tr>
      <td className="px-3 py-2">{label}</td>
      <td className="px-3 py-2 text-gray-500">{value.rawOcrValue ?? "—"}</td>
      <td className="px-3 py-2">
        <input
          className="border rounded px-2 py-1 w-full"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onSave(value.id, local)}
        />
      </td>
      <td className="px-3 py-2">
        <span
          className={`text-xs rounded px-2 py-0.5 ${
            value.reviewStatus === "needs_review" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
          }`}
        >
          {value.reviewStatus === "needs_review" ? "확인 필요" : "확인됨"}
        </span>
      </td>
    </tr>
  );
}

function describeError(json: { error?: string }): string {
  if (json.error === "INVALID_TRANSITION") return "지금 상태에서는 이 동작을 할 수 없습니다.";
  if (json.error === "VALIDATION_FAILED") return "확인이 필요한 값이 남아 있어 확정할 수 없습니다.";
  return "작업을 처리하지 못했습니다.";
}
