// RebidZ-logotypen: guldspader på smaragdplatta. Ritad som inline-SVG så den
// är knivskarp i alla storlekar (sidhuvud, hero, ikoner) och alltid följer
// varumärkesfärgerna. Samma konstverk ligger som public/favicon.svg – ändras
// formen här ska favicon uppdateras i takt.

/**
 * Ordmärket "rebidz" (ägarens vision 2026-07-02): gemener i varumärkesserifen
 * Fraunces med guldgradient — och SPADERN SOM PRICK över i:et. Tricket: ett
 * prickfritt i (ı, U+0131) med ♠ positionerad ovanför, allt i em-mått så det
 * skalar med textstorleken (sidhuvud som hero).
 */
export function Wordmark({
  className = '',
  framed = false,
}: {
  className?: string
  /** Tunn guldram runt ordmärket (ägarens logo-vision, bild 2). Ramen och
   *  luften runt om mäts i em → skalar med textstorleken. */
  framed?: boolean
}) {
  const mark = (
    <span role="img" aria-label="rebidz" className="font-brand font-semibold tracking-tight">
      {/* Gradienten sätts PER SEGMENT: background-clip: text målar inte in i
          positionerade barn, så i-segmentet (relative) behöver sin egen. Den
          lodräta gradienten är identisk i alla segment → skarven syns inte. */}
      <span aria-hidden>
        <span className="text-gold-gradient">reb</span>
        <span className="text-gold-gradient relative">
          ı
          {/* Spader-pricken: 5 px över i:ets topp vid herostorlek (ägarbeslut
              2026-07-02), skalar med texten. OBS: top i em räknas på spaderns
              EGEN font-size (0.4em av ordmärket). */}
          <span className="absolute left-1/2 top-[0.04em] -translate-x-1/2 text-[0.4em] leading-none text-gold-400">
            ♠
          </span>
        </span>
        <span className="text-gold-gradient">dz</span>
      </span>
    </span>
  )

  if (!framed) return <span className={className}>{mark}</span>
  return (
    <span
      className={`inline-block rounded-[0.22em] border border-gold-400/60 px-[0.4em] pb-0 pt-[0.2em] leading-none ${className}`}
    >
      {mark}
    </span>
  )
}
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="rbz-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f6249" />
          <stop offset="1" stopColor="#052e23" />
        </linearGradient>
        <linearGradient id="rbz-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8cf85" />
          <stop offset="1" stopColor="#c39a33" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#rbz-bg)" />
      <rect
        x="1.5"
        y="1.5"
        width="61"
        height="61"
        rx="12.5"
        fill="none"
        stroke="#e8cf85"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <path
        d="M32 7
           C 26 15, 11 26, 11 37
           C 11 45, 18 49.5, 24.5 47.5
           C 27.5 46.5, 29.5 44.5, 30.5 42
           C 30 49, 27 54, 22.5 56.5
           L 41.5 56.5
           C 37 54, 34 49, 33.5 42
           C 34.5 44.5, 36.5 46.5, 39.5 47.5
           C 46 49.5, 53 45, 53 37
           C 53 26, 38 15, 32 7 Z"
        fill="url(#rbz-gold)"
      />
    </svg>
  )
}
