"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TemplateListItemDTO } from "@/types";
import { arrayBufferToBase64 } from "@/lib/base64";
import { useLanguage, type Lang } from "@/lib/language";

type Org = { id: string; name: string };

const STRINGS = {
  ko: {
    title: "양식 관리",
    register: "+ 양식 등록",
    table: { form: "양식명", status: "상태", registeredAt: "등록일" },
    statusDraft: "편집 중",
    statusPrintable: "인쇄 가능",
    empty: "등록된 양식이 없습니다.",
    dialog: {
      title: "양식 등록",
      nameLabel: "양식명",
      namePlaceholder: "예: 시설 이용 신청서",
      pdfLabel: "원본 PDF",
      error: "양식 등록에 실패했습니다.",
      cancel: "취소",
      submit: "등록",
      submitting: "등록 중…",
    },
  },
  ja: {
    title: "様式管理",
    register: "+ 様式登録",
    table: { form: "様式名", status: "状態", registeredAt: "登録日" },
    statusDraft: "編集中",
    statusPrintable: "印刷可能",
    empty: "登録された様式がありません。",
    dialog: {
      title: "様式登録",
      nameLabel: "様式名",
      namePlaceholder: "例：施設利用申請書",
      pdfLabel: "元のPDF",
      error: "様式の登録に失敗しました。",
      cancel: "キャンセル",
      submit: "登録",
      submitting: "登録中…",
    },
  },
} satisfies Record<
  Lang,
  {
    title: string;
    register: string;
    table: { form: string; status: string; registeredAt: string };
    statusDraft: string;
    statusPrintable: string;
    empty: string;
    dialog: {
      title: string;
      nameLabel: string;
      namePlaceholder: string;
      pdfLabel: string;
      error: string;
      cancel: string;
      submit: string;
      submitting: string;
    };
  }
>;

// PRD_Excel_플레이스홀더_간단버전 §4: 양식 관리 목록 → 행 클릭 시 양식 상세(설정) 화면으로 이동.
// DigiDox 참고 화면처럼 한 화면에서 이름/PDF/Excel 서식까지 다 등록하는 대신, 간단 버전은
// "이름 + PDF"만 먼저 만들고 나머지(필드/Excel 서식)는 상세 화면에서 채운다.
export default function SimpleFormsPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const [templates, setTemplates] = useState<TemplateListItemDTO[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [registerOpen, setRegisterOpen] = useState(false);

  async function refresh() {
    const [t, o] = await Promise.all([
      fetch("/api/templates").then((r) => r.json()),
      fetch("/api/orgs").then((r) => r.json()),
    ]);
    setTemplates(t);
    setOrgs(o);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-slate-900">{s.title}</h1>
        <button
          onClick={() => setRegisterOpen(true)}
          className="text-sm bg-slate-900 text-white rounded-md px-3.5 py-2 cursor-pointer hover:bg-slate-800"
        >
          {s.register}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">{s.table.form}</th>
              <th className="px-4 py-2.5 font-medium">{s.table.status}</th>
              <th className="px-4 py-2.5 font-medium">{s.table.registeredAt}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {templates.map((t) => (
              <tr
                key={t.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => router.push(`/simple/forms/${t.id}`)}
              >
                <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                <td className="px-4 py-3">
                  {t.status === "draft" ? (
                    <span className="text-xs text-slate-500">{s.statusDraft}</span>
                  ) : (
                    <span className="text-xs text-emerald-600 font-medium">{s.statusPrintable}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{new Date(t.createdAt).toLocaleDateString(lang === "ja" ? "ja-JP" : "ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-400">{s.empty}</div>}
      </div>

      {registerOpen && (
        <RegisterFormDialog
          orgs={orgs}
          s={s.dialog}
          onCancel={() => setRegisterOpen(false)}
          onCreated={(id) => router.push(`/simple/forms/${id}`)}
        />
      )}
    </div>
  );
}

function RegisterFormDialog({
  orgs,
  s,
  onCancel,
  onCreated,
}: {
  orgs: Org[];
  s: (typeof STRINGS)["ko"]["dialog"];
  onCancel: () => void;
  onCreated: (templateId: string) => void;
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !file || orgs.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const { loadPdf } = await import("@/lib/pdf");
      const pdf = await loadPdf(buffer.slice(0));

      const createRes = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: orgs[0].id, name: name.trim(), pageCount: pdf.numPages }),
      });
      if (!createRes.ok) throw new Error("create failed");
      const template = await createRes.json();

      const pdfDataUri = `data:application/pdf;base64,${arrayBufferToBase64(buffer)}`;
      const pdfRes = await fetch(`/api/templates/${template.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfDataUri, pageCount: pdf.numPages }),
      });
      if (!pdfRes.ok) throw new Error("pdf upload failed");

      onCreated(template.id);
    } catch {
      setError(s.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">{s.title}</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">{s.nameLabel}</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-slate-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={s.namePlaceholder}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">{s.pdfLabel}</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onCancel} className="flex-1 text-sm border border-slate-300 rounded-md py-2 cursor-pointer hover:bg-slate-50">
            {s.cancel}
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || !file || busy}
            className="flex-1 text-sm bg-slate-900 text-white rounded-md py-2 cursor-pointer disabled:opacity-40 hover:bg-slate-800"
          >
            {busy ? s.submitting : s.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
