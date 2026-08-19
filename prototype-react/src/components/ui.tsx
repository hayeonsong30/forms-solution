import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-panel border border-border rounded-[10px] shadow-[0_1px_2px_rgba(16,24,40,.04),0_1px_3px_rgba(16,24,40,.06)] ${className}`}>
      {children}
    </div>
  )
}

const badgeColors = {
  green: 'bg-accent-soft text-[#0B8F63]',
  amber: 'bg-warn-soft text-[#B4740E]',
  red: 'bg-danger-soft text-[#C22C31]',
  gray: 'bg-[#F1F2F6] text-[#5B6072]',
  blue: 'bg-primary-soft text-primary',
  new: 'bg-new-soft text-new',
} as const

const dotColors = {
  green: 'bg-[#0B8F63]',
  amber: 'bg-[#B4740E]',
  red: 'bg-[#C22C31]',
  gray: 'bg-[#8A90A6]',
  blue: 'bg-primary',
  new: 'bg-new',
} as const

export function Badge({ color, children }: { color: keyof typeof badgeColors; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${badgeColors[color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[color]}`} />
      {children}
    </span>
  )
}

export function Button({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...rest
}: {
  children: ReactNode
  variant?: 'default' | 'primary' | 'ghost'
  size?: 'sm' | 'md'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex items-center gap-1.5 rounded-lg font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const sizes = size === 'sm' ? 'h-[28px] px-2.5 text-[11.5px]' : 'h-[34px] px-3.5 text-[12.5px]'
  const variants = {
    default: 'bg-white border-border text-ink hover:bg-[#FAFBFC]',
    primary: 'bg-primary border-primary text-white hover:bg-primary-dark',
    ghost: 'bg-transparent border-transparent text-ink-sub hover:bg-[#F1F2F6]',
  }
  return (
    <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}
