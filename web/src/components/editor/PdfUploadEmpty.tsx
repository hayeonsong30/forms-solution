"use client";

import { useState } from "react";

export function PdfUploadEmpty({ onUpload }: { onUpload: (file: File) => void }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-100">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onUpload(file);
        }}
        className={`w-[420px] rounded-xl border-2 border-dashed text-center px-8 py-12 ${
          dragOver ? "border-[var(--color-brand-500)] bg-[var(--color-brand-50)]" : "border-slate-300 bg-white"
        }`}
      >
        <div className="text-3xl mb-3">📄</div>
        <h2 className="font-medium mb-1">빈 양식 PDF를 업로드하세요</h2>
        <p className="text-sm text-slate-400 mb-4">PDF를 이 영역으로 끌어다 놓거나 파일을 선택하세요. 최대 20MB.</p>
        <label className="inline-flex items-center rounded-lg bg-[var(--color-brand-600)] text-white text-sm font-medium px-4 py-2 cursor-pointer hover:bg-[var(--color-brand-700)]">
          PDF 파일 선택
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-[11px] text-slate-400 mt-4">PDF가 업로드되기 전까지 필드 추가와 AI 자동 추천은 사용할 수 없습니다.</p>
      </div>
    </div>
  );
}
