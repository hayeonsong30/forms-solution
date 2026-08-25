"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PdfPageCanvas } from "@/components/editor/PdfPageCanvas";
import { useLanguage, type Lang } from "@/lib/language";

type CheckConfig = { outputMode?: "boolean" | "symbol"; trueMarks?: string[] };
type Box = { boxX: number; boxY: number; boxW: number; boxH: number; type: string; config?: { check?: CheckConfig } };
type FieldValueItem = {
  finalValue: string | null;
  rowIndex: number | null;
  field: (Box & { dataKey: string }) | null;
  repeatColumn: (Box & { dataKey: string; repeatGroupId: string }) | null;
};

// 체크 필드는 두 가지 표시 방식이 있다: symbol 모드는 실제로 손으로 쓴 기호(V·O·X 등)가
// finalValue에 그대로 들어있어 그대로 보여주고, boolean 모드는 true/false를 필드에 설정된
// true 기호(trueMarks[0])로 바꿔 보여준다(false는 빈칸).
function displayText(box: Box, finalValue: string | null): string {
  if (box.type !== "check") return finalValue ?? "";
  if (box.config?.check?.outputMode === "symbol") return finalValue ?? "";
  return finalValue === "true" ? (box.config?.check?.trueMarks?.[0] ?? "V") : "";
}
type DocumentDetail = {
  id: string;
  ncode: string | null;
  status: string;
  createdAt: string;
  receivedAt: string | null;
  confirmedAt: string | null;
  pageImageCount: number;
  templateVersion: { pageCount: number; template: { id: string; name: string } };
  fieldValues: FieldValueItem[];
};
type RepeatGroupMeta = { id: string; rowHeight: number };

const STRINGS = {
  ko: {
    status: {
      printed: "인쇄됨",
      received: "필기 수신",
      processing: "처리 중",
      review_required: "검수 필요",
      confirmed: "확정",
      error: "오류",
    } as Record<string, string>,
    backToList: "← 문서 조회",
    pdf: "PDF",
    excel: "Excel",
    listExcel: "List Excel",
    textView: "텍스트 변환 보기",
    textViewTooltip: "켜면 손글씨를 인식해 빈 양식 위에 컴퓨터 텍스트로 채워 보여줍니다",
    recognizing: "필기 인식 중… (실제 OCR 실행)",
    recognizeFailed: "필기 인식에 실패했습니다.",
    loading: "불러오는 중…",
    noPageImage: "아직 업로드된 필기 이미지가 없습니다.",
    pageImageAlt: "문서 페이지",
    docInfo: "문서 정보",
    info: {
      status: "상태",
      form: "양식",
      docNo: "문서번호",
      pageCount: "페이지 수",
      registeredAt: "등록일시",
      confirmedAt: "확정일시",
    },
    none: "-",
  },
  ja: {
    status: {
      printed: "印刷済み",
      received: "筆記受信",
      processing: "処理中",
      review_required: "確認必要",
      confirmed: "確定",
      error: "エラー",
    } as Record<string, string>,
    backToList: "← 文書照会",
    pdf: "PDF",
    excel: "Excel",
    listExcel: "List Excel",
    textView: "テキスト変換表示",
    textViewTooltip: "オンにすると手書き文字を認識し、空の様式にコンピューターフォントで反映して表示します",
    recognizing: "筆記認識中…（実際にOCRを実行）",
    recognizeFailed: "筆記認識に失敗しました。",
    loading: "読み込み中…",
    noPageImage: "まだアップロードされた筆記画像がありません。",
    pageImageAlt: "文書ページ",
    docInfo: "文書情報",
    info: {
      status: "状態",
      form: "様式",
      docNo: "文書番号",
      pageCount: "ページ数",
      registeredAt: "登録日時",
      confirmedAt: "確定日時",
    },
    none: "-",
  },
} satisfies Record<
  Lang,
  {
    status: Record<string, string>;
    backToList: string;
    pdf: string;
    excel: string;
    listExcel: string;
    textView: string;
    textViewTooltip: string;
    recognizing: string;
    recognizeFailed: string;
    loading: string;
    noPageImage: string;
    pageImageAlt: string;
    docInfo: string;
    info: { status: string; form: string; docNo: string; pageCount: string; registeredAt: string; confirmedAt: string };
    none: string;
  }
>;

