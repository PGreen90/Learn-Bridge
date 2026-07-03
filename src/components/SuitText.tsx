import type { ReactNode } from 'react'
import type { Suit } from '../types/bridge'
import { SuitSymbol } from './SuitSymbol'

/** Vilken färg ett symboltecken står för (för färgläggning av löptext). */
export const CHAR_SUIT: Record<string, Suit> = {
  '♠': 'spades',
  '♥': 'hearts',
  '♦': 'diamonds',
  '♣': 'clubs',
}

/**
 * Färglägger alla ♠ ♥ ♦ ♣ i en textsträng med fyrfärgsleken (samma kulörer som
 * budlådan, via SuitSymbol som även hanterar mörkt läge). Används överallt där
 * förklaringar/beskrivningar visas som löptext — symboler ska ALDRIG vara
 * ofärgade (ägarbeslut 2026-07-03).
 */
export function SuitText({ children }: { children: string }) {
  if (!/[♠♥♦♣]/.test(children)) return <>{children}</>
  const parts: ReactNode[] = children
    .split(/([♠♥♦♣])/)
    .map((part, i) =>
      CHAR_SUIT[part] ? <SuitSymbol key={i} suit={CHAR_SUIT[part]} /> : part,
    )
  return <>{parts}</>
}
