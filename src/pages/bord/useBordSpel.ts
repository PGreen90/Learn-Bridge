// Beslut B etapp 4 (4B) — spelvyns synk mot bordets händelselogg.
//
// Tre inflöden av händelser, samma hantering (dedupe på seq + sortering):
//  1. drag-svaret (egna drag + serverns botsvar — den agerande får dem direkt),
//  2. realtidsprenumerationen (latenssocker),
//  3. hjärtslaget var 5:e sekund (auktoritativt — bordet fungerar utan realtid).
//
// PRESENTATIONSKÖN: servern spelar alla botdrag på en gång, men klienten visar
// dem i bordets tempo — `visadeSeq` är läskursorn, och nästa händelse avtäcks
// efter sin paus (bud/kort) eller direkt (övrigt). Egna drag avtäcks omedelbart.
// Sticksvepet pausar kön (som i det lokala spelet).
//
// Min hand hämtas ur ?h=lage (hela den utdelade handen) och hämtas OM när en
// ny giv börjar (giv-start-händelsen är signalen — oavsett vem som tryckte
// "Nästa giv").

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Seat } from '../../types/bridge'
import {
  bordHjartslag,
  hamtaBordLage,
  prenumereraBordHandelser,
  skickaDrag,
  type BordDragInput,
  type BordHandelse,
  type BordMeta,
  type BordStol,
} from '../../lib/backend/bord'
import { ms, type PlaySpeed } from '../play/tempo'
import type { Sweep } from '../play/common'
import {
  byggVisuelltSpel,
  projiceraBord,
  visuellAuktion,
  vridTillbaka,
  type BordSpelLage,
  type VisuellAuktion,
  type VisuellSpel,
} from './bord-projektion'

const HJARTSLAG_MS = 5_000

function laggIhop(gamla: BordHandelse[], nya: BordHandelse[]): BordHandelse[] {
  if (!nya.length) return gamla
  const perSeq = new Map(gamla.map((h) => [h.seq, h]))
  for (const h of nya) perSeq.set(h.seq, h)
  return [...perSeq.values()].sort((a, b) => a.seq - b.seq)
}

export interface BordSpelet {
  laddar: boolean
  meta: BordMeta | null
  stolar: BordStol[]
  /** Din HELA utdelade hand för aktuell giv (budfasen visar den orörd). */
  dinHand: Card[] | null
  lage: BordSpelLage | null
  auktion: VisuellAuktion | null
  spel: VisuellSpel | null
  sweep: Sweep | null
  fel: string | null
  /** Kön ikapp + inget svep + inget drag på väg → spelaren får agera. */
  aktuell: boolean
  /** Som `aktuell` men utan svep-spärren: ett klick under svepet får hoppa
   *  över svepet och agera direkt (ägarens fynd 2026-08-17 — "korten fastnar"). */
  redo: boolean
  skickar: boolean
  gorDrag: (drag: BordDragInput) => Promise<void>
  hoppaOverSvep: () => void
}

