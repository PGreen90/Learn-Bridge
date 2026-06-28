import { useEffect, useState, type ReactNode } from 'react'
import type { Card, Deal, Hand, Rank, Seat, Suit } from '../types/bridge'
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
import { dealForPlay } from '../lib/engine/auction-contract'
import { botCard } from '../lib/engine/play-bot'
import { SuitSymbol } from '../components/SuitSymbol'
import { PlayingCard } from '../components/PlayingCard'
import { AuctionView } from '../components/AuctionView'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'

// Grundordning som ALTERNERAR svart/röd för läsbarhet: ♠ ♦ ♣ ♥
// (svart-röd-svart-röd). Ordningen är cyklisk (♥ → ♠ alternerar också), så den
// kan roteras med trumfen i valfri ände utan att alterneringen bryts.
// Inom varje färg ligger högsta kortet till vänster.
const DISPLAY_SUITS: Suit[] = ['spades', 'diamonds', 'clubs', 'hearts']
const RANK_HIGH_TO_LOW: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

interface Game {
  deal: Deal
  contract: Contract
  /** Hela budföljden bakom kontraktet (null = ingen auktion, sällsynt fallback). */
  calls: ResolvedCall[] | null
  play: PlayState
}

function newGame(): Game {
  const { deal, contract, calls } = dealForPlay()
  return { deal, contract, calls, play: startPlay(deal, contract) }
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

/** Korten i en hand, sorterade per färg (S H R K) och högst → lägst. */
function bySuit(hand: Card[], suit: Suit): Card[] {
  return hand
    .filter((c) => c.suit === suit)
    .sort((a, b) => RANK_HIGH_TO_LOW.indexOf(a.rank) - RANK_HIGH_TO_LOW.indexOf(b.rank))
}

/**
 * Färgernas ordning på en plats, sett från Syds (din) vy – med trumfen på
 * spelförarens högra hand precis som vid ett riktigt bord:
 *  - Nord/Syd (uppe/nere): trumfen längst till HÖGER.
 *  - Öst (sida): trumfen NEDERST (= spelföraren Väst:s höger).
 *  - Väst (sida): trumfen ÖVERST (= spelföraren Öst:s höger).
 * Sang (NT) → ingen trumf, vanlig ordning ♠ ♥ ♣ ♦.
 */
function orderedSuits(seat: Seat, contract: Contract): Suit[] {
  const trump = contract.strain === 'NT' ? null : (contract.strain as Suit)
  if (!trump) return DISPLAY_SUITS
  const i = DISPLAY_SUITS.indexOf(trump)
  // Rotera den alternerande cykeln så trumfen hamnar i rätt ände:
  //  - Väst (sidoträkarl): trumfen ÖVERST → trumfen först i ordningen.
  //  - Övriga: trumfen i andra änden (HÖGER för Nord/Syd, NEDERST för Öst).
  return seat === 'W'
    ? [...DISPLAY_SUITS.slice(i), ...DISPLAY_SUITS.slice(0, i)]
    : [...DISPLAY_SUITS.slice(i + 1), ...DISPLAY_SUITS.slice(0, i + 1)]
}

export function Play() {
  const [game, setGame] = useState<Game>(newGame)
  const [showAuction, setShowAuction] = useState(false)
  const { contract, play } = game

  // Bottarna spelar automatiskt när det är deras tur (liten fördröjning).
  useEffect(() => {
    if (isComplete(play) || controls(contract, play.toAct)) return
    const id = setTimeout(() => {
      setGame((g) => {
        if (isComplete(g.play) || controls(g.contract, g.play.toAct)) return g
        return { ...g, play: playCard(g.play, botCard(g.play, g.play.toAct)) }
      })
    }, 750)
    return () => clearTimeout(id)
  }, [game, contract, play])

  function onPlay(card: Card) {
    setGame((g) => {
      if (isComplete(g.play) || !controls(g.contract, g.play.toAct)) return g
      if (!legalCards(g.play, g.play.toAct).some((c) => sameCard(c, card))) return g
      return { ...g, play: playCard(g.play, card) }
    })
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

  const seatProps = { game, isFaceUp, onPlay }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold mb-1">Spela kort</h1>
        <p className="text-slate-600 text-sm">
          Du sitter <strong>Syd</strong> och spelar mot datorn. Spelar din sida ut
          kontraktet styr du både Syd och träkarlen Nord; försvarar du spelar du
          bara Syd. Klicka ett kort när det är din tur.
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
          <Button onClick={() => setGame(newGame())}>Ny giv →</Button>
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
      </Panel>

      {/* Hur kontraktet bjöds fram – återskapad budgivning, hopfälld som standard. */}
      {game.calls && (
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
              <AuctionView
                calls={game.calls}
                dealer={game.deal.dealer}
                vulnerability={game.deal.vulnerability}
              />
            </div>
          )}
        </Panel>
      )}

      {/* Det gröna filtbordet: Nord uppe, Väst/mitten/Öst, Syd nere (du).
          Allt centreras och hålls innanför filtkanten. */}
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
  game,
  isFaceUp,
  onPlay,
}: {
  seat: Seat
  game: Game
  isFaceUp: (s: Seat) => boolean
  onPlay: (c: Card) => void
}) {
  const { contract, play } = game
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

  // En kort-cell: spelbar (klickbar) eller bara visad. `gap` = ev. överlapp-marginal.
  const card = (c: Card, prevInGroup: boolean, gap: string): ReactNode => {
    const playable = myTurn && legalSet.has(`${c.suit}${c.rank}`)
    return (
      <PlayingCard
        key={`${c.suit}${c.rank}`}
        card={c}
        size={size}
        playable={playable}
        dimmed={myTurn && !playable}
        onClick={playable ? () => onPlay(c) : undefined}
        className={prevInGroup ? gap : ''}
      />
    )
  }

  let body: ReactNode
  if (!faceUp) {
    body = <FanBacks count={hand.length} />
  } else if (showDummy) {
    body = <DummyHand seat={seat} contract={contract} hand={hand} card={card} />
  } else {
    body = (
      <div className="flex items-end gap-1">
        {orderedSuits(seat, contract).map((suit) => {
          const cards = bySuit(hand, suit)
          if (cards.length === 0) return null
          return (
            <div key={suit} className="flex">
              {cards.map((c, i) => card(c, i > 0, overlap))}
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
}: {
  seat: Seat
  contract: Contract
  hand: Hand
  card: (c: Card, prevInGroup: boolean, gap: string) => ReactNode
}) {
  const vertical = seat === 'E' || seat === 'W'
  const groups = orderedSuits(seat, contract)
    .map((suit) => ({ suit, cards: bySuit(hand, suit) }))
    .filter((g) => g.cards.length > 0)

  if (vertical) {
    return (
      <div className="flex flex-col gap-1">
        {groups.map(({ suit, cards }) => (
          <div key={suit} className="flex">
            {cards.map((c, i) => card(c, i > 0, '-ml-4'))}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="flex items-end gap-1.5">
      {groups.map(({ suit, cards }) => (
        <div key={suit} className="flex">
          {cards.map((c, i) => card(c, i > 0, '-ml-4'))}
        </div>
      ))}
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
