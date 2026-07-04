import { useEffect, useMemo, useState } from 'react'
import type { Deal, Hand, Seat } from '../types/bridge'
import { SEAT_LABEL, type ResolvedCall } from '../lib/bidding'
import { dealRandom } from '../lib/engine/deal'
import { classifyOpening, isVulnerable } from '../lib/engine/openings'
import { dealWithAuction } from '../lib/engine/auction'
import { auctionComplete, contractFromCalls, decideCall, seatToAct } from '../lib/engine/auction-live'
import { hcp } from '../lib/engine/hand'
import { surveyOpenings, surveyResponses, type OpeningSurvey, type ResponseSurvey } from '../lib/engine/survey'
import { bySuit, HAND_SUITS } from '../lib/cardLayout'
import { HandView } from '../components/HandView'
import { AuctionGrid } from '../components/AuctionGrid'
import { BidChip } from '../components/BidChip'
import { Felt } from '../components/Felt'
import { HandFan } from '../components/HandFan'
import { SideStack } from '../components/SideStack'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { SuitText } from '../components/SuitText'
import { FelrapportDialog } from '../components/FelrapportDialog'
import { BIDDING_REPORT_CATEGORIES } from '../lib/felrapport'

// Budvisningen (omgjord 2026-07-02, ägarbeslut: "så likt Spela kort som
// möjligt"): ETT grönt bord med alla fyra händer öppna — Nord solfjäder uppe,
// Väst/Öst som vridna sidostaplar, Syd solfjäder nere — och auktionen i mitten.
// Buden läggs ett i taget i samma takt som när datorn budar i Spela kort;
// klick på ett lagt bud ger förklaringen (kravnivå + ALERT) i vita popupen.
// Poänguträkningar och hålfinnarna ligger hopfällda under bordet.

/**
 * Hela budgivningen via den LEVANDE budmotorn (samma som Spela kort): varje
 * plats bjuder i tur och ordning tills auktionen är slut. Motorn har alltid
 * ett bud (on-book, off-book-fortsättning eller pass) — auktionen dör aldrig
 * halvvägs som gamla ideallinje-byggaren kunde göra.
 */
function buildFullAuction(deal: Deal): ResolvedCall[] {
  const history: ResolvedCall[] = []
  let guard = 0
  while (!auctionComplete(history) && guard++ < 80) {
    history.push(decideCall(deal, history, seatToAct(deal.dealer, history.length)))
  }
  return history
}

/** Partnern mittemot. */
const PARTNER: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }

/** En hands kort i solfjäderordning (♠ ♥ ♣ ♦, som HandFan) för sidostaplarna. */
function fanCards(hand: Hand) {
  return HAND_SUITS.flatMap((suit) => bySuit(hand, suit))
}

/** Liten mörk hp-bricka (som HCP-brickan i Spela kort). */
function HpTag({ label, hand }: { label: string; hand: Hand }) {
  return (
    <span className="rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
      {label} {hcp(hand)} hp
    </span>
  )
}

