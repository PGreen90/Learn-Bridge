// Kortflygningen (etapp 3, "känsla i kortspelet"): ett spelat kort flyger
// synligt från handen till sin plats i sticket. Den här hooken äger själva
// tillståndet — VAR kortet startade (mätt SYNKRONT innan motorn får kortet,
// annars är källkortet redan borta ur handen) och VILKET kort som är i luften.
// Själva animationen ritas av FlightLayer; spelmotorn vet ingenting om detta.

import { useCallback, useRef, useState } from 'react'
import type { Card, Seat } from '../../types/bridge'
import { prefersReducedMotion } from './tempo'

export type Flight = {
  /** Löpnummer — skiljer två flygningar av samma kort åt (StrictMode/städning). */
  id: number
  seat: Seat
  card: Card
  /** Källkortets ruta på skärmen, mätt FÖRE setPlay. null = dold hand →
   *  flygningen startar från sätets bordskant i stället. */
  from: DOMRect | null
  /** Källan låg vriden 90° (öppen SideStack på V/Ö-sidan) → klonen startar vriden. */
  fromRotated: boolean
}

/** Registreringsfunktionen som händerna använder: ge kortnyckeln, få en ref. */
export type RegisterCardEl = (key: string) => (el: HTMLElement | null) => void

export const cardKey = (c: Card) => `${c.suit}${c.rank}`

/** Kan miljön flyga alls? jsdom saknar WAAPI och reduced motion stänger av det
 *  visuella — båda fallen faller tillbaka på dagens card-in-glidning. */
function canFly(): boolean {
  return (
    typeof Element !== 'undefined' &&
    typeof Element.prototype.animate === 'function' &&
    !prefersReducedMotion()
  )
}

export function useCardFlight() {
  const [flight, setFlight] = useState<Flight | null>(null)
  // Kortnyckel → DOM-elementet i handen (Syds solfjäder, Nords kolumner,
  // öppen SideStack). Bara SYNLIGA kort finns här; dolda händer saknas medvetet.
  const els = useRef(new Map<string, HTMLElement>())
  // En stabil ref-callback per kortnyckel — annars kopplar React av/på alla
  // refs varje render i onödan.
  const refCbs = useRef(new Map<string, (el: HTMLElement | null) => void>())
  // Kort som flugit (eller är i luften): de ska ALDRIG få card-in-klassen i
  // sticket — annars glider de in en gång till efter landningen.
  const flown = useRef(new Set<string>())
  const idRef = useRef(0)

  const registerCardEl: RegisterCardEl = useCallback((key) => {
    let cb = refCbs.current.get(key)
    if (!cb) {
      cb = (el) => {
        if (el) els.current.set(key, el)
        else els.current.delete(key)
      }
      refCbs.current.set(key, cb)
    }
    return cb
  }, [])

  /** Starta en flygning: mäter källkortet NU (synkront, före setPlay). Gör
   *  inget alls när miljön inte kan flyga → fallbacken card-in tar över. */
  const beginFlight = useCallback((seat: Seat, card: Card) => {
    if (!canFly()) return
    const el = els.current.get(cardKey(card))
    const rect = el?.getBoundingClientRect()
    // Elementet finns men mäter noll (t.ex. ej utritat) → lita inte på det,
    // ta fallback-vägen. Saknat element = dold hand = start från bordskanten.
    if (rect && (rect.width === 0 || rect.height === 0)) return
    flown.current.add(cardKey(card))
    idRef.current += 1
    setFlight({
      id: idRef.current,
      seat,
      card,
      from: rect ?? null,
      fromRotated: !!rect && (seat === 'W' || seat === 'E'),
    })
  }, [])

  /** Flygningen är klar (eller avbruten) — bara den aktuella får rensa sig. */
  const endFlight = useCallback((id: number) => {
    setFlight((f) => (f && f.id === id ? null : f))
  }, [])

  const wasFlown = useCallback((card: Card) => flown.current.has(cardKey(card)), [])

  return { flight, beginFlight, endFlight, registerCardEl, wasFlown }
}
