// RebidZ-logotypen: guldspader på smaragdplatta. Ritad som inline-SVG så den
// är knivskarp i alla storlekar (sidhuvud, hero, ikoner) och alltid följer
// varumärkesfärgerna. Samma konstverk ligger som public/favicon.svg – ändras
// formen här ska favicon uppdateras i takt.

/**
 * Ordmärket "rebidz" (tvåfärgad + skimmer, 2026-07-31).
 * **Tvåfärgat** (base44-inspirerat, ägarbeslut): "re" och "z" i den omgivande
 * textfärgen (`currentColor` — vit på emerald-baren, gräddvit på filtet), "bid"
 * i guld med animerat **skimmer** så guldet ser ut att flyta ("levande guld").
 * Bridge-ordet *bid* lyfts alltså ur namnet. i:ets prick är en **vanlig
 * guldprick** (ingår i guld-texten) — den gamla spader-pricken togs bort
 * 2026-07-31: med den frameless spadern ovanför loggan + vattenstämpeln bakom
 * blev det för många spader ("för mycket av samma sak", ägarbeslut). Ramen
 * borttagen (ägaren gillar frameless).
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="rebidz"
      className={`font-brand font-semibold tracking-tight ${className}`}
    >
      <span aria-hidden>
        <span>re</span>
        {/* Hela "bid" i ETT skimmer-segment → guldranden sveper genom bid som en
            enhet (inte per bokstav). i:ets naturliga prick blir en guldprick. */}
        <span className="text-gold-shimmer">bid</span>
        <span>z</span>
      </span>
    </span>
  )
}
export function BrandMark({
  className = '',
  bare = false,
}: {
  className?: string
  /** `bare` = bara den rena guldspadern, utan emerald-plattan + guldramen
   *  (ägaren tyckte den inramade rutan kändes avig ovanför den frameless
   *  loggan, 2026-07-31). Används i heron (stor spader + vattenstämpel);
   *  sidhuvudet + faviconen behåller den inramade plattan. */
  bare?: boolean
}) {
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
      {!bare && (
        <>
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
        </>
      )}
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