export function Spela() {
  const [deal, setDeal] = useState<Deal>(() => dealRandom())
  const [openSurvey, setOpenSurvey] = useState<OpeningSurvey | null>(null)
  const [respSurvey, setRespSurvey] = useState<ResponseSurvey | null>(null)
  // Antal bud som hittills lagts på bordet (uppspelningen).
  const [shown, setShown] = useState(0)
  // Felrapport-dialogen (samma som i Spela kort): öppnas när auktionen är klar.
  const [reporting, setReporting] = useState(false)

  const calls = useMemo(() => buildFullAuction(deal), [deal])
  // Slutkontraktet ur den färdiga auktionen (null = given passades ut) — följer
  // med felrapporten så den blir lika komplett som en rapport från Spela kort.
  const contract = useMemo(() => contractFromCalls(calls), [calls])
  // Öppnaren = första platsen som inte passar; svararen = öppnarens partner.
  const openerSeat = calls.find((c) => c.bid !== 'P')?.seat ?? null
  const responderSeat = openerSeat ? PARTNER[openerSeat] : null
  const passedOut = calls.length > 0 && calls.every((c) => c.bid === 'P')

  // Datorn budar i samma takt som i Spela kort: nästa bud var 700:e ms.
  const playing = shown < calls.length
  useEffect(() => {
    if (!playing) return
    const id = setTimeout(() => setShown((n) => n + 1), 700)
    return () => clearTimeout(id)
  }, [playing, shown])

  const activeSeat = playing ? calls[shown].seat : null

  function loadDeal(d: Deal) {
    setDeal(d)
    setShown(0)
    setReporting(false)
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold mb-1">Budvisning</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Titta-läge: motorn delar ut en giv och budar alla fyra händerna enligt
          systemboken. Klicka på ett lagt bud för att se vad det betyder.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => loadDeal(dealRandom())}>Ny giv →</Button>
        <Button
          onClick={() => {
            const found = dealWithAuction()
            if (found) loadDeal(found.deal)
          }}
        >
          Öppning + auktion →
        </Button>
        {!playing && calls.length > 0 && (
          <Button variant="secondary" onClick={() => setShown(0)}>
            Spela upp igen
          </Button>
        )}
        {/* Så snart budgivningen är klar går det att felrapportera given — här
            behöver man alltså inte spela klart korten först (görs ändå inte i
            Budvisningen). Samma dialog + förifyllda GitHub-issue som Spela kort. */}
        {!playing && calls.length > 0 && (
          <Button variant="secondary" onClick={() => setReporting(true)}>
            Rapportera fel →
          </Button>
        )}
      </div>

      {/* Bordet: alla fyra händer öppna runt auktionen (som omspelningen).
          Nord och Syd är SPEGELBILDER av varandra: samma kortstorlek, samma
          mörka remsa, hp-brickan i ytterhörnet (ägarbeslut: symmetri). */}
      <Felt>
        {/* Nord: solfjäder i remsan överst + hp-bricka. */}
        <div className="relative border-b border-emerald-100/10 bg-emerald-950/25 px-2 pb-3 pt-2.5">
          <HandFan hand={deal.hands.N} size="md" />
          <div className="absolute right-2 top-2">
            <HpTag label="N" hand={deal.hands.N} />
          </div>
        </div>

        {/* Mittraden: Väst | auktionen | Öst. */}
        <div className="flex items-start justify-between gap-1 px-2 py-3">
          <div className="flex flex-col items-center gap-1.5">
            <SideStack cards={fanCards(deal.hands.W)} side="W" />
            <HpTag label="V" hand={deal.hands.W} />
          </div>
          <div className="w-full max-w-sm self-center px-1">
            <AuctionGrid
              calls={calls.slice(0, shown)}
              dealer={deal.dealer}
              vulnerability={deal.vulnerability}
              activeSeat={activeSeat}
            />
            {passedOut && !playing && (
              <p className="mt-2 text-center text-xs text-emerald-50/80">
                Ingen öppnade – given passades ut.
              </p>
            )}
            {!playing && calls.length > 0 && (
              <p className="mt-2 text-center text-[11px] text-emerald-50/70">
                Klicka ett bud för förklaring.
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <SideStack cards={fanCards(deal.hands.E)} side="E" />
            <HpTag label="Ö" hand={deal.hands.E} />
          </div>
        </div>

        {/* Bricka + zon nere till vänster (som spelvyn). */}
        <div className="px-3 pb-2 text-xs leading-tight text-emerald-50/90">
          <div>Bricka {deal.board}</div>
          <div>{VUL_TEXT[deal.vulnerability]}</div>
        </div>

        {/* Syd: solfjäder i remsan längst ner + hp-bricka (spegel av Nord). */}
        <div className="relative border-t border-emerald-100/10 bg-emerald-950/25 px-2 pb-2.5 pt-3">
          <HandFan hand={deal.hands.S} size="md" />
          <div className="absolute bottom-2 right-2">
            <HpTag label="S" hand={deal.hands.S} />
          </div>
        </div>
      </Felt>

      {/* Felrapporten: hela given + auktionen (kontrakt härlett ur buden, inga
          stick eftersom Budvisningen inte spelar korten) → förifylld GitHub-issue. */}
      {reporting && (
        <FelrapportDialog
          deal={deal}
          calls={calls}
          contract={contract}
          tricks={[]}
          onClose={() => setReporting(false)}
          title="Rapportera fel i budgivningen"
          intro="Hela given (händerna och budgivningen) följer med automatiskt. Korten spelas inte i Budvisningen, så inga stick skickas med."
          categories={BIDDING_REPORT_CATEGORIES}
        />
      )}

      {/* Fördjupningen: poänguträkningar + alla budförklaringar i läsform. */}
      <details className="group rounded-xl border border-emerald-950/10 bg-white shadow-sm dark:border-emerald-100/10 dark:bg-club-900">
        <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 [&::-webkit-details-marker]:hidden">
          <span>🔎 Händernas poäng & alla budförklaringar</span>
          <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="border-t border-emerald-950/5 dark:border-emerald-100/10 px-4 pb-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {(['N', 'W', 'E', 'S'] as Seat[]).map((seat) => (
              <SeatDetails
                key={seat}
                deal={deal}
                seat={seat}
                openerSeat={openerSeat}
                responderSeat={responderSeat}
              />
            ))}
          </div>
          {calls.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Budgivningen steg för steg
              </h3>
              <ol className="space-y-2">
                {calls.map((call, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-16 shrink-0 text-sm font-semibold">
                      {SEAT_LABEL[call.seat]}
                    </span>
                    <span className="w-14 shrink-0">
                      <BidChip bid={call.bid} />
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {call.explanation ? <SuitText>{call.explanation}</SuitText> : '—'}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </details>

      {/* Hålfinnarna är testverktyg för budmotorn (R3-fynd #2): syns BARA i
          utvecklingsläge (import.meta.env.DEV). I den byggda appen som ägaren
          och andra använder göms de helt – de var förr synliga för alla. */}
      {import.meta.env.DEV && (
        <details className="group rounded-xl border border-emerald-950/10 bg-white shadow-sm dark:border-emerald-100/10 dark:bg-club-900">
          <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 [&::-webkit-details-marker]:hidden">
            <span>🛠 Hålfinnare – testverktyg för budmotorn (bara i dev)</span>
            <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="border-t border-emerald-950/5 dark:border-emerald-100/10 px-4 pb-4 pt-3">
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              Kör tusentals slumphänder genom motorn och visar hur ofta varje regel
              träffar – bra för att hitta hål i systemet.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setOpenSurvey(surveyOpenings(2000))}>
                Hålfinnare: öppningar
              </Button>
              <Button variant="secondary" onClick={() => setRespSurvey(surveyResponses(5000))}>
                Hålfinnare: svar
              </Button>
            </div>
            <div className="mt-4 space-y-4">
              {openSurvey && (
                <SurveyTable
                  title={`Hålfinnare öppningar – ${openSurvey.hands.toLocaleString('sv-SE')} händer`}
                  rows={openSurvey.byRule}
                  uncertain={openSurvey.uncertain}
                />
              )}
              {respSurvey && (
                <SurveyTable
                  title={`Hålfinnare svar – ${respSurvey.auctions.toLocaleString('sv-SE')} högfärgsöppningar`}
                  rows={respSurvey.byRule}
                  uncertain={respSurvey.uncertain}
                />
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  )
}

const VUL_TEXT: Record<Deal['vulnerability'], string> = {
  none: 'Ingen i zon',
  ns: 'NS i zon',
  ew: 'ÖV i zon',
  all: 'Alla i zon',
}

/** En plats i fördjupningen: hand som text + poäng + vad handen öppnar med. */
function SeatDetails({
  deal,
  seat,
  openerSeat,
  responderSeat,
}: {
  deal: Deal
  seat: Seat
  openerSeat: Seat | null
  responderSeat: Seat | null
}) {
  const hand = deal.hands[seat]
  const r = classifyOpening(hand, isVulnerable(seat, deal.vulnerability))
  const isOpener = openerSeat === seat
  const isResponder = responderSeat === seat
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold">
          {SEAT_LABEL[seat]}
          {deal.dealer === seat && (
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">(giv)</span>
          )}
          {isOpener && (
            <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">öppnare</span>
          )}
          {isResponder && (
            <span className="ml-2 text-xs text-sky-600 dark:text-sky-400">svarare</span>
          )}
        </span>
        <BidChip bid={r.call} />
      </div>
      <HandView hand={hand} showPoints />
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        <SuitText>{r.explanation}</SuitText>
        {r.uncertain && (
          <span className="ml-1 text-amber-600">
            <SuitText>⚑ osäker – kan vara stark 2♣</SuitText>
          </span>
        )}
      </p>
    </div>
  )
}

function SurveyTable({
  title,
  rows,
  uncertain,
}: {
  title: string
  rows: { rule: string; count: number; pct: number }[]
  uncertain: { notation: string; result: { call: string } }[]
}) {
  return (
    <Panel className="!p-4 !shadow-none border border-slate-200 dark:border-slate-700">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-1">Regel</th>
            <th className="py-1 text-right">Antal</th>
            <th className="py-1 text-right">Andel</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rule} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-1">{row.rule}</td>
              <td className="py-1 text-right tabular-nums">{row.count.toLocaleString('sv-SE')}</td>
              <td className="py-1 text-right tabular-nums">{row.pct} %</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="font-medium mb-1">Osäkra händer ({uncertain.length} exempel)</h3>
      {uncertain.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Inga osäkra händer i den här körningen.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {uncertain.map((u, i) => (
            <li key={i} className="text-slate-700 dark:text-slate-300">
              <span className="font-mono text-slate-500 dark:text-slate-400">{u.notation}</span> →{' '}
              <BidChip bid={u.result.call} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
