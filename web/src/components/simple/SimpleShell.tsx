"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { useLanguage, type Lang } from "@/lib/language";

// 간단 버전(1차 오픈) 전용 셸 — 기존 /editor 반복행·AI 검수 등 복잡한 화면과는
// 완전히 분리된 겉모습으로 보이도록 배색·메뉴 구성을 다르게 둔다.
const STRINGS = {
  ko: {
    appName: "폼솔루션",
    tagline: "간단 버전",
    nav: [
      { href: "/simple/forms", label: "양식 관리" },
      { href: "/simple/documents", label: "문서 조회" },
    ],
    fullVersion: "일반 버전 (새 탭)",
    org: "Neolab Convergence",
  },
  ja: {
    appName: "フォームソリューション",
    tagline: "シンプル版",
    nav: [
      { href: "/simple/forms", label: "様式管理" },
      { href: "/simple/documents", label: "文書照会" },
    ],
    fullVersion: "通常版（新しいタブ）",
    org: "Neolab Convergence",
  },
} satisfies Record<Lang, { appName: string; tagline: string; nav: { href: string; label: string }[]; fullVersion: string; org: string }>;

export function SimpleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const s = STRINGS[lang];

  return (
    <div className="flex h-screen bg-[#f4f5f7]">
      <aside className="w-52 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="text-[13px] font-bold text-slate-900 tracking-tight">{s.appName}</div>
          <div className="text-[11px] text-slate-400">{s.tagline}</div>
        </div>
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {s.nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-[13px] transition-colors ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-2.5 pb-2">
          <a
            href="/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <span className="text-xs opacity-70">↗</span>
            {s.fullVersion}
          </a>
        </div>
        <div className="px-4 py-3 text-[11px] text-slate-400 border-t border-slate-200">{s.org}</div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
          <Image src="/brand/neolab-logo.png" alt="NeoLAB" width={96} height={29} priority />
          <AccountMenu />
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
