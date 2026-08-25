"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { useLanguage, type Lang } from "@/lib/language";

// 아직 로그인 기능이 없어서(project memory 참고) ID·비밀번호는 고정된 데모 계정 값을
// 그대로 보여주기만 한다. 회사명(Organization.name)은 실제 DB 값이라 여기서 고치면
// 앱 전체(LNB·양식목록 Owner 열 등)에 그대로 반영된다.
const DEMO_ACCOUNT_ID = "demo-admin@neolab.local";

const STRINGS = {
  ko: {
    account: "Account",
    profile: "Profile",
    logout: "Logout",
    modalTitle: "프로필",
    id: "ID",
    password: "비밀번호",
    org: "회사명",
    language: "언어",
    close: "닫기",
    saving: "저장 중…",
  },
  ja: {
    account: "Account",
    profile: "Profile",
    logout: "Logout",
    modalTitle: "プロフィール",
    id: "ID",
    password: "パスワード",
    org: "会社名",
    language: "言語",
    close: "閉じる",
    saving: "保存中…",
  },
} satisfies Record<Lang, unknown>;

export function AccountMenu() {
  const { lang, setLang } = useLanguage();
  const s = STRINGS[lang];
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [orgDraft, setOrgDraft] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    fetch("/api/orgs")
      .then((r) => r.json())
      .then((orgs: { id: string; name: string }[]) => {
        const first = orgs[0] ?? null;
        setOrg(first);
        setOrgDraft(first?.name ?? "");
      });
  }, []);

  async function saveOrgName() {
    if (!org || orgDraft.trim() === "" || orgDraft === org.name) return;
    setSavingOrg(true);
    try {
      const res = await fetch(`/api/orgs/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgDraft.trim() }),
      });
      if (res.ok) setOrg(await res.json());
    } finally {
      setSavingOrg(false);
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-white border border-[var(--color-border)] pl-1.5 pr-2.5 py-1 text-xs text-slate-600 shadow-sm hover:bg-slate-50 cursor-pointer"
        >
          <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">👤</span>
          {DEMO_ACCOUNT_ID}
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-[var(--color-border)] bg-white shadow-lg overflow-hidden text-sm"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <div className="px-3 py-1.5 text-[10px] text-slate-400 tracking-wide border-b border-[var(--color-border)]">{s.account}</div>
            <button
              className="w-full text-left px-3 py-2 hover:bg-slate-50 cursor-pointer"
              onClick={() => {
                setMenuOpen(false);
                setProfileOpen(true);
              }}
            >
              {s.profile}
            </button>
            <button className="w-full text-left px-3 py-2 hover:bg-slate-50 cursor-pointer" onClick={() => setMenuOpen(false)}>
              {s.logout}
            </button>
          </div>
        )}
      </div>

      {profileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setProfileOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)]">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">{s.modalTitle}</h2>
                <button
                  className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg leading-none"
                  onClick={() => setProfileOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <Field label={s.id}>
                  <input disabled value={DEMO_ACCOUNT_ID} className="w-full rounded-md border border-[var(--color-border)] bg-slate-50 px-2.5 py-1.5 text-slate-500" />
                </Field>
                <Field label={s.password}>
                  <input
                    disabled
                    type="password"
                    value="••••••••••"
                    className="w-full rounded-md border border-[var(--color-border)] bg-slate-50 px-2.5 py-1.5 text-slate-500"
                  />
                </Field>
                <Field label={s.org}>
                  <input
                    value={orgDraft}
                    disabled={!org || savingOrg}
                    onChange={(e) => setOrgDraft(e.target.value)}
                    onBlur={saveOrgName}
                    placeholder={savingOrg ? s.saving : undefined}
                    className="w-full rounded-md border border-[var(--color-border)] px-2.5 py-1.5"
                  />
                </Field>
                <Field label={s.language}>
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value as Lang)}
                    className="w-full rounded-md border border-[var(--color-border)] px-2.5 py-1.5"
                  >
                    <option value="ko">한국어</option>
                    <option value="ja">日本語</option>
                  </select>
                </Field>
              </div>
              <div className="flex justify-end gap-1.5 px-5 py-3.5 border-t border-[var(--color-border)]">
                <Button onClick={() => setProfileOpen(false)}>{s.close}</Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      {children}
    </label>
  );
}
