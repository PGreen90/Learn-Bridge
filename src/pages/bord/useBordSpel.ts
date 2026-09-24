// Beslut B etapp 4 (4B) — spelvyns synk mot bordets händelselogg.
//
// Tre inflöden av händelser, samma hantering (dedupe på seq + sortering):
//  1. drag-svaret (egna drag + serverns botsvar — den agerande får dem direkt),
//  2. realtidsprenumerationen (latenssocker),
//  3. hjärtslaget (HJARTSLAG_MS) — auktoritativt, bordet fungerar utan realtid.
//
// PRESENTATIONSKÖN: servern spelar alla botdrag på en gång, men klienten visar
// dem i bordets tempo — `visadeSeq` är läskursorn, och nästa händelse avtäcks
// efter sin paus (bud/kort) eller direkt (övrigt). Egna drag avtäcks omedelbart.
// Sticksvepet pausar kön (som i det lokala spelet).
//
// TAKTEN (träkarlens eftersläpning, fix 2026-08-18): en passiv spelare
// (träkarlen, vars kort spelas av spelföraren) fick korten i långsam bot-takt,
// ett i taget, och halkade efter stick för stick. Boten: andras kort avtäcks nu
// i en snabb utjämningstakt (`bordKort` ≈ realtid) — tömningen är mycket
// snabbare än en människa hinner producera kort, så vyn ligger aldrig efter. Se
// `avtackningsPaus`. (En tidigare "snabbspola ikapp"-variant slog fel: är du
// träkarl med tre bottar spelar servern HELA given i ett svep, och då kollapsade
// allt till en blink. Den togs bort — den snabba takten räcker, och en hel
// bot-given ritas nu upp i lugn takt precis som i spelet mot datorn.)
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
  type BordBegaran,
  type BordDragInput,
  type BordHandelse,
  type BordMeta,
  type BordStol,
} from '../../lib/backend/bord'
import { ms, sweepHoldMs, type PlaySpeed } from '../play/tempo'
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

// Tätare hjärtslag = kortare värsta-falls-släp om realtidskanalen hackar (den
// passiva stolen har ingen annan snabb väg). Ofarligt: närvarodomarens trösklar
// är 45/60 s och hjärtslagets botframdrivning är PK-vaktad + kräver >2 s stiltje.
const HJARTSLAG_MS = 2_500

/** Pausen (ms) innan nästa köade händelse avtäcks. Egna drag avtäcks direkt;
 *  andras kort i en snabb utjämningstakt (`bordKort` — realtidskänsla, inte bot-
 *  tänketid) som håller även en passiv träkarl ikapp en snabb spelförare; andras
 *  bud budDelay (auktionen ska gå att läsa); resultat en uttoning. Stick-pausen
 *  (vem vann?) ligger separat i sweep-effekten. */
export function avtackningsPaus(nasta: BordHandelse, egen: boolean, tempo: PlaySpeed): number {
  // Läge 2:s autobud (motorns färdiga auktion) bläddras i snabb takt.
  const auto = nasta.typ === 'bud' && (nasta.data as { auto?: boolean }).auto === true
  if (nasta.typ === 'bud') return egen ? 0 : auto ? 300 : ms('budDelay', tempo)
  if (nasta.typ === 'kort') return egen ? 0 : ms('bordKort', tempo)
  if (nasta.typ === 'giv-klar' || nasta.typ === 'facit') return ms('resultOutro', tempo)
  // Claim-frågan (2026-09-19): ett andetag efter att sista sticket svepts undan.
  if (nasta.typ === 'claim-forslag') return ms('claimBeat', tempo)
  return 0
}

/** Leder JAG nästa stick vid bordet (stickväntan 2026-09-14)? Vinnaren i
 *  VISUELLA stolar (jag är alltid Syd): min egen stol, eller träkarlen när jag
 *  är spelförare. Som träkarl spelar jag aldrig (spelföraren styr min hand) →
 *  ingen väntan. Ren funktion — facit i stickvantan.test.tsx. */
export function jagLederNasta(declarerV: Seat, winnerV: Seat): boolean {
  if (declarerV === 'S') return winnerV === 'S' || winnerV === 'N'
  if (declarerV === 'N') return false
  return winnerV === 'S'
}

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
  /** Väntande paus-/lämna-begäranden (4C) — ägarens banner. */
  begaranden: BordBegaran[]
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
  /** Stickväntan: gå vidare från ett vilande stick (tryck på stickytan,
   *  mellanslag/Enter) — svepet startar direkt, även under botens paus. */
  gaVidareSvep: () => void
  /** Ensam människa + träkarl + bot som spelförare: hoppa din vy direkt till
   *  resultatet. Hela given ligger redan färdigspelad i loggen (bara bottar) —
   *  ett rent vy-hopp som flyttar läskursorn till loggens huvud, inget resultat
   *  ändras och ingen annan påverkas. */
  hoppaTillResultat: () => void
  /** Finns oavtäckta händelser kvar i loggen (kön har mer att visa)? Styr när
   *  "Hoppa till resultat" är meningsfull. */
  harOspeladLogg: boolean
}

