import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const STYLES: Record<Variant, string> = {
  primary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  secondary:
    'bg-white hover:bg-club-50 text-slate-900 border border-emerald-950/15 dark:bg-club-800 dark:hover:bg-club-800/70 dark:text-slate-100 dark:border-emerald-100/15',
  ghost: 'bg-transparent hover:bg-black/5 text-slate-900 dark:text-slate-100 dark:hover:bg-white/10',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'primary', className = '', ...rest }: Props) {
  return (
    <button
      className={`rounded-lg px-4 py-2 font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${STYLES[variant]} ${className}`}
      {...rest}
    />
  )
}
