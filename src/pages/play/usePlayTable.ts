// Spelfasens hjärna som en hook: kortspels-tillståndet, bottarnas spel (inkl.
// Monte-Carlo-webworkern), claim/auto-claim, facit och två-klicks-valet.
// PlayTable-komponenten är bara presentation ovanpå det här.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Card, Deal, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../../lib/bidding'
import {
  contractResult,
  dummyOf,
  isComplete,
  legalCards,
  playCard,
  side,
  startPlay,
  type Contract,
  type PlayedCard,
  type PlayResult,
  type PlayState,
} from '../../lib/engine/play'
import type { Sweep } from './common'
import {
  adjudicateClaim,
  autoClaimAvailable,
  declarerTricksWon,
  remainingTricks,
} from '../../lib/engine/claim'
import { loadValue, saveValue } from '../../lib/storage'
import { scoreLine } from '../../lib/engine/scoring'
import { doubleDummyDeclarerRemaining } from '../../lib/engine/dds'
import { botCardReasoned, botCardSmartReasoned, usesMonteCarlo } from '../../lib/engine/play-bot'
import { controls, sameCard } from './common'
import { ms, type PlaySpeed } from './tempo'
import { useCardFlight } from './useCardFlight'
import { isSoundEnabled, playSound, setSoundEnabled } from '../../lib/sound'

// Nodbudget för facit-lösaren: ~2 milj. noder (≈ 1–2 s i värsta fall) så
// gränssnittet aldrig fryser. Sena ställningar (få kort kvar) löses direkt;
// tidiga, tunga ställningar kan returnera null → vi visar ett vänligt meddelande.
const FACIT_BUDGET = 2_000_000

