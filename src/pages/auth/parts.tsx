// Delade formulärbitar för inloggningssidorna (Beslut B etapp 1, steg 5b).
// Håller utseendet enhetligt och i rebidz tokens (emerald/guld, bg-control osv).

import type { InputHTMLAttributes, ReactNode } from 'react'

/** Ett textfält med etikett (och valfri hjälptext under). */
export function Field({
  label,
  hint,
  id,
  ...rest
}: { label: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      <input
        id={id}
        className="w-full rounded-lg border border-control-line bg-control px-3 py-2 text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600"
        {...rest}
      />
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}

/** Rött felmeddelande (uppläses av skärmläsare). */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 ring-1 ring-red-500/30 dark:text-red-300"
    >
      {children}
    </p>
  )
}

/** Grönt info-/kvittensmeddelande. */
export function FormNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-500/30 dark:text-emerald-200">
      {children}
    </p>
  )
}

/** Plocka ut ett läsbart felmeddelande ur ett okänt fångat fel. */
export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Något gick fel. Försök igen.'
}
