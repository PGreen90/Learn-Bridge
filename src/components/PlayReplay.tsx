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
import { bySuit, FLAT_OVERLAP, handSuitsTrumpFirst } from '../lib/cardLayout'
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
  explanations = 'full',
}: {
  deal: Deal
  contract: Contract
  tricks: Trick[]
  calls: ResolvedCall[]
  /** Budstöd av → 'minimal': auktionsvyn visar bara chip + regelnamn + ALERT. */
  explanations?: 'full' | 'minimal'
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
    // Full skärm som spelbordet (mobil-fix 2026-08-12): duken fyller hela
    // skärmen och Nord får notch-säker toppmarginal — förr låg Nords kort under
    // urtaget på iPhone. Alla händer ritas med de FASTA xl-korten (64×96,
    // kortstorleksregeln 2026-08-02) — omspelningen var sista vyn med småkort.
    <Felt className="flex min-h-[100dvh] w-full flex-col rounded-none border-transparent shadow-none">
      {/* Nord: sammanhängande kortrad överst (samma look som Syd i spelfasen). */}
      <div className="flex justify-center pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <Fan cards={handCards('N')} />
      </div>

      {/* Mittraden: Väst | mitten (auktion/stick) | Öst. flex-1 centrerar
          lodrätt så outnyttjad skärmhöjd fördelas runt mitten. Med xl-staplarna
          (96 px per sida) får mitten ~170 px på en 375-mobil: stickytan (160)
          och den täta auktionen (dense) är byggda att rymmas där. */}
      <div className="flex flex-1 items-center justify-between gap-1 px-1 py-2">
        <SideStack cards={handCards('W')} side="W" xl />
        <div className="flex min-h-44 min-w-0 flex-1 items-center justify-center">
          {shownCards ? (
            <TrickCenter cards={shownCards} winner={shownWinner} />
          ) : (
            <div className="w-full max-w-56">
              <AuctionGrid
                calls={calls}
                dealer={deal.dealer}
                vulnerability={deal.vulnerability}
                explanations={explanations}
                dense
              />
            </div>
          )}
        </div>
        <SideStack cards={handCards('E')} side="E" xl />
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
          {contract.doubled && <span className="text-sm font-bold text-red-400">{contract.doubled}</span>}
          <span className="text-sm font-semibold text-white">
            NS:{tricksNS} ÖV:{tricksEW}
          </span>
        </div>
      </div>

      {/* Syd: din hand + stegpilarna « » (Synrey). px-2 (inte px-12): den fulla
          xl-raden är 349 px bred och behöver hela mobilbredden — pilarna svävar
          i stället OVANPÅ radens hörn (z-10) tills handen krympt. Säker botten-
          marginal (hemindikatorn) nu när duken går edge-to-edge. */}
      <div className="relative border-t border-emerald-100/10 bg-emerald-950/25 px-2 pt-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <Fan cards={handCards('S')} />
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

/** En öppen hand (N/S) som spelbordets sammanhängande kortrad: fasta xl-kort
 *  med det delade FLAT_OVERLAP — 13 kort = 349 px, samma mått som spelfasens
 *  vilande hand (kortstorleksregeln 2026-08-02). min-h-24 = korthöjden, så
 *  raden inte kollapsar när sista kortet spelats. */
function Fan({ cards }: { cards: Card[] }) {
  return (
    <div className="flex min-h-24 justify-center">
      {cards.map((c, i) => (
        <PlayingCard key={key(c)} card={c} size="xl" className={i > 0 ? FLAT_OVERLAP : ''} />
      ))}
    </div>
  )
}

/** Spelat kort glider in från spelarens håll (animationsklasserna i index.css). */
const CARD_IN: Record<Seat, string> = {
  N: 'card-in-n',
  S: 'card-in-s',
  W: 'card-in-w',
  E: 'card-in-e',
}

/** Sticket i mitten: samma kompakta stickHÖG som spelfasens TrickCenterLive
 *  (fasta lg-kort 48×64, 160×160-yta, grannkorten överlappar 25 % och
 *  spelordningen styr z-index) — förr sm-kort på en luftigare yta; nu följer
 *  även omspelningen kortstorleksregeln. Varje nytt kort glider in från sin
 *  spelare. */
function TrickCenter({ cards, winner }: { cards: PlayedCard[]; winner: Seat | null }) {
  const at = (seat: Seat) => cards.find((pc) => pc.seat === seat)
  const card = (seat: Seat, pos: string, rotate = '') => {
    const pc = at(seat)
    if (!pc) return null
    const order = cards.findIndex((p) => p === pc)
    return (
      // key på KORTET (inte platsen): när ett nytt kort landar på samma plats i
      // nästa stick måste DOM-noden bytas, annars tänds inte inglidningen om.
      <div
        key={key(pc.card)}
        className={`absolute ${pos} ${rotate} ${CARD_IN[seat]}`}
        style={{ zIndex: order + 1 }}
      >
        <PlayingCard card={pc.card} size="lg" className={winner === seat ? 'ring-2 ring-amber-400' : ''} />
      </div>
    )
  }
  const letter = (label: string, pos: string) => (
    <span className={`absolute ${pos} text-sm font-semibold text-yellow-300`}>{label}</span>
  )
  return (
    <div className="relative h-40 w-40 shrink-0">
      <div className="absolute left-1/2 top-1/2 h-24 w-20 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-emerald-950/50 ring-1 ring-emerald-100/10" />
      {letter('N', 'top-0 left-1/2 -translate-x-1/2')}
      {letter('S', 'bottom-0 left-1/2 -translate-x-1/2')}
      {letter('V', 'left-1 top-1/2 -translate-y-1/2')}
      {letter('Ö', 'right-1 top-1/2 -translate-y-1/2')}
      {card('N', 'top-6 left-1/2 -translate-x-1/2')}
      {card('S', 'bottom-6 left-1/2 -translate-x-1/2')}
      {card('W', 'left-8 top-1/2 -translate-y-1/2', 'rotate-90')}
      {card('E', 'right-8 top-1/2 -translate-y-1/2', '-rotate-90')}
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
      className={`absolute bottom-[calc(0.625rem+env(safe-area-inset-bottom))] ${side === 'left' ? 'left-2' : 'right-2'} z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/70 text-xl font-bold text-white shadow hover:bg-slate-900/90`}
    >
      {children}
    </button>
  )
}
