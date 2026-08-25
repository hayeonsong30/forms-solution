"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { useLanguage, type Lang } from "@/lib/language";

const STRINGS = {
  ko: {
    appName: "폼솔루션",
    nav: [
      { href: "/dashboard", label: "대시보드", icon: "◱" },
      { href: "/templates", label: "양식 관리", icon: "▤" },
      { href: "/documents", label: "문서 조회", icon: "▥" },
    ],
    sample: "샘플 버전 (새 탭)",
    org: "Neolab Convergence",
  },
  ja: {
    appName: "フォームソリューション",
    nav: [
      { href: "/dashboard", label: "ダッシュボード", icon: "◱" },
      { href: "/templates", label: "様式管理", icon: "▤" },
      { href: "/documents", label: "文書照会", icon: "▥" },
    ],
    sample: "サンプル版（新しいタブ）",
    org: "Neolab Convergence",
  },
} satisfies Record<Lang, { appName: string; nav: { href: string; label: string; icon: string }[]; sample: string; org: string }>;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const bare = pathname?.startsWith("/editor") || pathname?.startsWith("/simple");

  if (bare) return <>{children}</>;

  const s = STRINGS[lang];

  return (
    <div className="flex h-screen">
      <aside className="w-56 shrink-0 bg-[var(--color-sidebar)] text-slate-300 flex flex-col">
        <div className="px-5 py-5 text-white font-semibold tracking-tight">{s.appName}</div>
        <nav className="flex-1 px-3 space-y-0.5">
          {s.nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-[var(--color-sidebar-active)] text-white" : "hover:bg-[var(--color-sidebar-active)]/60 hover:text-white"
                }`}
              >
                <span className="text-xs opacity-70">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-2">
          <a
            href="/simple/forms"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-[var(--color-sidebar-active)]/60 hover:text-white transition-colors"
          >
            <span className="text-xs opacity-70">↗</span>
            {s.sample}
          </a>
        </div>
        <div className="px-5 py-4 text-xs text-slate-500">{s.org}</div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-white">
          <Image src="/brand/neolab-logo.png" alt="NeoLAB" width={96} height={29} priority />
          <AccountMenu />
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