export function usePlayTable(deal: Deal, contract: Contract, calls: ResolvedCall[]) {
  const [play, setPlay] = useState<PlayState>(() => startPlay(deal, contract))
  const [showMenu, setShowMenu] = useState(false)
  // ⓘ-knappen: budgivningen som overlay (Synrey-minimalism – inget syns
  // förrän man ber om det).
  const [showInfo, setShowInfo] = useState(false)
  // Resultatdialogen när given är färdigspelad; stängs → omspelningen.
  const [resultSeen, setResultSeen] = useState(false)
  // Felrapport-dialogen ("Kändes given rätt?") — nås från resultatdialogen.
  const [reporting, setReporting] = useState(false)
  // Rondgenomgången (etapp 2): hela given förklarad i kapitel — nås från
  // resultatdialogen och raden under omspelningen.
  const [reviewing, setReviewing] = useState(false)
  // Facit (double-dummy) för NUVARANDE ställning: tal = spelförarens totala stick
  // med perfekt spel, 'toohard' = för tung just nu, 'idle' = ej beräknat.
  const [facit, setFacit] = useState<number | 'idle' | 'toohard'>('idle')
  // Vald färg i två-klicks-spelet: första klicket väljer (fan ut) färgen,
  // andra klicket på ett kort i den färgen spelar det.
  const [selectedSuit, setSelectedSuit] = useState<Suit | null>(null)
  // Claim (ägarönskemål 2026-07-03): `claimed` avslutar given med det claimade
  // resultatet i stället för att spela ut resten. `claiming` = dialogen öppen,
  // `claimMsg` = "Claim nekad"-beskedet, `autoClaim` = av/på-valet (sparas).
  const [claimed, setClaimed] = useState<{ total: number; auto: boolean } | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)
  // Claim-reveal (etapp 5, "känsla i kortspelet", ägarbeslut 2026-07-28): en
  // godkänd claim (manuell eller auto) landar FÖRST här — alla händer läggs
  // upp öppet och LIGGER KVAR, precis som vid ett riktigt bord, tills spelaren
  // själv går vidare med knappen (finishClaimReveal). Ingen timer. Botarna
  // pausar under revealen.
  const [pendingClaim, setPendingClaim] = useState<{ total: number; auto: boolean } | null>(null)
  // Resultatövergången (etapp 5): när given är klar tonar bordet ut i
  // ms('resultOutro') innan resultatvyn tar över — inget hårt klipp.
  const [showResult, setShowResult] = useState(false)
  const [autoClaim, setAutoClaim] = useState<boolean>(() => loadValue('autoClaim', true))
  // Tempot (ägarbeslut 2026-07-28): Lugn/Normal/Snabb i ⋮-menyn skalar alla
  // botpauser och animationslängder (via tempo.ts + --motion-scale). Sparas.
  const [speed, setSpeedState] = useState<PlaySpeed>(() => loadValue('playSpeed', 'normal'))
  // Ljuden (etapp 4, "känsla i kortspelet"): diskreta syntetiserade kortljud,
  // standard PÅ, toggle i ⋮-menyn. Sparas under learnbridge:sound.
  const [sound, setSoundState] = useState<boolean>(() => isSoundEnabled())
  // Sticksvepet (etapp 2, "känsla i kortspelet"): när ett stick blir klart
  // ligger korten kvar med vinnarglow ('hold'), sveps sedan mot vinnaren
  // ('slide') och försvinner. Botarna och auto-claim VÄNTAR under svepet;
  // ett klick (kort eller stickytan) hoppar över det — otåliga blockeras aldrig.
  const [sweep, setSweep] = useState<Sweep | null>(null)
  // Ref-jämförelse (inte effekt-på-play rakt av) så StrictMode-dubbelkörningen
  // i dev inte startar svepet två gånger.
  const sweptCount = useRef(0)
  // Kortflygningen (etapp 3): var kortet startade + vilket kort som är i luften.
  // Källan MÅSTE mätas synkront innan setPlay — efteråt är kortet borta ur handen.
  const { flight, beginFlight, endFlight, registerCardEl, wasFlown } = useCardFlight()
  // Bottarnas motiveringar per spelat kort (kortnyckel → plats + varför).
  // Tryck på ett spelat kort på bordet visar förklaringen i raden under listen.
  const [botReasons, setBotReasons] = useState<Record<string, { seat: Seat; reason: string }>>({})
  const [explain, setExplain] = useState<{ seat: Seat; card: Card; reason: string } | null>(null)
  // Sant medan bot-hjärnan räknar Monte-Carlo i webworkern (visar "tänker …").
  const [thinking, setThinking] = useState(false)
  // Webworkern som kör den tunga Monte-Carlo-DDS:en av huvudtråden (skapas en gång).
  const workerRef = useRef<Worker | null>(null)
  const reqCounter = useRef(0)

  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('../../lib/engine/mc-worker.ts', import.meta.url), { type: 'module' })
    } catch {
      workerRef.current = null // ingen worker (t.ex. äldre miljö) → körs inline i stället
    }
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  // Nollställ facit + färgval + öppen kortförklaring så fort ställningen ändras
  // (du eller en bot la ett kort).
  useEffect(() => {
    setFacit('idle')
    setSelectedSuit(null)
    setExplain(null)
  }, [play])

  // Sticksvepet startar när ett NYTT stick blivit klart (motorn har redan tömt
  // currentTrick och bokfört sticket — svepet är ren UI-fas ovanpå).
  // Layout-effekt (inte vanlig effekt): svepet ska stå i mitten redan i samma
  // bildruta som fjärde kortet bokförs — annars blinkar mitten tom en ruta och
  // fjärde kortets flygning hittar aldrig sin landningsplats.
  useLayoutEffect(() => {
    const n = play.completedTricks.length
    if (n <= sweptCount.current) return
    sweptCount.current = n
    setSweep({ trick: play.completedTricks[n - 1], phase: 'hold' })
  }, [play])

  // Svepets fasmaskin: hold (vinnarglow) → slide (svepet) → borta. Rena
  // setTimeout (aldrig rAF) så fake timers i testerna styr den deterministiskt.
  useEffect(() => {
    if (!sweep) return
    if (sweep.phase === 'hold') {
      const id = setTimeout(() => setSweep({ trick: sweep.trick, phase: 'slide' }), ms('sweepHold', speed))
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setSweep(null), ms('sweepSlide', speed))
    return () => clearTimeout(id)
  }, [sweep, speed])

  /** Hoppa över svepet direkt (klick på kort eller stickytan). */
  function skipSweep() {
    setSweep(null)
  }

  /** Gå vidare från claim-revealen (knappen på bordet): committa claimen och
   *  avsluta given. Enda vägen framåt — korten ligger kvar tills spelaren valt. */
  function finishClaimReveal() {
    if (!pendingClaim) return
    setClaimed(pendingClaim)
    setPendingClaim(null)
  }

  // Kortknäppen: EN krok som fångar både människans och botens kort — totala
  // antalet spelade kort växer med varje lagt kort (även fjärde: 3 → 4 när
  // sticket bokförs). Ref-jämförelsen gör den StrictMode-säker och tyst vid
  // tempo-/ljudväxlingar (antalet är då oförändrat).
  const heardCount = useRef(0)
  useEffect(() => {
    const n = play.completedTricks.length * 4 + play.currentTrick.length
    if (n > heardCount.current && sound) playSound('card')
    heardCount.current = n
  }, [play, sound])

  // Svischet: när svepet går in i slide-fasen. Ref på sticket (inte fasen) så
  // StrictMode-dubbelkörningen inte dubblar ljudet.
  const sweptSoundFor = useRef<unknown>(null)
  useEffect(() => {
    if (sweep?.phase !== 'slide') return
    if (sweptSoundFor.current === sweep.trick) return
    sweptSoundFor.current = sweep.trick
    if (sound) playSound('sweep')
  }, [sweep, sound])

  // Giv-klar-ticken: när utdelningskaskaden lagt sista kortet (bara vid mount —
  // brickan delas ut en gång). Ljudvalet läses via ref så av-slag hinner verka.
  const soundRef = useRef(sound)
  soundRef.current = sound
  useEffect(() => {
    const id = setTimeout(() => {
      if (soundRef.current) playSound('deal')
    }, ms('dealSoundDelay', speed))
    return () => clearTimeout(id)
  }, []) // avsiktligt mount-only: given delas ut en gång per bord

  function showFacit() {
    const rem = doubleDummyDeclarerRemaining(
      play.hands,
      contract.strain,
      contract.declarer,
      play.currentTrick,
      play.toAct,
      FACIT_BUDGET,
    )
    if (rem === null) {
      setFacit('toohard')
      return
    }
    const declWon = side(contract.declarer) === 'NS' ? play.tricksNS : play.tricksEW
    setFacit(declWon + rem)
  }

  // Bottarna spelar automatiskt när det är deras tur. Tunga Monte-Carlo-beslut
  // (slutspelet) räknas i webworkern så gränssnittet inte fryser; snabba tumregler
  // körs inline med en liten paus för känsla.
  useEffect(() => {
    // Bottarna pausar när en claim är lagd (given är slut), under claim-
    // revealen (händerna ligger uppe — inget får ändras), medan claim-dialogen
    // är öppen (ställningen får inte ändras under bedömningen) och under
    // sticksvepet (nästa kort får inte landa mitt i insamlingen).
    if (claimed || pendingClaim || claiming || sweep || isComplete(play) || controls(contract, play.toAct)) return
    const seat = play.toAct
    let cancelled = false

    // Spela det bot-hjärnan valde (med skydd om ställningen hunnit ändras).
    const apply = (choice: { card: Card; reason: string }) => {
      if (cancelled) return
      setThinking(false)
      // Kortet som faktiskt läggs (fallback om valet hunnit bli olagligt) +
      // motiveringen sparas så kortet kan förklaras med ett tryck på bordet.
      const legal = legalCards(play, seat)
      const card = legal.some((c) => sameCard(c, choice.card)) ? choice.card : legal[0]
      setBotReasons((m) => ({ ...m, [`${card.suit}${card.rank}`]: { seat, reason: choice.reason } }))
      // Flygningen mäts FÖRE setPlay: en öppen träkarl (SideStack/kolumnerna)
      // ger källrutan, en dold hand startar från bordskanten.
      beginFlight(seat, card)
      setPlay((p) => {
        if (isComplete(p) || controls(contract, p.toAct)) return p
        const stillLegal = legalCards(p, p.toAct).some((c) => sameCard(c, card))
        return playCard(p, stillLegal ? card : legalCards(p, p.toAct)[0])
      })
    }

    const worker = workerRef.current
    // Snabb tumregel (öppningsutspel / ett kort / över MC-fönstret), eller ingen
    // worker tillgänglig → räkna inline efter en kort paus.
    if (!worker || !usesMonteCarlo(play, seat)) {
      const id = setTimeout(() => apply(botCardSmartReasoned(play, seat, calls)), ms('botDelay', speed))
      return () => {
        cancelled = true
        clearTimeout(id)
      }
    }

    // Tungt slutspelsbeslut → webworkern. Gränssnittet visar "tänker …".
    // Golvet (mcFloor): ett blixtsnabbt worker-svar hålls tillbaka så kortet
    // inte teleporterar in — svaret läggs tidigast efter golvtiden.
    setThinking(true)
    const t0 = Date.now()
    let floorId: ReturnType<typeof setTimeout> | undefined
    const reqId = ++reqCounter.current
    const onMessage = (e: MessageEvent) => {
      if (e.data?.reqId !== reqId) return
      worker.removeEventListener('message', onMessage)
      clearTimeout(timeoutId)
      const wait = Math.max(0, ms('mcFloor', speed) - (Date.now() - t0))
      floorId = setTimeout(() => {
        if (e.data.error || !e.data.card) apply(botCardReasoned(play, seat)) // fallback: tumregel
        else apply({ card: e.data.card as Card, reason: e.data.reason as string })
      }, wait)
    }
    // Skydd: om workern skulle hänga orimligt länge, falla tillbaka på tumregeln.
    // Skalas INTE av tempot — det är en nödbroms, inte en paus.
    const timeoutId = setTimeout(() => {
      worker.removeEventListener('message', onMessage)
      apply(botCardReasoned(play, seat))
    }, 15000)
    worker.addEventListener('message', onMessage)
    worker.postMessage({ reqId, state: play, seat, calls })

    return () => {
      cancelled = true
      worker.removeEventListener('message', onMessage)
      clearTimeout(timeoutId)
      clearTimeout(floorId)
      setThinking(false)
    }
  }, [contract, play, calls, claimed, pendingClaim, claiming, speed, sweep])

  // Auto Claim: när ett nytt stick ska börja och spelförarsidan OMÖJLIGT kan
  // förlora fler stick (oavsett spelsätt) stängs given automatiskt – gäller både
  // när du är spelförare och när datorn är det. Slås av/på i ⋮-menyn.
  useEffect(() => {
    // Väntar även ut sticksvepet — resultatet ska inte dyka upp mitt i svepet.
    if (!autoClaim || claimed || pendingClaim || claiming || sweep || isComplete(play)) return
    if (play.currentTrick.length > 0) return
    if (!autoClaimAvailable(play)) return
    // Via claim-revealen (etapp 5): händerna visas öppet innan given avslutas.
    setPendingClaim({ total: declarerTricksWon(play) + remainingTricks(play), auto: true })
  }, [play, autoClaim, claimed, pendingClaim, claiming, sweep])

  function onPlay(card: Card) {
    // Samma villkor som uppdateraren nedan — flygningen ska bara starta när
    // kortet faktiskt kommer att spelas, och källan måste mätas före setPlay.
    if (
      !claimed &&
      !pendingClaim &&
      !isComplete(play) &&
      controls(contract, play.toAct) &&
      legalCards(play, play.toAct).some((c) => sameCard(c, card))
    ) {
      beginFlight(play.toAct, card)
    }
    setPlay((p) => {
      if (claimed || pendingClaim || isComplete(p) || !controls(contract, p.toAct)) return p
      if (!legalCards(p, p.toAct).some((c) => sameCard(c, card))) return p
      return playCard(p, card)
    })
  }

  // Manuell claim: du anger sidans TOTALA stick i given; DDS-lösaren dömer om
  // de går att säkra mot bästa motspel. Godkänd → given avslutas. Nekad → spela
  // vidare. "Oavgjord" = ställningen är för tung att räkna just nu.
  function onClaim(total: number) {
    const v = adjudicateClaim(play, total, FACIT_BUDGET)
    if (v.verdict === 'godkänd') {
      // Via claim-revealen (etapp 5): händerna visas öppet innan given avslutas.
      setPendingClaim({ total, auto: false })
      setClaiming(false)
      setClaimMsg(null)
    } else if (v.verdict === 'nekad') {
      setClaimMsg(`Claim nekad — ${total} stick går inte att säkra mot bästa motspel. Spela vidare!`)
    } else {
      setClaimMsg('Ställningen är för tung att kontrollera just nu — spela något stick till och försök igen.')
    }
  }

  function toggleAutoClaim() {
    const next = !autoClaim
    setAutoClaim(next)
    saveValue('autoClaim', next)
  }

  function setSpeed(next: PlaySpeed) {
    setSpeedState(next)
    saveValue('playSpeed', next)
  }

  function toggleSound() {
    const next = !sound
    setSoundState(next)
    setSoundEnabled(next)
  }

  // Två-klicks: första klicket på ett kort väljer (och fanar ut) dess färg;
  // klick på ett kort i den redan valda färgen spelar kortet. Ett klick under
  // sticksvepet hoppar dessutom över svepet (otåliga blockeras aldrig).
  function onCardClick(card: Card) {
    // Under claim-revealen ligger korten stilla — bara Gå vidare-knappen verkar.
    if (pendingClaim) return
    skipSweep()
    if (selectedSuit !== card.suit) {
      setSelectedSuit(card.suit)
      return
    }
    onPlay(card)
    setSelectedSuit(null)
  }

  // Tryck på ett SPELAT kort på bordet (sticket i mitten eller förra sticket):
  // botens motivering visas i raden under listen; samma kort igen stänger.
  const reasonFor = (pc: PlayedCard) => botReasons[`${pc.card.suit}${pc.card.rank}`]
  function onPlayedCardClick(pc: PlayedCard) {
    const info = reasonFor(pc)
    if (!info) return
    setExplain((e) =>
      e && sameCard(e.card, pc.card) ? null : { seat: pc.seat, card: pc.card, reason: info.reason },
    )
  }

  // En godkänd claim (manuell eller auto) avslutar given med det claimade
  // resultatet — de ospelade sticken bokförs enligt claimen. Sista sticket får
  // sitt svep innan resultatet visas (done väntar ut sweep), och claim-revealen
  // hålls öppen tills den committat (pendingClaim → claimed).
  const done = (isComplete(play) || claimed !== null) && sweep === null

  // Resultatövergången: när done slår till tonar bordet ut (felt-fade-out i
  // Play.tsx) och först efter ms('resultOutro') byts trädet till resultatvyn.
  // (Effekten ligger här för att done beräknas strax ovanför.)
  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => setShowResult(true), ms('resultOutro', speed))
    return () => clearTimeout(id)
  }, [done, speed])
  const needed = 6 + contract.level
  const result: PlayResult = claimed
    ? {
        declarerTricks: claimed.total,
        needed,
        made: claimed.total >= needed,
        diff: claimed.total - needed,
      }
    : contractResult(play)
  const declSide = side(contract.declarer)
  // Poängen för given (ägarens poängguide): vem som fick dem + hur många,
  // t.ex. "Ö/V +420". Zonen kommer från brickan.
  const score = done ? scoreLine(contract, result.declarerTricks, deal.vulnerability) : null
  const dummy = dummyOf(contract)
  const openingLeadMade = play.completedTricks.length > 0 || play.currentTrick.length > 0

  function isFaceUp(seat: Seat): boolean {
    // Claim-reveal (och bordets uttoning direkt efter): ALLA händer ligger
    // öppna — som när korten läggs upp vid ett riktigt bord.
    if (pendingClaim || claimed) return true
    if (seat === 'S') return true
    if (declSide === 'NS') return seat === 'N' // vi spelar → se även träkarlen Nord
    return seat === dummy && openingLeadMade // vi försvarar → träkarlen visas efter utspel
  }

  return {
    play,
    showMenu,
    setShowMenu,
    showInfo,
    setShowInfo,
    resultSeen,
    setResultSeen,
    reporting,
    setReporting,
    reviewing,
    setReviewing,
    facit,
    showFacit,
    selectedSuit,
    claimed,
    claiming,
    setClaiming,
    claimMsg,
    setClaimMsg,
    autoClaim,
    toggleAutoClaim,
    pendingClaim,
    finishClaimReveal,
    showResult,
    speed,
    setSpeed,
    sound,
    toggleSound,
    sweep,
    skipSweep,
    flight,
    endFlight,
    registerCardEl,
    wasFlown,
    explain,
    botReasons,
    reasonFor,
    thinking,
    onClaim,
    onCardClick,
    onPlayedCardClick,
    done,
    result,
    score,
    declSide,
    isFaceUp,
  }
}
