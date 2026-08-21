"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// 간단 버전(1차 오픈) 전용 셸 — 기존 /editor 반복행·AI 검수 등 복잡한 화면과는
// 완전히 분리된 겉모습으로 보이도록 배색·메뉴 구성을 다르게 둔다.
const NAV = [
  { href: "/simple/forms", label: "양식 관리" },
  { href: "/simple/documents", label: "문서 조회" },
];

export function SimpleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-[#f4f5f7]">
      <aside className="w-52 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="text-[13px] font-bold text-slate-900 tracking-tight">폼솔루션</div>
          <div className="text-[11px] text-slate-400">간단 버전</div>
        </div>
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {NAV.map((item) => {
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
            일반 버전 (새 탭)
          </a>
        </div>
        <div className="px-4 py-3 text-[11px] text-slate-400 border-t border-slate-200">네오랩 데모 고객사</div>
      </aside>
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
    </div>
  );
}
