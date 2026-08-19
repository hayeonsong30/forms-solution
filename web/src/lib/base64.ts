// pdfjs-dist(브라우저 전용 전역을 모듈 평가 시점에 참조)와 분리된 순수 base64 헬퍼.
// lib/pdf.ts를 정적 import하면 SSR에서 죽으므로, 이 파일은 어디서든 정적으로 import해도 안전하다.
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
