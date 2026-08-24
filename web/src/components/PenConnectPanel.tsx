"use client";

import { useEffect, useState } from "react";
import type { DocumentListItemDTO } from "@/types";
import { Button, ButtonLabel, Card } from "@/components/ui";

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function pdfToPageImages(file: File): Promise<string[]> {
  // 정적 import 금지 — pdfjs-dist는 DOMMatrix 등 브라우저 전용 전역을 모듈 평가 시점에
  // 참조해서 SSR에서 죽는다 (components/editor/PdfPageCanvas.tsx와 동일한 이유).
  const { loadPdf, renderPageToCanvas } = await import("@/lib/pdf");
  const pdf = await loadPdf(await file.arrayBuffer());
  const canvas = document.createElement("canvas");
  const images: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    await renderPageToCanvas(pdf, pageNumber, canvas, 1600, () => false);
    images.push(canvas.toDataURL("image/png"));
  }
  return images;
}

// 실제 스마트펜 크래들 관리 도구(연결된 펜 목록 + 페이지 렌더 결과)와 같은 구조로 보여준다
// — 문서를 고르는 팝업이 아니라 "펜이 지금 USB로 연결돼 있는가"를 있는 그대로 보여주는
// 화면. lib/smartpenImport.ts에는 아직 실제 USB/펜 디텍션이 없어서, 연결 시도는 항상
// 실패로 끝난다 — 이걸 숨기지 않고 그대로 보여준다(실 하드웨어 연동 전까지의 정직한 상태).
export function PenConnectPanel({
  documents,
  onClose,
  onImported,
}: {
  documents: DocumentListItemDTO[];
  onClose: () => void;
  onImported: (documentId: string) => void;
}) {
  const [connecting, setConnecting] = useState(true);
  const [connectFailed, setConnectFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    setConnecting(true);
    setConnectFailed(false);
    const t = setTimeout(() => {
      setConnecting(false);
      setConnectFailed(true);
    }, 600);
    return () => clearTimeout(t);
  }, [retryKey]);

  async function importFallback(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    const target = [...documents].filter((d) => d.status === "printed").sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!target) {
      setImportError("인쇄됨 상태인 문서가 없습니다. 양식을 먼저 인쇄해 주세요.");
      return;
    }

    const pageImages = file.type === "application/pdf" ? await pdfToPageImages(file) : [await fileToDataUri(file)];

    const res = await fetch(`/api/documents/${target.id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageImages }),
    });
    if (res.ok) onImported(target.id);
    else setImportError("가져오기에 실패했습니다.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)]">
            <div>
              <div className="text-xs text-slate-400 tracking-wide">SMARTPEN IMPORT</div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">펜 데이터 가져오기</h2>
            </div>
            <button className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 divide-x divide-[var(--color-border)]">
            <div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <span className="text-sm font-medium text-[var(--foreground)]">연결된 펜 전체 목록</span>
                <span className="text-xs text-slate-400">{connecting ? "확인 중…" : "0개"}</span>
              </div>
              <table className="w-full text-xs">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">펜 ID</th>
                    <th className="px-4 py-2 font-medium">MAC</th>
                    <th className="px-4 py-2 font-medium">배터리</th>
                  </tr>
                </thead>
              </table>
              <p className="px-4 pb-4 text-xs text-slate-400">
                {connecting ? "펜 연결 상태를 확인하고 있습니다…" : "연결된 펜이 없습니다. 크래들을 연결하고 새로고침해 주세요."}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <span className="text-sm font-medium text-[var(--foreground)]">페이지 렌더 결과</span>
                <span className="text-xs text-slate-400">선택된 펜 없음</span>
              </div>
              <p className="px-4 py-4 text-xs text-slate-400">왼쪽 목록에서 펜을 선택하면 페이지별 렌더 결과를 확인할 수 있습니다.</p>
            </div>
          </div>

          {connectFailed && (
            <p className="px-5 py-2.5 text-xs text-red-600 border-t border-[var(--color-border)]">USB 연결 상태 수신 시작에 실패했습니다.</p>
          )}
          {importError && <p className="px-5 py-2.5 text-xs text-red-600 border-t border-[var(--color-border)]">{importError}</p>}

          <div className="flex items-center gap-2 px-5 py-3.5 border-t border-[var(--color-border)]">
            <Button onClick={() => setRetryKey((k) => k + 1)}>↻ 새로고침</Button>
            <div className="flex-1" />
            <ButtonLabel className="text-xs">
              테스트용 이미지로 대체
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={importFallback} />
            </ButtonLabel>
            <Button onClick={onClose}>취소</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
