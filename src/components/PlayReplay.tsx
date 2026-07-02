// Omspelning av en färdigspelad giv i Synrey-stil (FAS 12, ägarspec 2026-07-02):
// alla fyra händer ligger upplagda runt bordet (N uppe, V/Ö på sidorna som
// lodräta staplar, S nere), trumfen längst till VÄNSTER i varje hand. Mitten
// visar först auktionen; högerpilen (») spelar upp nästa stick ETT KORT I TAGET
// (som i verkligheten) och de spelade korten försvinner ur händerna. Vänsterpilen
// («) stegar tillbaka. Svarta listen visar kontraktet + ställningen NS/ÖV.

import { useEffect, useState } from 'react'
import type { Card, Deal, Seat, Vulnerability } from '../types/bridge'
import type { ResolvedCall } from '../lib/bidding'
import type { Contract, PlayedCard, Trick } from '../lib/engine/play'
import { bySuit, handSuitsTrumpFirst } from '../lib/cardLayout'
import { AuctionGrid } from './AuctionGrid'
import { BidChip } from './BidChip'
import { Felt } from './Felt'
import { PlayingCard } from './PlayingCard'
import { SideStack } from './SideStack'

const key = (c: Card) => `${c.suit}${c.rank}`

const VUL_TEXT: Record<Vulnerability, string> = {
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

export function PlayReplay({
  deal,
  contract,
  tricks,
  calls,
}: {
  deal: Deal
  contract: Contract
  tricks: Trick[]
  calls: ResolvedCall[]
}) {
  // `played` = antal färdigvisade stick. `anim` = hur många kort i NÄSTA stick
  // som hittills lagts på bordet (1–4 under uppspelningen, 0 = ingen uppspelning).
  const [played, setPlayed] = useState(0)
  const [anim, setAnim] = useState(0)

  // Uppspelningen: ett kort i taget med kort paus; när alla fyra ligger, en liten
  // extra paus innan sticket räknas som klart (och nästa hand kan stega vidare).
  useEffect(() => {
    if (anim === 0) return
    const id = setTimeout(
      () => {
        if (anim >= 4) {
          setPlayed((p) => p + 1)
          setAnim(0)
        } else {
          setAnim((a) => a + 1)
        }
      },
      anim >= 4 ? 650 : 380,
    )
    return () => clearTimeout(id)
  }, [anim])

  const next = () => {
    if (anim > 0) {
      // Otålig? Ett tryck till lägger klart sticket direkt.
      setPlayed((p) => p + 1)
      setAnim(0)
      return
    }
    if (played < tricks.length) setAnim(1)
  }
  const prev = () => {
    setAnim(0)
    setPlayed((p) => Math.max(0, p - 1))
  }

  // Korten som redan lämnat händerna: alla färdiga stick + de som hunnit läggas
  // i sticket som spelas upp just nu.
  const gone = new Set<string>()
  tricks.slice(0, played).forEach((t) => t.cards.forEach((pc) => gone.add(key(pc.card))))
  const animTrick = anim > 0 ? tricks[played] : null
  animTrick?.cards.slice(0, anim).forEach((pc) => gone.add(key(pc.card)))

  const suits = handSuitsTrumpFirst(contract.strain)
  const handCards = (seat: Seat): Card[] =>
    suits.flatMap((suit) => bySuit(deal.hands[seat], suit)).filter((c) => !gone.has(key(c)))

  // Mitten: sticket som spelas upp > senast färdiga sticket > auktionen (start).
  const shownCards: PlayedCard[] | null = animTrick
    ? animTrick.cards.slice(0, anim)
    : played > 0
      ? tricks[played - 1].cards
      : null
  const shownWinner = !animTrick && played > 0 ? tricks[played - 1].winner : null

  const tricksNS = tricks.slice(0, played).filter((t) => t.winner === 'N' || t.winner === 'S').length
  const tricksEW = played - tricksNS

  return (
    <Felt>
      {/* Nord: vågrät solfjäder överst. */}
      <div className="flex justify-center pt-3">
        <Fan cards={handCards('N')} size="sm" overlap="-ml-5" />
      </div>

      {/* Mittraden: Väst | mitten (auktion/stick) | Öst. */}
      <div className="flex items-center justify-between gap-1 px-2 py-3">
        <SideStack cards={handCards('W')} side="W" />
        <div className="flex min-h-44 flex-1 items-center justify-center">
          {shownCards ? (
            <TrickCenter cards={shownCards} winner={shownWinner} />
          ) : (
            <div className="w-full max-w-xs">
              <AuctionGrid calls={calls} dealer={deal.dealer} vulnerability={deal.vulnerability} />
            </div>
          )}
        </div>
        <SideStack cards={handCards('E')} side="E" />
      </div>

      {/* Bricka + zon nere till vänster (Synrey). */}
      <div className="px-3 pb-2 text-xs leading-tight text-emerald-50/90">
        <div>Bricka {deal.board}</div>
        <div>{VUL_TEXT[deal.vulnerability]}</div>
      </div>

      {/* Svarta listen: kontraktet som chip + ställningen. */}
      <div className="flex justify-center pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-slate-900/85 px-3 py-1 shadow">
          <BidChip bid={`${contract.level}${STRAIN_CODE[contract.strain]}`} />
          <span className="text-sm font-semibold text-white">
            NS:{tricksNS} ÖV:{tricksEW}
          </span>
        </div>
      </div>

      {/* Syd: din hand + stegpilarna « » (Synrey). */}
      <div className="relative border-t border-emerald-100/10 bg-emerald-950/25 px-12 pb-2.5 pt-3">
        <Fan cards={handCards('S')} size="md" overlap="-ml-6" />
        {played > 0 && (
          <ArrowButton side="left" onClick={prev} label="Föregående stick">
            «
          </ArrowButton>
        )}
        {(played < tricks.length || anim > 0) && (
          <ArrowButton side="right" onClick={next} label="Nästa stick">
            »
          </ArrowButton>
        )}
      </div>
    </Felt>
  )
}

/** En vågrät solfjäder av öppna kort (N/S). */
function Fan({ cards, size, overlap }: { cards: Card[]; size: 'sm' | 'md'; overlap: string }) {
  return (
    <div className="flex min-h-10 justify-center">
      {cards.map((c, i) => (
        <PlayingCard key={key(c)} card={c} size={size} className={i > 0 ? overlap : ''} />
      ))}
    </div>
  )
}

/** Sticket i mitten: mörk platta, väderstrecken runt om, korten lagda mot sin
 *  plats (V/Ö på tvären) — varje nytt kort landar med en liten animation. */
function TrickCenter({ cards, winner }: { cards: PlayedCard[]; winner: Seat | null }) {
  const at = (seat: Seat) => cards.find((pc) => pc.seat === seat)
  const card = (seat: Seat, pos: string, rotate = '') => {
    const pc = at(seat)
    if (!pc) return null
    return (
      <div className={`absolute ${pos} ${rotate} replay-card-in`}>
        <PlayingCard card={pc.card} size="sm" className={winner === seat ? 'ring-2 ring-amber-400' : ''} />
      </div>
    )
  }
  const letter = (label: string, pos: string) => (
    <span className={`absolute ${pos} text-sm font-semibold text-yellow-300`}>{label}</span>
  )
  return (
    <div className="relative h-44 w-40">
      <div className="absolute left-1/2 top-1/2 h-24 w-20 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-emerald-950/50 ring-1 ring-emerald-100/10" />
      {letter('N', 'top-4 left-1/2 -translate-x-1/2')}
      {letter('S', 'bottom-4 left-1/2 -translate-x-1/2')}
      {letter('V', 'left-5 top-1/2 -translate-y-1/2')}
      {letter('Ö', 'right-5 top-1/2 -translate-y-1/2')}
      {card('N', 'top-0 left-1/2 -translate-x-1/2')}
      {card('S', 'bottom-0 left-1/2 -translate-x-1/2')}
      {card('W', 'left-1 top-1/2 -translate-y-1/2', 'rotate-90')}
      {card('E', 'right-1 top-1/2 -translate-y-1/2', '-rotate-90')}
    </div>
  )
}

/** Stegpil (« ») i Synrey-stil: mörk rundad knapp i hörnet av Syd-remsan. */
function ArrowButton({
  side,
  onClick,
  label,
  children,
}: {
  side: 'left' | 'right'
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute bottom-3 ${side === 'left' ? 'left-2' : 'right-2'} flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/70 text-xl font-bold text-white shadow hover:bg-slate-900/90`}
    >
      {children}
    </button>
  )
}
