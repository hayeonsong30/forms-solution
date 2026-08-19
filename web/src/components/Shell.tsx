"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/templates", label: "양식 관리", icon: "▤" },
  { href: "/documents", label: "문서 조회", icon: "▥" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = pathname?.startsWith("/editor");

  return (
    <div className="flex h-screen">
      <aside className="w-56 shrink-0 bg-[var(--color-sidebar)] text-slate-300 flex flex-col">
        <div className="px-5 py-5 text-white font-semibold tracking-tight">폼솔루션</div>
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((item) => {
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
        <div className="px-5 py-4 text-xs text-slate-500">네오랩 데모 고객사</div>
      </aside>
      <div className={`flex-1 min-w-0 ${bare ? "" : "overflow-y-auto"}`}>{children}</div>
    </div>
  );
}
