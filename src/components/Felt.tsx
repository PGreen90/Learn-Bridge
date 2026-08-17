import type { CSSProperties, ReactNode } from 'react'

// Bordsfiltet — EN sanningskälla för bordets utseende. Justera gradienterna/
// ramarna här så ändras ALLA bord samtidigt: spelet (bud- + spelfas),
// budträningen, budvisningen och omspelningen.
//
// Tre lager ger djupet: (1) fin brusstruktur = filtväv (liten SVG som upprepas),
// (2) ljus uppifrån = radialgradient med ljusare centrum, (3) vinjettering +
// kantljus via inset-skuggorna i komponenten.
//
// Två toner (ägarbeslut 2026-08-17): 'club' = den gröna klubbduken (allt
// befintligt), 'vanner' = den vinröda kvällssalongen för "Spela med vänner" —
// samma ljusstruktur och väv, bara färgstoppen skiljer. Guldet och korten är
// medvetet oförändrade i båda.
const FELT_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E\")"

export const FELT_TONER = {
  club: {
    bakgrund: `${FELT_NOISE}, radial-gradient(ellipse at 50% 32%, #178a66 0%, #0f624c 58%, #0a4438 100%)`,
    ram: 'border-emerald-950/40',
  },
  vanner: {
    bakgrund: `${FELT_NOISE}, radial-gradient(ellipse at 50% 32%, #8a2b3a 0%, #63202d 58%, #451724 100%)`,
    ram: 'border-red-950/40',
  },
} as const

export type FeltTone = keyof typeof FELT_TONER

export function Felt({
  children,
  className = '',
  rounded = 'rounded-3xl',
  tone = 'club',
  style,
}: {
  children: ReactNode
  className?: string
  /** Hörnradie – budvisningens lilla auktionsfilt använder rounded-2xl. */
  rounded?: string
  /** Dukens färgton: 'club' (grön, standard) eller 'vanner' (vinröd). */
  tone?: FeltTone
  /** Extra inline-stil (spelbordet sätter --motion-scale för tempot här). */
  style?: CSSProperties
}) {
  const t = FELT_TONER[tone]
  return (
    <div
      className={`relative overflow-hidden border ${t.ram} shadow-[inset_0_1px_0_rgba(255,255,255,0.09),inset_0_0_60px_rgba(0,0,0,0.30),0_10px_30px_-15px_rgba(0,0,0,0.6)] ${rounded} ${className}`}
      style={{ background: t.bakgrund, ...style }}
    >
      {children}
    </div>
  )
}
