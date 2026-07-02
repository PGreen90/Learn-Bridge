import type { ReactNode } from 'react'

// Det gröna bordsfiltet — EN sanningskälla för bordets utseende. Justera
// gradienten/ramen här så ändras ALLA bord samtidigt: spelet (bud- + spelfas),
// budträningen, budvisningen och omspelningen.
//
// Tre lager ger djupet: (1) fin brusstruktur = filtväv (liten SVG som upprepas),
// (2) ljus uppifrån = radialgradient med ljusare centrum, (3) vinjettering +
// kantljus via inset-skuggorna i komponenten.
const FELT_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E\")"
const FELT_BACKGROUND =
  `${FELT_NOISE}, radial-gradient(ellipse at 50% 32%, #178a66 0%, #0f624c 58%, #0a4438 100%)`

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
      className={`relative overflow-hidden border border-emerald-950/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),inset_0_0_60px_rgba(0,0,0,0.30),0_10px_30px_-15px_rgba(0,0,0,0.6)] ${rounded} ${className}`}
      style={{ background: FELT_BACKGROUND }}
    >
      {children}
    </div>
  )
}