export function useBordSpel(
  kod: string,
  minStol: Seat,
  tempo: PlaySpeed,
  /** Kortflygningen (2026-09-24, samma som spelbordet): anropas SYNKRONT strax
   *  innan ett kort avtäcks i vyn — egna kort före det optimistiska draget,
   *  andras när presentationskön släpper fram händelsen — så vyn hinner mäta
   *  källkortet i handen innan det försvinner därifrån. Stolen är den VERKLIGA. */
  onKort?: (seat: Seat, card: Card) => void,
): BordSpelet {
  const onKortRef = useRef(onKort)
  onKortRef.current = onKort
  const [events, setEvents] = useState<BordHandelse[]>([])
  const [senasteSeq, setSenasteSeq] = useState(0)
  const [visadeSeq, setVisadeSeq] = useState<number | null>(null)
  const [dinHand, setDinHand] = useState<Card[] | null>(null)
  const [grundStallning, setGrundStallning] = useState({ ns: 0, ew: 0 })
  const [meta, setMeta] = useState<BordMeta | null>(null)
  const [stolar, setStolar] = useState<BordStol[]>([])
  const [begaranden, setBegaranden] = useState<BordBegaran[]>([])
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
    setBegaranden(svar.begaranden ?? [])
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

  // Stol-/närvarohändelser (4C: paus, lämna, bot-övertag, ägarbyte, bord-slut)
  // → hämta om stolarna/meta/begärandena så namnraden och bannern är färska.
  const STOL_TYPER = useMemo(
    () =>
      new Set(['stol', 'paus-begaran', 'paus-svar', 'lamna-begaran', 'lamna-svar', 'agarbyte', 'bord-slut']),
    [],
  )
  const senasteStolHandelse = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      if (STOL_TYPER.has(events[i].typ)) return events[i].seq
    }
    return 0
  }, [events, STOL_TYPER])
  const hamtadStolHandelse = useRef(0)
  useEffect(() => {
    if (senasteStolHandelse > hamtadStolHandelse.current) {
      hamtadStolHandelse.current = senasteStolHandelse
      void synka()
    }
  }, [senasteStolHandelse, synka])

  // Presentationskön: avtäck nästa händelse efter sin paus. Pausad under svep.
  useEffect(() => {
    if (visadeSeq === null) return
    const nasta = events.find((e) => e.seq > visadeSeq)
    if (!nasta) return
    if (sweep?.phase === 'vanta') {
      // Sticket väntar på MITT tryck, men loggen har redan nästa kort (boten
      // tog min stol vid frånvaro, eller jag spelade från en annan flik) →
      // sticket är över på riktigt: svep och gå vidare utan tryck.
      if (nasta.typ === 'kort') setSweep({ trick: sweep.trick, phase: 'slide' })
      // Claimen är föreslagen (2026-09-19): sticket väntar inte på mitt tryck —
      // bot-pausen med ringen, sedan svep, sedan frågan (som i Spela kort).
      if (nasta.typ === 'claim-forslag') setSweep({ trick: sweep.trick, phase: 'hold', holdMs: sweepHoldMs(tempo) })
      return
    }
    if (sweep) return
    const egen = (nasta.typ === 'bud' || nasta.typ === 'kort') && nasta.seat === minStol
    const paus = avtackningsPaus(nasta, egen, tempo)
    const id = setTimeout(() => {
      if (nasta.typ === 'kort' && nasta.seat) onKortRef.current?.(nasta.seat, (nasta.data as { card: Card }).card)
      setVisadeSeq(nasta.seq)
    }, paus)
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
      // Stickväntan (2026-09-14): leder JAG nästa stick väntar sticket på mitt
      // tryck ('vanta'); annars bot-pausen SWEEP_HOLD (ringen fylls) och svep ('hold'). Sista
      // sticket har ingen nästa ledare → 'hold' (giv-klar kommer av sig själv).
      const sista = spel.state.completedTricks.length === 13
      const vanta = !sista && jagLederNasta(spel.state.contract.declarer, trick.winner)
      setSweep(vanta ? { trick, phase: 'vanta' } : { trick, phase: 'hold', holdMs: sweepHoldMs(tempo) })
    }
    settKort.current = n
  }, [lage?.kort.length, spel, tempo])

  // Svepets fasmaskin (samma som usePlayTable): hold → slide → borta på
  // timers; 'vanta' tänder handen efter sweepHint och står sedan stilla tills
  // gaVidareSvep/hoppaOverSvep (eller kön ser nästa kort, ovan).
  useEffect(() => {
    if (!sweep) return
    if (sweep.phase === 'hold') {
      const id = setTimeout(() => setSweep({ trick: sweep.trick, phase: 'slide' }), sweep.holdMs ?? sweepHoldMs(tempo))
      return () => clearTimeout(id)
    }
    if (sweep.phase === 'vanta') {
      if (sweep.hint) return
      const id = setTimeout(() => setSweep({ trick: sweep.trick, phase: 'vanta', hint: true }), ms('sweepHint', tempo))
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setSweep(null), ms('sweepSlide', tempo))
    return () => clearTimeout(id)
  }, [sweep, tempo])

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
        if (drag.typ === 'kort') onKortRef.current?.(seat, drag.card)
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
  const gaVidareSvep = useCallback(
    () => setSweep((s) => (s && s.phase !== 'slide' ? { trick: s.trick, phase: 'slide' } : s)),
    [],
  )
  // Ensam människa som träkarl: hoppa direkt till resultatet — given är redan
  // färdigspelad av bottarna i loggen, så det räcker att flytta läskursorn till
  // huvudet (och släppa ett eventuellt pågående svep).
  const hoppaTillResultat = useCallback(() => {
    setVisadeSeq(senasteSeqRef.current)
    setSweep(null)
  }, [])

  const redo = visadeSeq !== null && visadeSeq === senasteSeq && !skickar
  const aktuell = redo && !sweep
  const harOspeladLogg = visadeSeq !== null && visadeSeq < senasteSeq

  return {
    laddar: visadeSeq === null,
    meta,
    stolar,
    begaranden,
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
    gaVidareSvep,
    hoppaTillResultat,
    harOspeladLogg,
  }
}
