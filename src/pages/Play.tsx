import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Bid, Card, Deal, Hand, Seat, Suit } from '../types/bridge'
import { SEAT_LABEL, type ResolvedCall } from '../lib/bidding'
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
  type PlayState,
} from '../lib/engine/play'
import { dealRandom } from '../lib/engine/deal'
import {
  auctionComplete,
  contractFromCalls,
  decideCall,
  legalCalls,
  seatToAct,
} from '../lib/engine/auction-live'
import { interpretCall } from '../lib/engine/auction-interpret'
import { doubleDummyDeclarerRemaining } from '../lib/engine/dds'
import { botCardReasoned, botCardSmartReasoned, usesMonteCarlo } from '../lib/engine/play-bot'
import { hcp } from '../lib/engine/hand'
import { SuitSymbol } from '../components/SuitSymbol'
import { PlayingCard } from '../components/PlayingCard'
import { PlayReplay } from '../components/PlayReplay'
import { AuctionGrid } from '../components/AuctionGrid'
import { BidChip } from '../components/BidChip'
import { SideStack } from '../components/SideStack'
import { CompassPanel } from '../components/CompassPanel'
import { BiddingBox } from '../components/BiddingBox'
import { Button } from '../components/Button'
import { HandFan } from '../components/HandFan'
import { bySuit, handSuitsTrumpFirst } from '../lib/cardLayout'

// En giv går genom två faser: först budgivningen (du klickar Syds bud i budlådan,
// datorn budar V/N/Ö ett i taget runt bordet), sedan kortspelet ur de verkliga
// buden. `contract` är null tills budgivningen är klar.
interface Game {
  deal: Deal
  /** Den levande budföljden, ett bud i taget runt bordet. */
  history: ResolvedCall[]
  phase: 'bidding' | 'play'
  contract: Contract | null
}

function newGame(): Game {
  return { deal: dealRandom(), history: [], phase: 'bidding', contract: null }
}

/** Spelar ägaren (Syd) den här platsen? Vi spelar = både N och S; vi försvarar = bara S. */
function controls(contract: Contract, seat: Seat): boolean {
  return side(contract.declarer) === 'NS' ? side(seat) === 'NS' : seat === 'S'
}

function sameCard(a: Card, b: Card) {
  return a.suit === b.suit && a.rank === b.rank
}

/** Ett kort som text: valör + färgsymbol (t.ex. "K♥"), för "Varför?"-raden. */
function CardLabel({ card }: { card: Card }) {
  return (
    <span className="whitespace-nowrap font-semibold">
      {card.rank}
      <SuitSymbol suit={card.suit} />
    </span>
  )
}

// ===========================================================================
// Fas-styrning: budgivning → spel.
// ===========================================================================

export function Play() {
  const [game, setGame] = useState<Game>(newGame)

  const complete = auctionComplete(game.history)

  // Datorn budar V/N/Ö när det är deras tur (liten fördröjning, som korten).
  useEffect(() => {
    if (game.phase !== 'bidding' || complete) return
    if (seatToAct(game.deal.dealer, game.history.length) === 'S') return // din tur
    const id = setTimeout(() => {
      setGame((g) => {
        if (g.phase !== 'bidding' || auctionComplete(g.history)) return g
        const seat = seatToAct(g.deal.dealer, g.history.length)
        if (seat === 'S') return g
        return { ...g, history: [...g.history, decideCall(g.deal, g.history, seat)] }
      })
    }, 700)
    return () => clearTimeout(id)
  }, [game, complete])

  // Budgivningen klar med kontrakt → ägaren BEKRÄFTAR i den vita dialogen
  // ("1♠ spelas av Syd – Bekräfta", som Synrey) innan kortspelet börjar.
  function confirmContract() {
    setGame((g) => {
      if (g.phase !== 'bidding' || !auctionComplete(g.history)) return g
      const contract = contractFromCalls(g.history)
      if (!contract) return g
      return { ...g, phase: 'play', contract }
    })
  }

  function onBid(bid: Bid) {
    setGame((g) => {
      if (g.phase !== 'bidding') return g
      if (seatToAct(g.deal.dealer, g.history.length) !== 'S') return g
      if (!legalCalls(g.history, 'S').includes(bid)) return g
      // Fäst budets betydelse så det blir klickbart i auktionsvyn. Stämmer ditt
      // bud med motorns systemlinje får det den äkta förklaringen; annars märks
      // det som ett eget bud utanför systemet (motorn kan inte tolka det).
      const sys = decideCall(g.deal, g.history, 'S')
      let call: ResolvedCall
      if (sys.bid === bid) {
        call = { seat: 'S', bid, rule: sys.rule, explanation: sys.explanation ?? 'Motorns rekommenderade bud.' }
      } else {
        // Off-book: motorn föreskriver inte budet, men ska ALLTID kunna tolka det.
        // Tolkningslagret läser auktionen och ger en bästa-möjliga förklaring.
        const interp = interpretCall([...g.history, { seat: 'S', bid }], g.history.length)
        const tag = interp.confidence === 'gissning' ? ' (osäker tolkning)' : ''
        call = { seat: 'S', bid, rule: 'eget bud', explanation: `Eget bud. ${interp.text}${tag}` }
      }
      return { ...g, history: [...g.history, call] }
    })
  }

  if (game.phase === 'play' && game.contract) {
    return (
      <PlayTable
        key={game.deal.id}
        deal={game.deal}
        contract={game.contract}
        calls={game.history}
        onNewGame={() => setGame(newGame())}
      />
    )
  }

  return (
    <BiddingPhase
      game={game}
      complete={complete}
      onBid={onBid}
      onConfirm={confirmContract}
      onNewGame={() => setGame(newGame())}
    />
  )
}

