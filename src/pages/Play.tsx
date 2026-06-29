import { useEffect, useState, type ReactNode } from 'react'
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
import { doubleDummyDeclarerRemaining } from '../lib/engine/dds'
import { botCard } from '../lib/engine/play-bot'
import { SuitSymbol } from '../components/SuitSymbol'
import { PlayingCard } from '../components/PlayingCard'
import { PlayReplay } from '../components/PlayReplay'
import { AuctionView } from '../components/AuctionView'
import { BiddingBox } from '../components/BiddingBox'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { bySuit, orderedSuits, DISPLAY_SUITS } from '../lib/cardLayout'

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

function strainSymbol(contract: Contract) {
  return contract.strain === 'NT' ? <>NT</> : <SuitSymbol suit={contract.strain} />
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

  // När budgivningen är klar och gav ett kontrakt → gå till spelfasen.
  useEffect(() => {
    if (game.phase !== 'bidding' || !complete) return
    const contract = contractFromCalls(game.history)
    if (!contract) return // passades ut – hanteras i budvyn
    setGame((g) => ({ ...g, phase: 'play', contract }))
  }, [game, complete])

  function onBid(bid: Bid) {
    setGame((g) => {
      if (g.phase !== 'bidding') return g
      if (seatToAct(g.deal.dealer, g.history.length) !== 'S') return g
      if (!legalCalls(g.history, 'S').includes(bid)) return g
      return { ...g, history: [...g.history, { seat: 'S', bid }] }
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
      onNewGame={() => setGame(newGame())}
    />
  )
}

// ===========================================================================
// Budfasen: din hand, budgivningen som växer fram, och budlådan när det är din tur.
// ===========================================================================

function BiddingPhase({
  game,
  complete,
  onBid,
  onNewGame,
}: {
  game: Game
  complete: boolean
  onBid: (bid: Bid) => void
  onNewGame: () => void
}) {
  const toAct = seatToAct(game.deal.dealer, game.history.length)
  const yourTurn = !complete && toAct === 'S'
  const passedOut = complete && !contractFromCalls(game.history)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold mb-1">Spela kort</h1>
        <p className="text-slate-600 text-sm">
          Du sitter <strong>Syd</strong>. Först budar ni fram kontraktet: när det är
          din tur <strong>klickar du ditt bud</strong> i budlådan, datorn sköter
          Väst, Nord och Öst. När budgivningen är klar börjar kortspelet.
        </p>
      </header>

      <Panel className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">Budgivning</span>
          <Button variant="secondary" onClick={onNewGame}>
            Ny giv →
          </Button>
        </div>
        <p className="mt-2 text-sm">
          {passedOut ? (
            <span className="text-slate-500">Ingen öppnade – given passades ut. Ta en ny giv.</span>
          ) : yourTurn ? (
            <span className="text-emerald-700 font-medium">Din tur att bjuda.</span>
          ) : (
            <span className="text-slate-400">Datorn budar … ({SEAT_LABEL[toAct]})</span>
          )}
        </p>
      </Panel>

      {/* Budgivningen som växer fram, plats för plats. */}
      {game.history.length > 0 && (
        <div className="flex justify-center">
          <AuctionView
            calls={game.history}
            dealer={game.deal.dealer}
            vulnerability={game.deal.vulnerability}
          />
        </div>
      )}

      {/* Grönt filt: din hand öppen, de andra som baksidor. Aktiv plats markeras. */}
      <div
        className="overflow-hidden rounded-3xl border border-emerald-950/30 px-4 py-5 sm:px-8 sm:py-7 shadow-inner"
        style={{ background: 'radial-gradient(circle at 50% 40%, #15795b 0%, #0f5e49 70%, #0b4a3a 100%)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <BiddingSeat seat="N" hand={game.deal.hands.N} active={toAct === 'N'} />
          <div className="flex w-full items-center justify-between gap-2">
            <BiddingSeat seat="W" hand={game.deal.hands.W} active={toAct === 'W'} />
            <BiddingSeat seat="E" hand={game.deal.hands.E} active={toAct === 'E'} />
          </div>
          <BiddingSeat seat="S" hand={game.deal.hands.S} active={toAct === 'S'} />
        </div>
      </div>

      {/* Budlådan – bara när det faktiskt är din tur. */}
      {yourTurn && (
        <Panel className="!p-4">
          <p className="mb-3 text-center text-sm text-slate-600">Ditt bud:</p>
          <BiddingBox legal={legalCalls(game.history, 'S')} onBid={onBid} />
        </Panel>
      )}
    </div>
  )
}

/** En plats i budfasen: namnbricka + handen (Syd öppen och sorterad, övriga baksidor). */
function BiddingSeat({ seat, hand, active }: { seat: Seat; hand: Hand; active: boolean }) {
  const faceUp = seat === 'S'
  const tag = <SeatTag seat={seat} role="" active={active} />
  const body = faceUp ? (
    <div className="flex items-end gap-1">
      {DISPLAY_SUITS.map((suit) => {
        const cards = bySuit(hand, suit)
        if (cards.length === 0) return null
        return (
          <div key={suit} className="flex">
            {cards.map((c, i) => (
              <PlayingCard key={`${c.suit}${c.rank}`} card={c} size="md" className={i > 0 ? '-ml-5' : ''} />
            ))}
          </div>
        )
      })}
    </div>
  ) : (
    <FanBacks count={hand.length} />
  )

  return (
    <div className="flex flex-col items-center gap-1.5">
      {seat !== 'S' && tag}
      {body}
      {seat === 'S' && tag}
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
  const [showAuction, setShowAuction] = useState(false)
  // Facit (double-dummy) för NUVARANDE ställning: tal = spelförarens totala stick
  // med perfekt spel, 'toohard' = för tung just nu, 'idle' = ej beräknat.
  const [facit, setFacit] = useState<number | 'idle' | 'toohard'>('idle')
  // Vald färg i två-klicks-spelet: första klicket väljer (fan ut) färgen,
  // andra klicket på ett kort i den färgen spelar det.
  const [selectedSuit, setSelectedSuit] = useState<Suit | null>(null)

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

  // Bottarna spelar automatiskt när det är deras tur (liten fördröjning).
  useEffect(() => {
    if (isComplete(play) || controls(contract, play.toAct)) return
    const id = setTimeout(() => {
      setPlay((p) => {
        if (isComplete(p) || controls(contract, p.toAct)) return p
        return playCard(p, botCard(p, p.toAct))
      })
    }, 750)
    return () => clearTimeout(id)
  }, [contract, play])

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

  // När given är färdigspelad: fäll ut budgivningen automatiskt så förklaringarna
  // syns vid omspelningen.
  useEffect(() => {
    if (done) setShowAuction(true)
  }, [done])

  const result = contractResult(play)
  const declSide = side(contract.declarer)
  const dummy = dummyOf(contract)
  const openingLeadMade = play.completedTricks.length > 0 || play.currentTrick.length > 0

  function isFaceUp(seat: Seat): boolean {
    if (seat === 'S') return true
    if (declSide === 'NS') return seat === 'N' // vi spelar → se även träkarlen Nord
    return seat === dummy && openingLeadMade // vi försvarar → träkarlen visas efter utspel
  }

  const seatProps = { contract, play, isFaceUp, onCardClick, selectedSuit }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold mb-1">Spela kort</h1>
        <p className="text-slate-600 text-sm">
          Du sitter <strong>Syd</strong> och spelar mot datorn. Spelar din sida ut
          kontraktet styr du både Syd och träkarlen Nord; försvarar du spelar du
          bara Syd. När det är din tur: <strong>tryck en färg</strong> så fanas
          den ut – <strong>klicka sedan kortet</strong> du vill spela.
        </p>
      </header>

      <Panel className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg">
            <span className="text-slate-500 text-sm mr-2">Kontrakt</span>
            <span className="font-bold text-emerald-700">
              {contract.level} {strainSymbol(contract)}
            </span>{' '}
            <span className="text-slate-600">av {SEAT_LABEL[contract.declarer]}</span>
          </div>
          <div className="text-sm text-slate-600">
            N/S: <strong>{play.tricksNS}</strong> · Ö/V: <strong>{play.tricksEW}</strong> stick
            <span className="ml-2 text-slate-400">(behöver {result.needed})</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={showFacit}>
              Visa facit
            </Button>
            <Button onClick={onNewGame}>Ny giv →</Button>
          </div>
        </div>
        <p className="mt-2 text-sm">
          {done ? (
            <span className={result.made ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
              {result.made
                ? `Hemma! ${result.declarerTricks} stick${result.diff > 0 ? ` (+${result.diff})` : ''}.`
                : `${-result.diff} bet (${result.declarerTricks} stick).`}
            </span>
          ) : controls(contract, play.toAct) ? (
            <span className="text-emerald-700 font-medium">Din tur – {SEAT_LABEL[play.toAct]} spelar.</span>
          ) : (
            <span className="text-slate-400">Datorn spelar … ({SEAT_LABEL[play.toAct]})</span>
          )}
        </p>
        {facit !== 'idle' && (
          <p className="mt-1 text-sm">
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
      </Panel>

      {/* Hur kontraktet bjöds fram – den verkliga budgivningen, hopfälld som standard. */}
      <Panel className="!p-4">
        <button
          type="button"
          onClick={() => setShowAuction((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="font-semibold">Budgivningen</span>
          <span className="text-sm text-emerald-700">
            {showAuction ? 'Dölj ▴' : 'Visa hur kontraktet bjöds ▾'}
          </span>
        </button>
        {showAuction && (
          <div className="mt-4 flex justify-center">
            <AuctionView calls={calls} dealer={deal.dealer} vulnerability={deal.vulnerability} />
          </div>
        )}
      </Panel>

      {/* Färdigspelad giv → stegbar omspelning. Annars det gröna filtbordet:
          Nord uppe, Väst/mitten/Öst, Syd nere (du). */}
      {done ? (
        <PlayReplay key={deal.id} deal={deal} contract={contract} tricks={play.completedTricks} />
      ) : (
        <div
          className="overflow-hidden rounded-3xl border border-emerald-950/30 px-4 py-5 sm:px-8 sm:py-7 shadow-inner"
          style={{ background: 'radial-gradient(circle at 50% 40%, #15795b 0%, #0f5e49 70%, #0b4a3a 100%)' }}
        >
          <div className="flex flex-col items-center gap-4">
            <SeatHand seat="N" {...seatProps} />
            <div className="flex w-full items-center justify-between gap-2">
              <SeatHand seat="W" {...seatProps} />
              <TrickView play={play} />
              <SeatHand seat="E" {...seatProps} />
            </div>
            <SeatHand seat="S" {...seatProps} />
          </div>
        </div>
      )}
    </div>
  )
}

/** Liten namnbricka för en plats, med roll och "din tur"-markering. */
function SeatTag({
  seat,
  role,
  active,
}: {
  seat: Seat
  role: '' | 'spelförare' | 'träkarl'
  active: boolean
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? 'bg-amber-300 text-emerald-950 shadow' : 'bg-emerald-950/40 text-emerald-50'
      }`}
    >
      <span>{SEAT_LABEL[seat]}</span>
      {seat === 'S' && <span className="opacity-80">(du)</span>}
      {role && <span className="opacity-70">· {role}</span>}
    </div>
  )
}

/** En plats vid bordet: namnbricka + handen som kortfan (öppen eller baksidor). */
function SeatHand({
  seat,
  contract,
  play,
  isFaceUp,
  onCardClick,
  selectedSuit,
}: {
  seat: Seat
  contract: Contract
  play: PlayState
  isFaceUp: (s: Seat) => boolean
  onCardClick: (c: Card) => void
  selectedSuit: Suit | null
}) {
  const hand = play.hands[seat]
  const faceUp = isFaceUp(seat)
  const isDeclarer = contract.declarer === seat
  const isDummy = dummyOf(contract) === seat
  const myTurn = play.toAct === seat && controls(contract, seat) && !isComplete(play)
  const legal = myTurn ? legalCards(play, seat) : []
  const legalSet = new Set(legal.map((c) => `${c.suit}${c.rank}`))
  // Syd visas störst, övriga öppna händer mellanstora, dolda som små baksidor.
  const size = seat === 'S' ? 'lg' : 'md'
  // Korten trycks ihop så bara hörn-indexet syns (sista kortet i färgen helt).
  const overlap = size === 'lg' ? '-ml-7' : '-ml-5'
  const role = isDeclarer ? 'spelförare' : isDummy ? 'träkarl' : ''
  // Träkarlen (utom Syd, som är din egen hand) läggs upp prydligt som i verkligheten.
  const showDummy = faceUp && isDummy && seat !== 'S'

  // En kort-cell: spelbar (klickbar) eller bara visad. `prevInGroup` lägger på
  // överlapp-marginalen `gap`; i en utfanad färg sätts den till false (kort glesas).
  const card = (c: Card, prevInGroup: boolean, gap: string): ReactNode => {
    const playable = myTurn && legalSet.has(`${c.suit}${c.rank}`)
    return (
      <PlayingCard
        key={`${c.suit}${c.rank}`}
        card={c}
        size={size}
        playable={playable}
        dimmed={myTurn && !playable}
        onClick={playable ? () => onCardClick(c) : undefined}
        className={prevInGroup ? gap : ''}
      />
    )
  }

  // Klassen för en färggrupp: den valda färgen fanas ut (gles + lyft), övriga
  // tonas ned så länge en färg är vald. Bara aktivt på din tur.
  const groupClass = (suit: Suit, vertical: boolean): string => {
    const spread = myTurn && suit === selectedSuit
    const dim = myTurn && selectedSuit !== null && !spread
    return [
      'flex transition-all',
      vertical ? 'flex-col' : '',
      spread ? `${vertical ? 'gap-1' : 'gap-1'} -translate-y-1 scale-105 origin-bottom z-10` : '',
      dim ? 'opacity-50' : '',
    ].join(' ')
  }
  const spreadSuit = (suit: Suit) => myTurn && suit === selectedSuit

  let body: ReactNode
  if (!faceUp) {
    body = <FanBacks count={hand.length} />
  } else if (showDummy) {
    body = (
      <DummyHand seat={seat} contract={contract} hand={hand} card={card} groupClass={groupClass} spreadSuit={spreadSuit} />
    )
  } else {
    body = (
      <div className="flex items-end gap-1">
        {orderedSuits(seat, contract).map((suit) => {
          const cards = bySuit(hand, suit)
          if (cards.length === 0) return null
          const spread = spreadSuit(suit)
          return (
            <div key={suit} className={groupClass(suit, false)}>
              {cards.map((c, i) => card(c, !spread && i > 0, overlap))}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      {seat !== 'S' && <SeatTag seat={seat} role={role} active={myTurn} />}
      {body}
      {seat === 'S' && <SeatTag seat={seat} role={role} active={myTurn} />}
    </div>
  )
}

/**
 * Träkarlens hand upplagd som vid ett riktigt bord: en färg per rad/grupp med
 * trumfen på spelförarens HÖGRA sida sett från spelförarens plats.
 *  - Nord träkarl (Syd spelar): grupper bredvid varandra, trumf längst till höger.
 *  - Öst träkarl (Väst spelar): färger staplade, trumf längst ner (= Västs höger).
 *  - Väst träkarl (Öst spelar): färger staplade, trumf överst (= Östs höger).
 */
function DummyHand({
  seat,
  contract,
  hand,
  card,
  groupClass,
  spreadSuit,
}: {
  seat: Seat
  contract: Contract
  hand: Hand
  card: (c: Card, prevInGroup: boolean, gap: string) => ReactNode
  groupClass: (suit: Suit, vertical: boolean) => string
  spreadSuit: (suit: Suit) => boolean
}) {
  const vertical = seat === 'E' || seat === 'W'
  const groups = orderedSuits(seat, contract)
    .map((suit) => ({ suit, cards: bySuit(hand, suit) }))
    .filter((g) => g.cards.length > 0)

  // Sidoträkarl (Ö/V): färgerna som separata vertikala kolumner sida vid sida
  // (Fun Bridge-stil) → kort överlappar lodrätt med -mt. Nord-träkarl: färgerna
  // som vågräta grupper bredvid varandra → kort överlappar i sidled med -ml.
  return (
    <div className={vertical ? 'flex items-start gap-1.5' : 'flex items-end gap-1.5'}>
      {groups.map(({ suit, cards }) => {
        const spread = spreadSuit(suit)
        return (
          <div key={suit} className={groupClass(suit, vertical)}>
            {cards.map((c, i) => card(c, !spread && i > 0, vertical ? '-mt-6' : '-ml-4'))}
          </div>
        )
      })}
    </div>
  )
}

/** En kompakt solfjäder av baksidor för en dold hand. */
function FanBacks({ count }: { count: number }) {
  return (
    <div className="flex">
      {Array.from({ length: count }).map((_, i) => (
        <PlayingCard key={i} faceDown size="sm" className={i > 0 ? '-ml-4' : ''} />
      ))}
    </div>
  )
}

/** Mitten: korten i pågående stick placerade mot rätt väderstreck. */
function TrickView({ play }: { play: PlayState }) {
  const last =
    play.completedTricks.length > 0 ? play.completedTricks[play.completedTricks.length - 1] : undefined
  const trick: PlayedCard[] = play.currentTrick.length > 0 ? play.currentTrick : last?.cards ?? []
  const winner = play.currentTrick.length === 0 ? last?.winner : undefined
  const at = (seat: Seat) => trick.find((pc) => pc.seat === seat)

  const slot = (seat: Seat, pos: string) => {
    const pc = at(seat)
    return (
      <div className={`absolute ${pos}`}>
        {pc ? (
          <PlayingCard
            card={pc.card}
            size="md"
            className={pc.seat === winner ? 'ring-2 ring-amber-400' : ''}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative h-36 w-36 rounded-2xl bg-emerald-900/25 ring-1 ring-emerald-100/10">
      {trick.length === 0 && (
        <div className="flex h-full items-center justify-center text-xs text-emerald-100/60">
          Sticket
        </div>
      )}
      {slot('N', 'top-1 left-1/2 -translate-x-1/2')}
      {slot('S', 'bottom-1 left-1/2 -translate-x-1/2')}
      {slot('W', 'left-1 top-1/2 -translate-y-1/2')}
      {slot('E', 'right-1 top-1/2 -translate-y-1/2')}
    </div>
  )
}