// PRD 요청: 문서 조회 상세는 필드별 검수 화면 없이 페이지 이미지 + 기본 정보만 간략히 보여준다.
// "텍스트 변환 보기" (DigiDox 참고): 손글씨 스캔 이미지 대신, 빈 원본 양식 위에 인식된
// 값을 컴퓨터 글꼴 텍스트로 채워 넣은 화면으로 전환한다 — 이미지 위에 겹쳐 보여주는 게
// 아니라 손글씨 자체를 텍스트로 "바꿔서" 보여주는 것.
export default function SimpleDocumentDetailPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = use(params);
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [hasListTemplate, setHasListTemplate] = useState(false);
  const [repeatGroups, setRepeatGroups] = useState<RepeatGroupMeta[]>([]);
  const [textView, setTextView] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeError, setRecognizeError] = useState<string | null>(null);
  const [blankPdfBuffer, setBlankPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(600);

  useEffect(() => {
    fetch(`/api/documents/${documentId}`)
      .then((r) => r.json())
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
      .then(setDoc);
  }, [documentId]);

  useEffect(() => {
    if (!doc) return;
    fetch(`/api/templates/${doc.templateVersion.template.id}`)
      .then((r) => r.json())
      .then((detail) => {
        setRepeatGroups(detail.repeatGroups.map((g: RepeatGroupMeta) => ({ id: g.id, rowHeight: g.rowHeight })));
        return fetch(`/api/template-versions/${detail.version.id}/excel-template?type=list`);
      })
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derives from doc after it loads
      .then((r) => setHasListTemplate(r.ok));
  }, [doc]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setPreviewWidth(Math.max(320, width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 텍스트 변환 보기: 켜면 빈 원본 PDF를 불러오고(1회), 아직 실제 인식을 돌린 적 없는
  // 문서(received)라면 그 자리에서 진짜 OCR을 실행해 손글씨를 텍스트로 추출한다.
  async function toggleTextView() {
    if (!doc) return;
    const next = !textView;
    setTextView(next);
    if (!next) return;

    if (!blankPdfBuffer) {
      const buf = await fetch(`/api/templates/${doc.templateVersion.template.id}/pdf`).then((r) => r.arrayBuffer());
      setBlankPdfBuffer(buf);
    }
    if (doc.status !== "received") return;
    setRecognizing(true);
    setRecognizeError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/process`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setRecognizeError(json.message ?? s.recognizeFailed);
        return;
      }
      const refreshed = await fetch(`/api/documents/${documentId}`).then((r) => r.json());
      setDoc(refreshed);
    } finally {
      setRecognizing(false);
    }
  }

  if (!doc) return <div className="p-8 text-sm text-slate-400">{s.loading}</div>;

  const confirmed = doc.status === "confirmed";
  const rowHeightByGroup = new Map(repeatGroups.map((g) => [g.id, g.rowHeight]));
  const textEntries = doc.fieldValues.filter((v) => v.finalValue !== null && v.finalValue !== "");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/simple/documents" className="text-xs text-slate-400 hover:underline">
        {s.backToList}
      </Link>

      <div className="flex items-start justify-between mt-1 mb-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{doc.templateVersion.template.name}</h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{doc.ncode}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href={`/api/templates/${doc.templateVersion.template.id}/pdf`}
            className="text-sm border border-slate-300 rounded-md px-3.5 py-2 hover:bg-slate-50"
          >
            {s.pdf}
          </a>
          <a
            href={confirmed ? `/api/documents/${doc.id}/export/customer-xlsx?type=doc` : undefined}
            aria-disabled={!confirmed}
            className={`text-sm border rounded-md px-3.5 py-2 ${
              confirmed ? "border-slate-300 hover:bg-slate-50" : "border-slate-200 text-slate-300 pointer-events-none"
            }`}
          >
            {s.excel}
          </a>
          {hasListTemplate && (
            <a
              href={confirmed ? `/api/documents/${doc.id}/export/customer-xlsx?type=list` : undefined}
              aria-disabled={!confirmed}
              className={`text-sm border rounded-md px-3.5 py-2 ${
                confirmed ? "border-slate-300 hover:bg-slate-50" : "border-slate-200 text-slate-300 pointer-events-none"
              }`}
            >
              {s.listExcel}
            </a>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none ml-2">
            {s.textView}
            <button
              type="button"
              onClick={toggleTextView}
              disabled={recognizing}
              title={s.textViewTooltip}
              className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                textView ? "bg-slate-900" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                  textView ? "translate-x-4.5" : ""
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {recognizing && <p className="text-xs text-slate-500 mb-2">{s.recognizing}</p>}
      {recognizeError && <p className="text-xs text-red-600 mb-2">{recognizeError}</p>}

      <div className="grid grid-cols-[1fr_320px] gap-6">
        <div ref={previewRef} className="bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center min-h-[400px]">
          {textView ? (
            blankPdfBuffer ? (
              <div className="relative w-full" style={canvasSize.height ? { height: canvasSize.height } : undefined}>
                <PdfPageCanvas pdfBuffer={blankPdfBuffer} pageNo={1} width={previewWidth} onSize={setCanvasSize} />
                {textEntries.map((v, i) => {
                  const box = v.field ?? v.repeatColumn;
                  if (!box) return null;
                  const text = displayText(box, v.finalValue);
                  if (!text) return null;
                  const rowHeight = v.repeatColumn ? (rowHeightByGroup.get(v.repeatColumn.repeatGroupId) ?? 0) : 0;
                  const y = box.boxY + (v.rowIndex ?? 0) * rowHeight;
                  return (
                    <div
                      key={i}
                      className={`absolute flex items-center overflow-hidden bg-white/70 text-slate-900 leading-tight ${
                        box.type === "check" ? "justify-center text-[13px] font-semibold" : "px-0.5 text-[11px]"
                      }`}
                      style={{
                        left: `${box.boxX * 100}%`,
                        top: `${y * 100}%`,
                        width: `${box.boxW * 100}%`,
                        height: `${box.boxH * 100}%`,
                      }}
                    >
                      {text}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-sm text-slate-300">{s.loading}</span>
            )
          ) : doc.pageImageCount > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/documents/${doc.id}/page-image/0`} alt={s.pageImageAlt} className="w-full block" />
          ) : (
            <span className="text-sm text-slate-300">{s.noPageImage}</span>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 h-fit">
          <h2 className="text-sm font-semibold text-slate-900">{s.docInfo}</h2>
          <InfoRow label={s.info.status} value={s.status[doc.status] ?? doc.status} />
          <InfoRow label={s.info.form} value={doc.templateVersion.template.name} />
          <InfoRow label={s.info.docNo} value={doc.ncode ?? s.none} />
          <InfoRow label={s.info.pageCount} value={String(doc.templateVersion.pageCount)} />
          <InfoRow label={s.info.registeredAt} value={new Date(doc.createdAt).toLocaleString(lang === "ja" ? "ja-JP" : "ko-KR")} />
          {doc.confirmedAt && <InfoRow label={s.info.confirmedAt} value={new Date(doc.confirmedAt).toLocaleString(lang === "ja" ? "ja-JP" : "ko-KR")} />}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-700 text-right">{value}</span>
    </div>
  );
}