// ===========================================================================
// Budfasen (Synrey-stil): kompass + auktionsrutnät överst, budlådan i mitten,
// din hand som solfjäder längst ner. Motståndarnas kort visas inte alls.
// ===========================================================================

function BiddingPhase({
  game,
  complete,
  onBid,
  onConfirm,
  onNewGame,
}: {
  game: Game
  complete: boolean
  onBid: (bid: Bid) => void
  onConfirm: () => void
  onNewGame: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const toAct = complete ? null : seatToAct(game.deal.dealer, game.history.length)
  const yourTurn = toAct === 'S'
  const finalContract = complete ? contractFromCalls(game.history) : null
  const passedOut = complete && !finalContract
  // Motorns rekommenderade bud för din hand i det här läget (markeras i budlådan
  // och ger den äkta förklaringen för det budet).
  const recommendation = yourTurn ? decideCall(game.deal, game.history, 'S') : null

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-emerald-950/30 shadow-inner"
      style={{ background: 'radial-gradient(circle at 50% 40%, #15795b 0%, #0f5e49 70%, #0b4a3a 100%)' }}
    >
      {/* Överst: kompass (giv + bricka + zon), auktionen och menyknappen. */}
      <div className="flex items-stretch gap-2 p-2.5">
        <CompassPanel dealer={game.deal.dealer} board={game.deal.board} vulnerability={game.deal.vulnerability} />
        <AuctionGrid
          calls={game.history}
          dealer={game.deal.dealer}
          vulnerability={game.deal.vulnerability}
          activeSeat={toAct}
        />
        <TableMenu open={showMenu} onToggle={() => setShowMenu((v) => !v)} onNewGame={onNewGame}>
          Du sitter <strong>Syd</strong>. När din ruta i auktionen lyser är det din tur:
          klicka ett bud i budlådan och bekräfta med <strong>OK</strong>. Datorn sköter
          Väst, Nord och Öst. Klicka ett lagt bud för att se vad det betyder.
        </TableMenu>
      </div>

      {/* Budlådan – alltid synlig; otillåtna/inte-din-tur tonas ner. */}
      <div className="px-2.5 pb-3">
        <BiddingBox
          legal={yourTurn ? legalCalls(game.history, 'S') : []}
          onBid={onBid}
          recommendation={recommendation}
          history={game.history}
        />
      </div>

      {/* Din hand som solfjäder + HCP-bricka (Synrey). */}
      <div className="relative border-t border-emerald-100/10 bg-emerald-950/25 px-2 pb-2.5 pt-3">
        <HandFan hand={game.deal.hands.S} />
        <div className="absolute bottom-2 right-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-xs font-semibold text-white">
          HCP {hcp(game.deal.hands.S)}
        </div>
      </div>

      {/* Kontrakt bjudet: vit bekräftelsedialog (Synreys "Declared by South"). */}
      {finalContract && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30">
          <div className="min-w-60 rounded-xl bg-white p-4 text-center shadow-xl">
            <div className="flex items-center justify-center gap-2 pb-3">
              <BidChip bid={`${finalContract.level}${STRAIN_CODE[finalContract.strain]}`} />
              <span className="text-sm font-medium text-slate-700">
                spelas av {SEAT_LABEL[finalContract.declarer]}
              </span>
            </div>
            <button
              type="button"
              onClick={onConfirm}
              className="w-full border-t border-slate-200 pt-2.5 text-sm font-semibold text-sky-600 hover:text-sky-500"
            >
              Bekräfta
            </button>
          </div>
        </div>
      )}

      {/* Passades given ut: vit dialog (Synrey-stil) med ny giv. */}
      {passedOut && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30">
          <div className="rounded-xl bg-white p-4 text-center shadow-xl">
            <p className="mb-3 text-sm text-slate-700">Ingen öppnade – given passades ut.</p>
            <Button onClick={onNewGame}>Ny giv →</Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Menyknappen (⋮) uppe till höger: expanderar i en overlay med ny giv + hjälp. */
function TableMenu({
  open,
  onToggle,
  onNewGame,
  children,
}: {
  open: boolean
  onToggle: () => void
  onNewGame: () => void
  children: ReactNode
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950/60 text-lg font-bold text-emerald-50 ring-1 ring-emerald-100/10 hover:bg-emerald-950/80"
        aria-label="Meny"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-64 rounded-xl bg-white p-3 shadow-xl ring-1 ring-slate-200">
          <Button className="w-full" onClick={onNewGame}>
            Ny giv →
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-slate-600">{children}</p>
        </div>
      )}
    </div>
  )
}


