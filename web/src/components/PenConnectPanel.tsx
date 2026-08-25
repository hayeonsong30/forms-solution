"use client";

import { useEffect, useState } from "react";
import type { TemplateListItemDTO } from "@/types";
import { Button, ButtonLabel, Card } from "@/components/ui";
import { useLanguage, type Lang } from "@/lib/language";

const STRINGS = {
  ko: {
    importFailed: "가져오기에 실패했습니다.",
    title: "펜 데이터 가져오기",
    connectedPensList: "연결된 펜 전체 목록",
    checking: "확인 중…",
    countPens: (n: number) => `${n}개`,
    penId: "펜 ID",
    mac: "MAC",
    battery: "배터리",
    checkingStatus: "펜 연결 상태를 확인하고 있습니다…",
    noPensConnected: "연결된 펜이 없습니다. 크래들을 연결하고 새로고침해 주세요.",
    pageRenderResult: "페이지 렌더 결과",
    noPenSelected: "선택된 펜 없음",
    selectPenHint: "왼쪽 목록에서 펜을 선택하면 페이지별 렌더 결과를 확인할 수 있습니다.",
    usbConnectFailed: "USB 연결 상태 수신 시작에 실패했습니다.",
    refresh: "↻ 새로고침",
    testImageFallback: "테스트용 이미지로 대체",
    cancel: "취소",
    noPrintableTemplate: "인쇄 가능한 양식이 없습니다.",
  },
  ja: {
    importFailed: "取り込みに失敗しました。",
    title: "ペンデータの取り込み",
    connectedPensList: "接続されたペンの一覧",
    checking: "確認中…",
    countPens: (n: number) => `${n}個`,
    penId: "ペンID",
    mac: "MAC",
    battery: "バッテリー",
    checkingStatus: "ペンの接続状態を確認しています…",
    noPensConnected: "接続されたペンがありません。クレードルを接続して更新してください。",
    pageRenderResult: "ページレンダリング結果",
    noPenSelected: "選択されたペンなし",
    selectPenHint: "左の一覧からペンを選択すると、ページごとのレンダリング結果を確認できます。",
    usbConnectFailed: "USB接続状態の受信開始に失敗しました。",
    refresh: "↻ 更新",
    testImageFallback: "テスト用画像で代替",
    cancel: "キャンセル",
    noPrintableTemplate: "印刷可能な様式がありません。",
  },
} satisfies Record<Lang, unknown>;

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

// 실제 스마트펜 크래들 관리 도구(연결된 펜 목록 + 등록 대상 선택)와 같은 구조로 보여준다
// — 문서를 고르는 팝업이 아니라 "펜이 지금 USB로 연결돼 있는가"를 있는 그대로 보여주는
// 화면. lib/smartpenImport.ts에는 아직 실제 USB/펜 디텍션이 없어서, 연결 시도는 항상
// 실패로 끝난다 — 이걸 숨기지 않고 그대로 보여준다(실 하드웨어 연동 전까지의 정직한 상태).
// 2026-08-24: 페이지 렌더 이미지를 미리 보여주지 않는다 — USB로 펜 데이터가 들어오면
// (지금은 파일 대체) 미리보기 없이 바로 새 문서를 만들어 문서함에 등록한다.
export function PenConnectPanel({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (documentId: string) => void;
}) {
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const [connecting, setConnecting] = useState(true);
  const [connectFailed, setConnectFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateListItemDTO[]>([]);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((all: TemplateListItemDTO[]) => setTemplates(all.filter((t) => t.status === "printable")));
  }, []);

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
    // 실 펜 데이터는 SOBP로 양식을 알아서 찾지만, 지금은 하드웨어 연동 전 대체
    // 업로드라 화면에 고를 게 없다 — 가장 최근에 수정한 인쇄 가능 양식에 등록한다.
    const template = templates[0] ?? null;
    if (!template) {
      setImportError(s.noPrintableTemplate);
      return;
    }

    const pageImages = file.type === "application/pdf" ? await pdfToPageImages(file) : [await fileToDataUri(file)];

    const createRes = await fetch(`/api/templates/${template.id}/documents`, { method: "POST" });
    if (!createRes.ok) {
      setImportError(s.importFailed);
      return;
    }
    const created = await createRes.json();

    const res = await fetch(`/api/documents/${created.id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageImages }),
    });
    if (res.ok) onImported(created.id);
    else setImportError(s.importFailed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)]">
            <div>
              <div className="text-xs text-slate-400 tracking-wide">SMARTPEN IMPORT</div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">{s.title}</h2>
            </div>
            <button className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer" onClick={onClose}>
              ×
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <span className="text-sm font-medium text-[var(--foreground)]">{s.connectedPensList}</span>
              <span className="text-xs text-slate-400">{connecting ? s.checking : s.countPens(0)}</span>
            </div>
            <table className="w-full text-xs">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">{s.penId}</th>
                  <th className="px-4 py-2 font-medium">{s.mac}</th>
                  <th className="px-4 py-2 font-medium">{s.battery}</th>
                </tr>
              </thead>
            </table>
            <p className="px-4 pb-4 text-xs text-slate-400">
              {connecting ? s.checkingStatus : s.noPensConnected}
            </p>
          </div>

          {connectFailed && (
            <p className="px-5 py-2.5 text-xs text-red-600 border-t border-[var(--color-border)]">{s.usbConnectFailed}</p>
          )}
          {importError && <p className="px-5 py-2.5 text-xs text-red-600 border-t border-[var(--color-border)]">{importError}</p>}

          <div className="flex items-center gap-2 px-5 py-3.5 border-t border-[var(--color-border)]">
            <Button onClick={() => setRetryKey((k) => k + 1)}>{s.refresh}</Button>
            <div className="flex-1" />
            <ButtonLabel className="text-xs">
              {s.testImageFallback}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={importFallback} />
            </ButtonLabel>
            <Button onClick={onClose}>{s.cancel}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
