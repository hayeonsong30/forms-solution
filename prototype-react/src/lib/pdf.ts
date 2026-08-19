import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface RenderedPage {
  width: number
  height: number
  pageCount: number
}

// React StrictMode(개발 모드)는 effect를 두 번 연달아 실행한다. 첫 번째 실행의 cleanup은
// 이 함수의 첫 await(문서 로딩) 도중에 "동기적으로" 먼저 끝나버리므로, RenderTask를 나중에
// 넘겨받아 cancel()하는 방식은 타이밍에 따라 놓칠 수 있다(같은 canvas에 render()가 두 번
// 걸려 pdf.js가 예외를 던지는 원인). 그래서 매 await 이후 isCancelled()를 직접 확인해
// page.render() 호출 자체를 원천 차단한다 — 취소된 실행은 null을 반환한다.
export async function renderPdfPageToCanvas(
  source: File | string,
  canvas: HTMLCanvasElement,
  targetWidth: number,
  isCancelled: () => boolean = () => false
): Promise<RenderedPage | null> {
  const fontOptions = {
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
  }
  const loadingTask =
    typeof source === 'string'
      ? pdfjsLib.getDocument({ url: source, ...fontOptions })
      : pdfjsLib.getDocument({ data: await source.arrayBuffer(), ...fontOptions })

  const pdf = await loadingTask.promise
  if (isCancelled()) return null

  const page = await pdf.getPage(1)
  if (isCancelled()) return null

  const unscaled = page.getViewport({ scale: 1 })
  const scale = targetWidth / unscaled.width
  const viewport = page.getViewport({ scale })

  if (isCancelled()) return null
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport, canvas } as never).promise

  return { width: viewport.width, height: viewport.height, pageCount: pdf.numPages }
}