// ===========================================================================
// Spelfasen: det gröna bordet, korten, facit och omspelningen. Egen komponent så
// att spelfasens hooks bara körs när kontrakt + spelläge finns på riktigt.
// ===========================================================================

// Nodbudget för facit-lösaren: ~2 milj. noder (≈ 1–2 s i värsta fall) så
// gränssnittet aldrig fryser. Sena ställningar (få kort kvar) löses direkt;
// tidiga, tunga ställningar kan returnera null → vi visar ett vänligt meddelande.
const FACIT_BUDGET = 2_000_000

function PlayTable({
  deal,
  contract,
  calls,
  onNewGame,
}: {
  deal: Deal
  contract: Contract
  calls: ResolvedCall[]
  onNewGame: () => void
}) {
  const [play, setPlay] = useState<PlayState>(() => startPlay(deal, contract))
  const [showMenu, setShowMenu] = useState(false)
  // ⓘ-knappen: budgivningen som vit overlay (Synrey-minimalism – inget syns
  // förrän man ber om det).
  const [showInfo, setShowInfo] = useState(false)
  // Resultatdialogen när given är färdigspelad; stängs → omspelningen.
  const [resultSeen, setResultSeen] = useState(false)
  // Facit (double-dummy) för NUVARANDE ställning: tal = spelförarens totala stick
  // med perfekt spel, 'toohard' = för tung just nu, 'idle' = ej beräknat.
  const [facit, setFacit] = useState<number | 'idle' | 'toohard'>('idle')
  // Vald färg i två-klicks-spelet: första klicket väljer (fan ut) färgen,
  // andra klicket på ett kort i den färgen spelar det.
  const [selectedSuit, setSelectedSuit] = useState<Suit | null>(null)
  // Datorns senaste drag + varför (för "Varför?"-knappen). Fälls ut på begäran.
  const [lastBotMove, setLastBotMove] = useState<{ seat: Seat; card: Card; reason: string } | null>(null)
  const [showWhy, setShowWhy] = useState(false)
  // Sant medan bot-hjärnan räknar Monte-Carlo i webworkern (visar "tänker …").
  const [thinking, setThinking] = useState(false)
  // Webworkern som kör den tunga Monte-Carlo-DDS:en av huvudtråden (skapas en gång).
  const workerRef = useRef<Worker | null>(null)
  const reqCounter = useRef(0)

  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('../lib/engine/mc-worker.ts', import.meta.url), { type: 'module' })
    } catch {
      workerRef.current = null // ingen worker (t.ex. äldre miljö) → körs inline i stället
    }
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  // Nollställ facit + färgval så fort ställningen ändras (du eller en bot la ett kort).
  useEffect(() => {
    setFacit('idle')
    setSelectedSuit(null)
  }, [play])

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
    if (isComplete(play) || controls(contract, play.toAct)) return
    const seat = play.toAct
    let cancelled = false

    // Spela det bot-hjärnan valde (med skydd om ställningen hunnit ändras).
    const apply = (choice: { card: Card; reason: string }) => {
      if (cancelled) return
      setThinking(false)
      setLastBotMove({ seat, card: choice.card, reason: choice.reason })
      setShowWhy(false)
      setPlay((p) => {
        if (isComplete(p) || controls(contract, p.toAct)) return p
        const stillLegal = legalCards(p, p.toAct).some((c) => sameCard(c, choice.card))
        return playCard(p, stillLegal ? choice.card : legalCards(p, p.toAct)[0])
      })
    }

    const worker = workerRef.current
    // Snabb tumregel (öppningsutspel / ett kort / över MC-fönstret), eller ingen
    // worker tillgänglig → räkna inline efter en kort paus.
    if (!worker || !usesMonteCarlo(play, seat)) {
      const id = setTimeout(() => apply(botCardSmartReasoned(play, seat, calls)), 750)
      return () => {
        cancelled = true
        clearTimeout(id)
      }
    }

    // Tungt slutspelsbeslut → webworkern. Gränssnittet visar "tänker …".
    setThinking(true)
    const reqId = ++reqCounter.current
    const onMessage = (e: MessageEvent) => {
      if (e.data?.reqId !== reqId) return
      worker.removeEventListener('message', onMessage)
      clearTimeout(timeoutId)
      if (e.data.error || !e.data.card) apply(botCardReasoned(play, seat)) // fallback: tumregel
      else apply({ card: e.data.card as Card, reason: e.data.reason as string })
    }
    // Skydd: om workern skulle hänga orimligt länge, falla tillbaka på tumregeln.
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
      setThinking(false)
    }
  }, [contract, play, calls])

  function onPlay(card: Card) {
    setPlay((p) => {
      if (isComplete(p) || !controls(contract, p.toAct)) return p
      if (!legalCards(p, p.toAct).some((c) => sameCard(c, card))) return p
      return playCard(p, card)
    })
  }

  // Två-klicks: första klicket på ett kort väljer (och fanar ut) dess färg;
  // klick på ett kort i den redan valda färgen spelar kortet.
  function onCardClick(card: Card) {
    if (selectedSuit !== card.suit) {
      setSelectedSuit(card.suit)
      return
    }
    onPlay(card)
    setSelectedSuit(null)
  }

  const done = isComplete(play)
  const result = contractResult(play)
  const declSide = side(contract.declarer)
  const dummy = dummyOf(contract)
  const openingLeadMade = play.completedTricks.length > 0 || play.currentTrick.length > 0

  function isFaceUp(seat: Seat): boolean {
    if (seat === 'S') return true
    if (declSide === 'NS') return seat === 'N' // vi spelar → se även träkarlen Nord
    return seat === dummy && openingLeadMade // vi försvarar → träkarlen visas efter utspel
  }

  // Färdigspelad giv: resultatdialog ovanpå, sedan omspelningen (Synrey-stil).
  if (done) {
    return (
      <div className="relative">
        <PlayReplay key={deal.id} deal={deal} contract={contract} tricks={play.completedTricks} calls={calls} />
        {!resultSeen ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-black/30">
            <div className="rounded-xl bg-white p-5 text-center shadow-xl">
              <p className={`mb-4 text-lg font-semibold ${result.made ? 'text-emerald-700' : 'text-red-600'}`}>
                {result.made
                  ? `Hemma! ${result.declarerTricks} stick${result.diff > 0 ? ` (+${result.diff})` : ''}.`
                  : `${-result.diff} bet (${result.declarerTricks} stick).`}
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="secondary" onClick={() => setResultSeen(true)}>
                  Se omspelningen
                </Button>
                <Button onClick={onNewGame}>Ny giv →</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex justify-center">
            <Button onClick={onNewGame}>Ny giv →</Button>
          </div>
        )}
      </div>
    )
  }

  // Vem ligger öppen var? Nord-sidans öppna hand visas som färgkolumner uppe
  // (träkarlen när du spelar, eller spelföraren Nord när Syd är träkarl); en
  // Ö/V-träkarl som lodrät stapel på sin sida. Dolda händer visas INTE alls.
  const northOpen = isFaceUp('N')
  const westOpen = isFaceUp('W')
  const eastOpen = isFaceUp('E')

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-emerald-950/30 shadow-inner"
      style={{ background: 'radial-gradient(circle at 50% 40%, #15795b 0%, #0f5e49 70%, #0b4a3a 100%)' }}
    >
      {/* ⓘ (budgivningen) + ⋮ (meny) uppe till höger. */}
      <div className="absolute right-2.5 top-2.5 z-20 flex gap-1.5">
        <button
          type="button"
          onClick={() => {
            setShowInfo((v) => !v)
            setShowMenu(false)
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950/60 text-sm font-bold text-emerald-50 ring-1 ring-emerald-100/10 hover:bg-emerald-950/80"
          aria-label="Budgivningen"
        >
          i
        </button>
        <button
          type="button"
          onClick={() => {
            setShowMenu((v) => !v)
            setShowInfo(false)
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950/60 text-lg font-bold text-emerald-50 ring-1 ring-emerald-100/10 hover:bg-emerald-950/80"
          aria-label="Meny"
        >
          ⋮
        </button>
      </div>

      {/* Meny-overlay: ny giv, facit och hjälp – inget av det stör bordet annars. */}
      {showMenu && (
        <div className="absolute right-2.5 top-13 z-30 w-72 rounded-xl bg-white p-3 shadow-xl ring-1 ring-slate-200">
          <div className="flex gap-2">
            <Button className="flex-1" onClick={onNewGame}>
              Ny giv →
            </Button>
            <Button variant="secondary" className="flex-1" onClick={showFacit}>
              Visa facit
            </Button>
          </div>
          {facit !== 'idle' && (
            <p className="mt-2 text-xs leading-relaxed">
              {facit === 'toohard' ? (
                <span className="text-slate-500">
                  Facit: ställningen är för tung att räkna snabbt just nu – prova igen längre in i given.
                </span>
              ) : (
                <span className="text-sky-700">
                  Facit (perfekt spel): spelföraren tar totalt <strong>{facit}</strong> stick härifrån —{' '}
                  {facit >= result.needed
                    ? `kontraktet håller${facit > result.needed ? ` (+${facit - result.needed})` : ''}.`
                    : `${result.needed - facit} bet.`}
                </span>
              )}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-600">
            Kontraktet är <strong>{contract.level}{STRAIN_CODE[contract.strain] === 'NT' ? 'NT' : ''}</strong>
            {STRAIN_CODE[contract.strain] !== 'NT' && <SuitSymbol suit={contract.strain as Suit} />} av{' '}
            {SEAT_LABEL[contract.declarer]} (behöver {result.needed} stick). Tummen visar vems tur det är.
            När det är din tur: tryck en färg så lyfts den – klicka sedan kortet du vill spela.
          </p>
        </div>
      )}

      {/* ⓘ-overlay: budgivningen som ledde till kontraktet (klickbara förklaringar). */}
      {showInfo && (
        <div className="absolute left-1/2 top-13 z-30 w-full max-w-sm -translate-x-1/2 px-3">
          <div className="rounded-xl bg-white p-2 shadow-xl ring-1 ring-slate-200">
            <AuctionGrid calls={calls} dealer={deal.dealer} vulnerability={deal.vulnerability} />
          </div>
        </div>
      )}

      {/* Nord-sidans öppna hand som färgkolumner (trumf längst till vänster). */}
      <div className="flex min-h-16 justify-center pt-3">
        {northOpen && (
          <SuitColumns
            hand={play.hands.N}
            contract={contract}
            play={play}
            seat="N"
            onCardClick={onCardClick}
            selectedSuit={selectedSuit}
          />
        )}
      </div>

      {/* Mittraden: ev. V/Ö-träkarl på sin sida + sticket i mitten. */}
      <div className="flex items-center justify-between gap-1 px-2 py-2">
        <div className="w-10 shrink-0">
          {westOpen && <SideStack cards={sideCards(play.hands.W, contract)} side="W" />}
        </div>
        <TrickCenterLive play={play} thinking={thinking} />
        <div className="w-10 shrink-0">
          {eastOpen && <SideStack cards={sideCards(play.hands.E, contract)} side="E" />}
        </div>
      </div>

      {/* Bricka + zon nere till vänster. */}
      <div className="px-3 pb-2 text-xs leading-tight text-emerald-50/90">
        <div>Bricka {deal.board}</div>
        <div>{VUL_TEXT[deal.vulnerability]}</div>
      </div>

      {/* Svarta listen: kontraktet + ställningen. */}
      <div className="flex justify-center pb-1.5">
        <div className="flex items-center gap-2 rounded-lg bg-slate-900/85 px-3 py-1 shadow">
          <BidChip bid={`${contract.level}${STRAIN_CODE[contract.strain]}`} />
          <span className="text-sm font-semibold text-white">
            NS:{play.tricksNS} ÖV:{play.tricksEW}
          </span>
          <span className="text-xs text-slate-400">mål {result.needed}</span>
        </div>
      </div>

      {/* "Varför?" – datorns senaste kort, förklaring på begäran (minimalism). */}
      {lastBotMove && (
        <p className="px-4 pb-1.5 text-center text-xs text-emerald-50/80">
          {SEAT_LABEL[lastBotMove.seat]} spelade <CardLabel card={lastBotMove.card} />{' '}
          <button
            type="button"
            onClick={() => setShowWhy((v) => !v)}
            className="font-semibold text-yellow-200 hover:underline"
          >
            {showWhy ? 'Dölj' : 'Varför?'}
          </button>
          {showWhy && <span className="ml-1">{lastBotMove.reason}</span>}
        </p>
      )}

      {/* Din hand som solfjäder längst ner (trumf längst till vänster). */}
      <div className="border-t border-emerald-100/10 bg-emerald-950/25 px-2 pb-2.5 pt-3">
        <SouthFan
          hand={play.hands.S}
          contract={contract}
          play={play}
          onCardClick={onCardClick}
          selectedSuit={selectedSuit}
        />
      </div>
    </div>
  )
}

const VUL_TEXT: Record<Deal['vulnerability'], string> = {
  none: 'Ingen i zon',
  ns: 'NS i zon',
  ew: 'ÖV i zon',
  all: 'Alla i zon',
}

const STRAIN_CODE: Record<string, string> = {
  clubs: 'C',
  diamonds: 'D',
  hearts: 'H',
  spades: 'S',
  NT: 'NT',
}

/** Får platsen spela just nu, styrd av dig? (för klickbarhet + markering) */
function turnInfo(play: PlayState, contract: Contract, seat: Seat) {
  const myTurn = play.toAct === seat && controls(contract, seat) && !isComplete(play)
  const legal = myTurn ? legalCards(play, seat) : []
  return { myTurn, legalSet: new Set(legal.map((c) => `${c.suit}${c.rank}`)) }
}

/**
 * En öppen hand som färgkolumner (Synrey-träkarlen): en lodrät kolumn per färg,
 * trumfen i vänstra kolumnen, högsta kortet överst. Två-klicks-spelet: klick i
 * en färg väljer (lyfter) kolumnen, klick i vald färg spelar kortet.
 */
function SuitColumns({
  hand,
  contract,
  play,
  seat,
  onCardClick,
  selectedSuit,
}: {
  hand: Hand
  contract: Contract
  play: PlayState
  seat: Seat
  onCardClick: (c: Card) => void
  selectedSuit: Suit | null
}) {
  const { myTurn, legalSet } = turnInfo(play, contract, seat)
  return (
    <div className="flex items-start justify-center gap-1.5">
      {handSuitsTrumpFirst(contract.strain).map((suit) => {
        const cards = bySuit(hand, suit)
        if (cards.length === 0) return null
        const spread = myTurn && suit === selectedSuit
        const dim = myTurn && selectedSuit !== null && !spread
        return (
          <div
            key={suit}
            className={`flex flex-col transition-all ${spread ? '-translate-y-1 z-10' : ''} ${dim ? 'opacity-50' : ''}`}
          >
            {cards.map((c, i) => {
              const playable = myTurn && legalSet.has(`${c.suit}${c.rank}`)
              return (
                <PlayingCard
                  key={`${c.suit}${c.rank}`}
                  card={c}
                  size="sm"
                  playable={playable}
                  dimmed={myTurn && !playable}
                  onClick={playable ? () => onCardClick(c) : undefined}
                  className={i > 0 ? '-mt-7' : ''}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** En Ö/V-träkarls kort i visningsordning (trumf överst) för SideStack. */
function sideCards(hand: Hand, contract: Contract): Card[] {
  return handSuitsTrumpFirst(contract.strain).flatMap((suit) => bySuit(hand, suit))
}

/** Din hand som solfjäder (Syd): färggrupper, vald färg lyfts, trumf vänster. */
function SouthFan({
  hand,
  contract,
  play,
  onCardClick,
  selectedSuit,
}: {
  hand: Hand
  contract: Contract
  play: PlayState
  onCardClick: (c: Card) => void
  selectedSuit: Suit | null
}) {
  const { myTurn, legalSet } = turnInfo(play, contract, 'S')
  return (
    <div className="flex items-end justify-center">
      {handSuitsTrumpFirst(contract.strain).map((suit) => {
        const cards = bySuit(hand, suit)
        if (cards.length === 0) return null
        const spread = myTurn && suit === selectedSuit
        const dim = myTurn && selectedSuit !== null && !spread
        return (
          <div
            key={suit}
            className={`flex transition-all ${spread ? 'gap-1 -translate-y-1.5 z-10 mx-1' : ''} ${dim ? 'opacity-50' : ''}`}
          >
            {cards.map((c, i) => {
              const playable = myTurn && legalSet.has(`${c.suit}${c.rank}`)
              return (
                <PlayingCard
                  key={`${c.suit}${c.rank}`}
                  card={c}
                  size="md"
                  playable={playable}
                  dimmed={myTurn && !playable}
                  onClick={playable ? () => onCardClick(c) : undefined}
                  className={!spread && i > 0 ? '-ml-6' : ''}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** Sticket i mitten (live): mörk platta, väderstrecken runt om — tummen 👍 visar
 *  vems tur det är (pulserar när bot-hjärnan räknar). Mellan sticken ligger det
 *  senast vunna sticket kvar med vinnarkortet gulmarkerat. */
function TrickCenterLive({ play, thinking }: { play: PlayState; thinking: boolean }) {
  const last =
    play.completedTricks.length > 0 ? play.completedTricks[play.completedTricks.length - 1] : undefined
  const trick: PlayedCard[] = play.currentTrick.length > 0 ? play.currentTrick : last?.cards ?? []
  const winner = play.currentTrick.length === 0 ? last?.winner : undefined
  const at = (seat: Seat) => trick.find((pc) => pc.seat === seat)
  const toAct = isComplete(play) ? null : play.toAct

  const card = (seat: Seat, pos: string, rotate = '') => {
    const pc = at(seat)
    if (!pc) return null
    return (
      <div className={`absolute ${pos} ${rotate} replay-card-in`}>
        <PlayingCard card={pc.card} size="sm" className={winner === seat ? 'ring-2 ring-amber-400' : ''} />
      </div>
    )
  }
  const letter = (seat: Seat, label: string, pos: string) => (
    <span className={`absolute ${pos} flex items-center gap-0.5 text-sm font-semibold text-yellow-300`}>
      {toAct === seat && (
        <span className={thinking ? 'animate-pulse' : ''} title={thinking ? 'Bot-hjärnan räknar …' : 'Ska spela'}>
          👍
        </span>
      )}
      {label}
    </span>
  )

  return (
    <div className="relative h-44 w-40 shrink-0">
      <div className="absolute left-1/2 top-1/2 h-24 w-20 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-emerald-950/50 ring-1 ring-emerald-100/10" />
      {letter('N', 'N', 'top-4 left-1/2 -translate-x-1/2')}
      {letter('S', 'S', 'bottom-4 left-1/2 -translate-x-1/2')}
      {letter('W', 'V', 'left-4 top-1/2 -translate-y-1/2')}
      {letter('E', 'Ö', 'right-4 top-1/2 -translate-y-1/2')}
      {card('N', 'top-0 left-1/2 -translate-x-1/2')}
      {card('S', 'bottom-0 left-1/2 -translate-x-1/2')}
      {card('W', 'left-0 top-1/2 -translate-y-1/2', 'rotate-90')}
      {card('E', 'right-0 top-1/2 -translate-y-1/2', '-rotate-90')}
    </div>
  )
}
