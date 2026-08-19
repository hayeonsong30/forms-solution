"use client";

import { useEffect, useRef } from "react";

export function PdfPageCanvas({
  pdfBuffer,
  pageNo,
  width,
  onSize,
}: {
  pdfBuffer: ArrayBuffer;
  pageNo: number;
  width: number;
  onSize: (size: { width: number; height: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    // pdf.js는 같은 <canvas>에 render()가 두 번 겹치면 예외를 던지고 이후 렌더가 멈춘다
    // (React StrictMode가 effect를 두 번 실행할 때 실제로 재현됨) — 매 await 지점마다 확인한다.
    async function run() {
      // pdfjs-dist는 브라우저 전용 전역(DOMMatrix 등)을 모듈 평가 시점에 참조하므로
      // 정적 import를 쓰면 Next.js SSR에서 그대로 죽는다 — 클라이언트에서만 동적 로드한다.
      const { loadPdf, renderPageToCanvas } = await import("@/lib/pdf");
      const buffer = pdfBuffer.slice(0); // pdf.js가 buffer 소유권을 가져가 detach시키므로 복사본을 넘긴다
      const pdf = await loadPdf(buffer);
      if (cancelled || !canvasRef.current) return;
      const size = await renderPageToCanvas(pdf, pageNo, canvasRef.current, width, () => cancelled);
      if (size && !cancelled) onSize(size);
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSize is stable enough for this canvas's lifetime
  }, [pdfBuffer, pageNo, width]);

  return <canvas ref={canvasRef} className="block" />;
}
