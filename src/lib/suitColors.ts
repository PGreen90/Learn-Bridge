// Fyrfärgslek (FAS 12, ägarbeslut 2026-07-02): ♠ SVART (som i en riktig
// fyrfärgslek), ♥ röd, ♦ orange, ♣ grön. Används genomgående: symboler i
// text, kortens tryck och budlådans/auktionens chips.

import type { Suit } from '../types/bridge'

/** Textfärgen för en färgsymbol (fyrfärgslek). */
export const SUIT_TEXT: Record<Suit, string> = {
  spades: 'text-slate-900',
  hearts: 'text-red-600',
  // Ruter använder orange-700 (inte -500): på det vita kortet ger -500 bara
  // 2.80:1 kontrast (under WCAG AA 4.5), -700 ger 5.18:1 och läser fortfarande
  // tydligt som "orange", väl skild från hjärterröd (R3-fynd #1, mätt).
  diamonds: 'text-orange-700',
  clubs: 'text-green-700',
}

/**
 * Ljusare kulörer för symboler i LÖPTEXT i mörkt läge (annars drunknar blå/grön
 * mot mörk bakgrund). Används av SuitSymbol – ALDRIG av korten (PlayingCard),
 * vars framsida alltid är vit och behåller de mörka kulörerna.
 */
export const SUIT_TEXT_DARK: Record<Suit, string> = {
  spades: 'dark:text-slate-100',
  hearts: 'dark:text-red-400',
  diamonds: 'dark:text-orange-400',
  clubs: 'dark:text-green-400',
}

/** Chip-stil (bakgrund + text) för ett kontraktsbud per trumfslag, Synrey-paletten. */
export const STRAIN_CHIP: Record<'NT' | 'S' | 'H' | 'D' | 'C', string> = {
  NT: 'bg-purple-100 text-purple-800',
  S: 'bg-slate-200 text-slate-900',
  H: 'bg-red-100 text-red-600',
  D: 'bg-orange-100 text-orange-600',
  C: 'bg-green-100 text-green-700',
}

/** Chip-stil för de tre specialbuden (pass/dubbelt/redubbelt). */
export const CALL_CHIP: Record<'P' | 'X' | 'XX', string> = {
  P: 'bg-green-600 text-white',
  X: 'bg-red-900 text-red-300',
  XX: 'bg-indigo-900 text-indigo-300',
}
