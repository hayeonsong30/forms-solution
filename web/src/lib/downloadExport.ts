"use client";

export async function downloadExport(kind: "csv" | "excel", documentIds: string[]): Promise<string | null> {
  const res = await fetch(`/api/exports/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentIds }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    if (json?.error === "NOT_CONFIRMED") return "확정되지 않은 문서는 내려받을 수 없습니다.";
    return "다운로드에 실패했습니다.";
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const ext = kind === "csv" ? "csv" : "xlsx";
  const a = document.createElement("a");
  a.href = url;
  a.download = `export-${Date.now()}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
  return null;
}