export function useBordSpel(kod: string, minStol: Seat, tempo: PlaySpeed): BordSpelet {
  const [events, setEvents] = useState<BordHandelse[]>([])
  const [senasteSeq, setSenasteSeq] = useState(0)
  const [visadeSeq, setVisadeSeq] = useState<number | null>(null)
  const [dinHand, setDinHand] = useState<Card[] | null>(null)
  const [grundStallning, setGrundStallning] = useState({ ns: 0, ew: 0 })
  const [meta, setMeta] = useState<BordMeta | null>(null)
  const [stolar, setStolar] = useState<BordStol[]>([])
  const [sweep, setSweep] = useState<Sweep | null>(null)
  const [fel, setFel] = useState<string | null>(null)
  const [skickar, setSkickar] = useState(false)
  // Det optimistiska draget: ditt bud/kort visas OMEDELBART (annars ligger
  // kortet kvar i handen under serverns svarstid — kändes som att det "hoppade
  // tillbaka", ägarens fynd 2026-08-17). Serverns svar ersätter det; ett avslag
  // plockar tillbaka det.
  const [vantande, setVantande] = useState<BordHandelse | null>(null)

  const senasteSeqRef = useRef(0)
  senasteSeqRef.current = senasteSeq

  const laggTill = useCallback((nya: BordHandelse[]) => {
    if (!nya.length) return
    setEvents((prev) => laggIhop(prev, nya))
    setSenasteSeq((prev) => Math.max(prev, nya[nya.length - 1].seq))
  }, [])

  /** Full synk mot servern: läget + min hand + (vid behov) givens händelser. */
  const synka = useCallback(async () => {
    const svar = await hamtaBordLage(kod)
    if (!svar.ok) {
      setFel(svar.fel)
      return
    }
    setMeta(svar.meta)
    setStolar(svar.stolar)
    if (svar.dinHand) setDinHand(svar.dinHand)
    if (svar.stallning) setGrundStallning(svar.stallning)
    let alla = svar.events
    // Fler händelser än svaret rymde? Hämta från aktuella givens start —
    // äldre händelser behövs aldrig för projektionen.
    const sista = alla.length ? alla[alla.length - 1].seq : 0
    if (sista < svar.senasteSeq && svar.givStartSeq !== null) {
      const resten = await hamtaBordLage(kod, svar.givStartSeq - 1)
      if (resten.ok) alla = laggIhop(alla, resten.events)
    }
    laggTill(alla)
    setSenasteSeq((prev) => Math.max(prev, svar.senasteSeq))
    // Första synken: hoppa läskursorn till nuet (ingen uppspelning av historik).
    setVisadeSeq((prev) => (prev === null ? svar.senasteSeq : prev))
  }, [kod, laggTill])

  useEffect(() => {
    void synka()
  }, [synka])

  // Realtidsprenumerationen (latenssocker — hjärtslaget är fallnätet).
  const bordId = meta?.id ?? null
  useEffect(() => {
    if (!bordId) return
    return prenumereraBordHandelser(bordId, (h) => laggTill([h]))
  }, [bordId, laggTill])

  // Hjärtslaget: närvaro + auktoritativ ikapphämtning.
  useEffect(() => {
    if (!meta || meta.status === 'avslutat') return
    const id = setInterval(() => {
      void (async () => {
        const svar = await bordHjartslag(kod, senasteSeqRef.current)
        if (!svar.ok) return
        if (svar.events.length) laggTill(svar.events)
        else if (svar.senasteSeq > senasteSeqRef.current) void synka()
      })()
    }, HJARTSLAG_MS)
    return () => clearInterval(id)
  }, [kod, meta, laggTill, synka])

  // Ny giv börjad (egen eller någon annans "Nästa giv") → hämta ny hand.
  const senasteGivStart = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].typ === 'giv-start') return events[i].seq
    }
    return 0
  }, [events])
  const hamtadGivStart = useRef(0)
  useEffect(() => {
    if (senasteGivStart > hamtadGivStart.current) {
      hamtadGivStart.current = senasteGivStart
      void synka()
    }
  }, [senasteGivStart, synka])

  // Presentationskön: avtäck nästa händelse efter sin paus. Pausad under svep.
  useEffect(() => {
    if (visadeSeq === null || sweep) return
    const nasta = events.find((e) => e.seq > visadeSeq)
    if (!nasta) return
    const egen = (nasta.typ === 'bud' || nasta.typ === 'kort') && nasta.seat === minStol
    const paus =
      nasta.typ === 'bud'
        ? egen
          ? 0
          : ms('budDelay', tempo)
        : nasta.typ === 'kort'
          ? egen
            ? 0
            : ms('botDelay', tempo)
          : nasta.typ === 'giv-klar'
            ? ms('resultOutro', tempo)
            : 0
    const id = setTimeout(() => setVisadeSeq(nasta.seq), paus)
    return () => clearTimeout(id)
  }, [events, visadeSeq, sweep, tempo, minStol])

  // Projektionen av det som hittills avtäckts (+ det optimistiska draget, tills
  // serverns bokförda version tagit dess plats).
  const synliga = useMemo(() => {
    const bas = visadeSeq === null ? [] : events.filter((e) => e.seq <= visadeSeq)
    const sist = bas.length ? bas[bas.length - 1].seq : 0
    return vantande && vantande.seq > sist ? [...bas, vantande] : bas
  }, [events, visadeSeq, vantande])
  const lage = useMemo(() => projiceraBord(synliga, grundStallning), [synliga, grundStallning])
  const auktion = useMemo(() => (lage ? visuellAuktion(lage, minStol) : null), [lage, minStol])
  const spel = useMemo(
    () => (lage ? byggVisuelltSpel(lage, dinHand, minStol) : null),
    [lage, dinHand, minStol],
  )

  // Sticksvepet: när ett avtäckt kort fullbordar ett stick — vinnarglow (hold)
  // och svep (slide), med kön pausad under tiden. Ref-vakten skiljer "nytt
  // fullbordat stick" från "monterad mitt i en giv".
  const settKort = useRef(-1)
  useEffect(() => {
    const n = lage?.kort.length ?? 0
    if (settKort.current === -1) {
      settKort.current = n
      return
    }
    if (n > settKort.current && n % 4 === 0 && spel && spel.state.completedTricks.length > 0) {
      settKort.current = n
      const trick = spel.state.completedTricks[spel.state.completedTricks.length - 1]
      setSweep({ trick, phase: 'hold' })
      const t1 = setTimeout(() => setSweep({ trick, phase: 'slide' }), ms('sweepHold', tempo))
      const t2 = setTimeout(() => setSweep(null), ms('sweepHold', tempo) + ms('sweepSlide', tempo))
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
    settKort.current = n
  }, [lage?.kort.length, spel, tempo])

  // Färska referenser till projektionen för det optimistiska draget (gorDrag
  // ska inte byggas om varje gång läget ändras).
  const lageRef = useRef(lage)
  lageRef.current = lage
  const spelRef = useRef(spel)
  spelRef.current = spel

  const gorDrag = useCallback(
    async (drag: BordDragInput) => {
      setSkickar(true)
      setFel(null)
      // Visa det egna draget direkt (optimistiskt). Kortets verkliga stol kan
      // vara träkarlens (du är spelförare) — den läses ur den visuella turen.
      if (drag.typ === 'bud' || drag.typ === 'kort') {
        const seat =
          drag.typ === 'bud'
            ? minStol
            : spelRef.current
              ? vridTillbaka(minStol)(spelRef.current.state.toAct)
              : minStol
        setVantande({
          seq: senasteSeqRef.current + 1,
          giv: lageRef.current?.giv ?? 0,
          typ: drag.typ,
          seat,
          data: drag.typ === 'bud' ? { bid: drag.bid } : { card: drag.card },
        })
      }
      const svar = await skickaDrag(kod, senasteSeqRef.current, drag)
      if (!svar.ok) {
        if (svar.status === 409) await synka() // ikapp — försök igen om det ännu är din tur
        else setFel(svar.fel)
      } else {
        laggTill(svar.events)
        // Det egna draget avtäcks direkt; serverns botsvar går genom kön.
        if (svar.events.length) {
          const mitt = svar.events[0].seq
          setVisadeSeq((prev) => (prev === null ? mitt : Math.max(prev, mitt)))
        }
      }
      setVantande(null)
      setSkickar(false)
    },
    [kod, minStol, laggTill, synka],
  )

  const hoppaOverSvep = useCallback(() => setSweep(null), [])

  const redo = visadeSeq !== null && visadeSeq === senasteSeq && !skickar
  const aktuell = redo && !sweep

  return {
    laddar: visadeSeq === null,
    meta,
    stolar,
    dinHand,
    lage,
    auktion,
    spel,
    sweep,
    fel,
    aktuell,
    redo,
    skickar,
    gorDrag,
    hoppaOverSvep,
  }
}
