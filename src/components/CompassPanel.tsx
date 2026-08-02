// Kompasspanelen (Synrey-stil): mörkgrön platta med en kompassros (fyruddig
// stjärna med ♠ i mitten), väderstrecken N/Ö/S/V runt om — given markerad med
// gul understrykning — och "Bricka X / zon" direkt under rosen. Längst ner
// finns en valfri `footer`-plats (ägarbeslut 2026-08-02: Mål-knappen bor där
// i budfasen i stället för på en egen rad under panelen).

import type { ReactNode } from 'react'
import type { Seat, Vulnerability } from '../types/bridge'

const VUL_TEXT: Record<Vulnerability, string> = {
  none: 'Ingen i zon',
  ns: 'NS i zon',
  ew: 'ÖV i zon',
  all: 'Alla i zon',
}

function CompassLetter({ letter, dealer }: { letter: Seat; dealer: Seat }) {
  const isDealer = letter === dealer
  const label = { N: 'N', E: 'Ö', S: 'S', W: 'V' }[letter]
  return (
    <span
      className={`text-sm font-semibold ${
        isDealer ? 'text-yellow-300 underline underline-offset-2' : 'text-emerald-50/90'
      }`}
      title={isDealer ? 'Given (börjar buda)' : undefined}
    >
      {label}
    </span>
  )
}

export function CompassPanel({
  dealer,
  board,
  vulnerability,
  footer,
}: {
  dealer: Seat
  board: number
  vulnerability: Vulnerability
  /** Valfritt innehåll längst ner i panelen (budfasens Mål-knapp). */
  footer?: ReactNode
}) {
  return (
    <div className="flex w-24 shrink-0 flex-col rounded-lg bg-emerald-950/60 p-2 ring-1 ring-emerald-100/10 sm:w-32 sm:p-2.5">
      {/* Kompassrosen med väderstrecken runt om. */}
      <div className="grid grid-cols-3 grid-rows-3 place-items-center">
        <div />
        <CompassLetter letter="N" dealer={dealer} />
        <div />
        <CompassLetter letter="W" dealer={dealer} />
        <svg viewBox="0 0 40 40" className="h-9 w-9 sm:h-12 sm:w-12" aria-hidden>
          {/* Fyruddig stjärna (kompassros) med en spader i mitten. */}
          <polygon
            points="20,1 24,16 39,20 24,24 20,39 16,24 1,20 16,16"
            className="fill-emerald-50"
            stroke="#0b4a3a"
            strokeWidth="0.75"
          />
          <text x="20" y="24.5" textAnchor="middle" fontSize="11" className="fill-emerald-900">
            ♠
          </text>
        </svg>
        <CompassLetter letter="E" dealer={dealer} />
        <div />
        <CompassLetter letter="S" dealer={dealer} />
        <div />
      </div>
      {/* Bricka/zon direkt under rosen (uppflyttade 2026-08-02) → botten fri
          för footern. */}
      <div className="mt-1 text-[10px] leading-tight text-emerald-50/90 sm:text-[11px]">
        <div>Bricka {board}</div>
        <div>{VUL_TEXT[vulnerability]}</div>
      </div>
      {footer && <div className="mt-auto pt-1.5">{footer}</div>}
    </div>
  )
}
