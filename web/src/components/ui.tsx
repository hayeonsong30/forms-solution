import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const VARIANT_CLASS: Record<string, string> = {
  primary: "bg-[var(--color-brand-600)] text-white hover:bg-[var(--color-brand-700)] disabled:opacity-50",
  secondary:
    "bg-white text-[var(--foreground)] border border-[var(--color-border)] hover:bg-slate-50 disabled:opacity-50",
  ghost: "text-[var(--color-brand-600)] hover:bg-[var(--color-brand-50)] disabled:opacity-50",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50",
};

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function buttonClass(variant: ButtonVariant = "secondary", className = "") {
  return `inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${VARIANT_CLASS[variant]} ${className}`;
}

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

// 파일 입력처럼 <button> 안에 넣을 수 없는 인터랙티브 요소를 버튼처럼 보이게 만들 때 사용.
export function ButtonLabel({
  variant = "secondary",
  className = "",
  children,
}: {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return <label className={buttonClass(variant, className)}>{children}</label>;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-100)] ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-100)] ${className}`}
      {...props}
    />
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] ${className}`}>
      {children}
    </div>
  );
}

const BADGE_TONE: Record<string, string> = {
  amber: "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-fg)]",
  green: "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-fg)]",
  slate: "bg-[var(--color-status-slate-bg)] text-[var(--color-status-slate-fg)]",
  red: "bg-[var(--color-status-red-bg)] text-[var(--color-status-red-fg)]",
  brand: "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]",
};

export function Badge({ tone = "slate", children }: { tone?: keyof typeof BADGE_TONE; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONE[tone]}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-lg font-semibold text-[var(--foreground)]">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}
