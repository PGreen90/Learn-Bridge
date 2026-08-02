// Dagens giv (2026-08-02): alla som öppnar appen samma dag spelar EXAKT samma
// giv — datumet är fröet, så ingen server behövs. Det är en förtitt på
// Funbridge-modellen (konkurrensplanen Fas 3): topplistan kommer först med
// konton, men "samma giv för alla + delbart resultat" fungerar redan nu.
// Ren logik utan I/O — delningsknappen (navigator.share/clipboard) bor i UI:t.

import type { Deal, Seat } from '../../types/bridge'
import { dealRandom, mulberry32 } from './deal'
import type { Contract, Strain } from './play'

// Egen sätesetikett (samma text som SEAT_LABEL i lib/bidding) — medvetet INTE
// importerad därifrån: bidding.ts drar in alla övnings-JSON, och den här
// modulen ska vara lätt nog för startsidans chunk (Home visar givnumret).
const SEAT_TEXT: Record<Seat, string> = { N: 'Nord', E: 'Öst', S: 'Syd', W: 'Väst' }

/** Premiärdagen — Dagens giv #1. Lokal tid (spelarens "i dag"). */
const EPOCH = new Date(2026, 7, 2)

/** Fröet = datumet som åttasiffrigt tal (20260802), i spelarens lokala tid.
 *  Samma dag → samma frö → samma giv, precis som revisorns reproducerbara frön. */
export function dailySeed(date: Date = new Date()): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
}

/** Givens löpnummer: premiärdagen = #1, dagen efter = #2 … (lokala dygn). */
export function dailyNumber(date: Date = new Date()): number {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((day.getTime() - EPOCH.getTime()) / 86_400_000) + 1
}

/** Dagens giv — deterministisk ur datumet, med stabilt id ("dagens-1"). */
export function dailyDeal(date: Date = new Date()): Deal {
  const deal = dealRandom(mulberry32(dailySeed(date)))
  return { ...deal, id: `dagens-${dailyNumber(date)}` }
}

const STRAIN_TEXT: Record<Strain, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  NT: 'NT',
}

/**
 * Det delbara resultatet (Wordle-mekaniken): en kort text att klistra in i en
 * gruppchatt — varje delning är en inbjudan att spela samma giv själv.
 */
export function shareText({
  number,
  contract,
  declarerTricks,
  scoreLabel,
}: {
  number: number
  contract: Contract
  declarerTricks: number
  scoreLabel: string
}): string {
  const bid = `${contract.level}${STRAIN_TEXT[contract.strain]}${contract.doubled ?? ''}`
  const diff = declarerTricks - (6 + contract.level)
  const outcome = diff >= 0 ? `hemma${diff > 0 ? ` +${diff}` : ''}` : `${-diff} bet`
  return [
    `rebidz · Dagens giv #${number}`,
    `${bid} av ${SEAT_TEXT[contract.declarer]} — ${outcome}`,
    scoreLabel,
    'https://rebidz.com/#/spela-kort/dagens',
  ].join('\n')
}
