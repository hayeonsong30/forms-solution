"use client";

// pdf.js 클라이언트 래퍼. 두 가지 알려진 함정을 반드시 지킨다 (메모리 기록 참고):
// 1. cMapUrl/standardFontDataUrl을 명시하지 않으면 일본어/한국어 텍스트가 빈 화면으로 렌더된다
//    (벡터 도형은 정상 렌더되어 버그를 놓치기 쉽다).
// 2. React StrictMode가 effect를 두 번 실행해 같은 <canvas>에 page.render()가 동시에 걸리면
//    pdf.js가 예외를 던지고 이후 렌더가 조용히 멈춘다. render 직전마다 isCancelled를 확인한다.
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

const CMAP_URL = "/pdfjs/cmaps/";
const STANDARD_FONT_DATA_URL = "/pdfjs/standard_fonts/";

export async function loadPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const task = pdfjsLib.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });
  return task.promise;
}

export async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  targetWidth: number,
  isCancelled: () => boolean
): Promise<{ width: number; height: number } | null> {
  const page = await pdf.getPage(pageNumber);
  if (isCancelled()) return null;

  const unscaledViewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  const context = canvas.getContext("2d");
  if (!context) return null;
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  if (isCancelled()) return null;
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  if (isCancelled()) return null;

  return { width: viewport.width, height: viewport.height };
}
