"use client";

import { use, useCallback, useEffect, useState } from "react";
import type { DocumentDetailDTO, DocumentStatus, FieldType } from "@/types";
import { downloadExport } from "@/lib/downloadExport";
import { Badge, Button, ButtonLabel, Card, Input, PageHeader, Select } from "@/components/ui";

const STATUS: Record<DocumentStatus, { label: string; tone: "amber" | "green" | "slate" | "red" | "brand" }> = {
  printed: { label: "인쇄됨", tone: "slate" },
  received: { label: "필기 수신", tone: "slate" },
  processing: { label: "처리 중", tone: "brand" },
  review_required: { label: "검수 필요", tone: "amber" },
  confirmed: { label: "확정", tone: "green" },
  error: { label: "오류", tone: "red" },
};

const REASON_LABEL: Record<string, string> = {
  required_missing: "필수값 누락",
  type_mismatch: "형식 오류",
  number_out_of_range: "숫자 범위 초과",
  invalid_date: "날짜 형식 오류",
  invalid_time: "시간 형식 오류",
  unknown_choice: "정의되지 않은 선택지",
  choice_conflict: "교차 검증 충돌",
  manual_review_requested: "AI 인식 없음 — 직접 확인 필요",
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

  async function saveFinalValue(fieldValueId: string, finalValue: string | null) {
    await fetch(`/api/documents/${documentId}/field-values/${fieldValueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finalValue }),
    });
    await load();
  }

  if (!doc) return <div className="p-8 text-sm text-slate-400">불러오는 중…</div>;

  const status = STATUS[doc.status];
  const unresolvedCount = doc.fieldValues.filter((v) => v.reviewStatus === "needs_review").length;

  return (
    <div className="mx-auto max-w-4xl px-8 py-8 space-y-6">
      <PageHeader
        title={doc.templateVersion.template.name}
        actions={
          <>
            {doc.status === "printed" && (
              <ButtonLabel variant="primary">
                필기 이미지 업로드
                <input type="file" accept="image/*" className="hidden" onChange={importFile} disabled={busy !== null} />
              </ButtonLabel>
            )}
            {(doc.status === "received" || doc.status === "error") && (
              <Button variant="primary" onClick={() => runAction("process")} disabled={busy !== null}>
                {busy === "process" ? "AI 처리 중… (최대 2분)" : "처리 실행 (Gemini OCR)"}
              </Button>
            )}
            {doc.status === "review_required" && (
              <Button variant="primary" onClick={() => runAction("confirm")} disabled={busy !== null}>
                확정
              </Button>
            )}
            {doc.status === "confirmed" && (
              <>
                <Button onClick={() => setShowReopen(true)}>재검수 열기</Button>
                <Button
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy("export-csv");
                    const err = await downloadExport("csv", [documentId]);
                    if (err) setActionError(err);
                    setBusy(null);
                  }}
                >
                  CSV 다운로드
                </Button>
                <Button
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy("export-excel");
                    const err = await downloadExport("excel", [documentId]);
                    if (err) setActionError(err);
                    setBusy(null);
                  }}
                >
                  Excel 다운로드
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="flex items-center gap-2 -mt-4">
        <span className="text-xs text-slate-400 font-mono">{doc.ncode}</span>
        <Badge tone={status.tone}>{status.label}</Badge>
        {doc.status === "review_required" && unresolvedCount > 0 && (
          <span className="text-xs text-[var(--color-status-amber-fg)]">확인 필요 {unresolvedCount}건</span>
        )}
      </div>

      {actionError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{actionError}</p>}

      {showReopen && (
        <Card className="p-4 space-y-2">
          <Input
            className="w-full"
            placeholder="재검수 사유"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={async () => {
                if (!reopenReason.trim()) return;
                await runAction("reopen", { reason: reopenReason });
                setShowReopen(false);
                setReopenReason("");
              }}
            >
              확인
            </Button>
            <Button onClick={() => setShowReopen(false)}>취소</Button>
          </div>
        </Card>
      )}

      {doc.fieldValues.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">필드</th>
                <th className="px-4 py-2.5 font-medium">원본 인식값</th>
                <th className="px-4 py-2.5 font-medium">정규화값</th>
                <th className="px-4 py-2.5 font-medium">최종값</th>
                <th className="px-4 py-2.5 font-medium">상태 / 사유</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {doc.fieldValues.map((v) => (
                <FieldValueRow key={v.id} value={v} onSave={saveFinalValue} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function FieldValueRow({
  value,
  onSave,
}: {
  value: DocumentDetailDTO["fieldValues"][number];
  onSave: (id: string, finalValue: string | null) => void;
}) {
  const [local, setLocal] = useState(value.finalValue ?? "");
  const source = value.field ?? value.repeatColumn;
  const type: FieldType = source?.type ?? "text";
  const label = source ? `${source.label}${value.rowIndex !== null ? ` [행 ${value.rowIndex + 1}]` : ""}` : "-";

  return (
    <tr className={value.reviewStatus === "needs_review" ? "bg-[var(--color-status-amber-bg)]/40" : undefined}>
      <td className="px-4 py-2.5">
        {label}
        {source?.required && <span className="text-red-500"> *</span>}
      </td>
      <td className="px-4 py-2.5 text-slate-400">{value.rawOcrValue ?? "—"}</td>
      <td className="px-4 py-2.5 text-slate-400">{value.normalizedValue ?? "—"}</td>
      <td className="px-4 py-2.5">
        {type === "check" ? (
          <Select
            className="w-full"
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              onSave(value.id, e.target.value || null);
            }}
          >
            <option value="">(미기재)</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </Select>
        ) : type === "date" ? (
          <Input
            type="date"
            className="w-full"
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              onSave(value.id, e.target.value || null);
            }}
          />
        ) : type === "time" ? (
          <Input
            type="time"
            className="w-full"
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              onSave(value.id, e.target.value || null);
            }}
          />
        ) : type === "choice" ? (
          <ChoiceValueInput
            options={source?.config.choice?.options ?? []}
            mode={source?.config.choice?.mode ?? "single"}
            value={local}
            onChange={(v) => {
              setLocal(v);
              onSave(value.id, v || null);
            }}
          />
        ) : (
          <Input
            className="w-full"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => onSave(value.id, local || null)}
          />
        )}
      </td>
      <td className="px-4 py-2.5">
        <Badge tone={value.reviewStatus === "needs_review" ? "amber" : "green"}>
          {value.reviewStatus === "needs_review" ? "확인 필요" : "확인됨"}
        </Badge>
        {value.reviewReasons.length > 0 && (
          <div className="text-[11px] text-[var(--color-status-amber-fg)] mt-1">
            {value.reviewReasons.map((r) => REASON_LABEL[r] ?? r).join(", ")}
          </div>
        )}
      </td>
    </tr>
  );
}

function ChoiceValueInput({
  options,
  mode,
  value,
  onChange,
}: {
  options: string[];
  mode: "single" | "multiple";
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = value ? value.split(",").map((s) => s.trim()) : [];
  if (mode === "single") {
    return (
      <Select className="w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">(미기재)</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={selected.includes(o)}
            onChange={(e) => {
              const next = e.target.checked ? [...selected, o] : selected.filter((s) => s !== o);
              onChange(next.join(", "));
            }}
          />
          {o}
        </label>
      ))}
      {options.length === 0 && <span className="text-xs text-slate-400">선택지가 정의되지 않았습니다.</span>}
    </div>
  );
}

function describeError(json: { error?: string }): string {
  if (json.error === "INVALID_TRANSITION") return "지금 상태에서는 이 동작을 할 수 없습니다.";
  if (json.error === "VALIDATION_FAILED") return "확인이 필요한 값이 남아 있어 확정할 수 없습니다. 아래 표에서 강조된 항목을 채우세요.";
  return "작업을 처리하지 못했습니다.";
}
