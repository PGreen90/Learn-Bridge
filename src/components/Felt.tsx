import type { ReactNode } from 'react'

// Det gröna bordsfiltet (Synrey-känsla) — EN sanningskälla för bordets
// utseende. Justera gradienten/ramen här så ändras ALLA bord samtidigt:
// spelet (bud- + spelfas), budträningen, budvisningen och omspelningen.
const FELT_BACKGROUND =
  'radial-gradient(circle at 50% 40%, #15795b 0%, #0f5e49 70%, #0b4a3a 100%)'

export function Felt({
  children,
  className = '',
  rounded = 'rounded-3xl',
}: {
  children: ReactNode
  className?: string
  /** Hörnradie – budvisningens lilla auktionsfilt använder rounded-2xl. */
  rounded?: string
}) {
  return (
    <div
      className={`relative overflow-hidden border border-emerald-950/30 shadow-inner ${rounded} ${className}`}
      style={{ background: FELT_BACKGROUND }}
    >
      {children}
    </div>
  )
}
