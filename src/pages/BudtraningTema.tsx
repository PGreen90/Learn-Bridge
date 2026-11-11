// Budträningen — ett tema (nästa nivå etapp 3, 2026-11-11).
//
// En giv i taget: motorn har delat och bjudit fram till Syds tur i temats
// situation (engine/traning.ts). Du bjuder i den RIKTIGA budlådan — samma som
// vid spelbordet — och får sedan veta vad rebidz bjuder och varför. Givarna tar
// aldrig slut, och facit är per konstruktion motorns eget bud.
//
// "Fel" är ett för hårt ord i bridge: ett annat bud än motorns kan vara fullt
// rimligt. Därför säger sidan "rebidz bjuder …" och låter den som inte håller
// med rapportera given med ett tryck — det är så systemet blir bättre.

import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AuctionGrid } from '../components/AuctionGrid'
import { BidChip } from '../components/BidChip'
import { BiddingBox } from '../components/BiddingBox'
import { Button } from '../components/Button'
import { FelrapportDialog } from '../components/FelrapportDialog'
import { Felt } from '../components/Felt'
import { HandFan } from '../components/HandFan'
import { Panel } from '../components/Panel'
import { SuitText } from '../components/SuitText'
import { loadTraningslogg, sparaTraningssvar } from '../lib/backend'
import { BIDDING_REPORT_CATEGORIES } from '../lib/felrapport'
import { interpretCall } from '../lib/engine/auction-interpret'
import { legalCalls } from '../lib/engine/auction-live'
import { hcp } from '../lib/engine/hand'
import { traningsgiv, traningstema, type Traningsgiv, type Traningstema } from '../lib/engine/traning'
import type { Bid } from '../types/bridge'

export function BudtraningTema() {
  const { themeId = '' } = useParams()
  const tema = traningstema(themeId)
  if (!tema) {
    return (
      <Panel>
        <p className="text-ink-soft">Temat hittades inte.</p>
        <Link to="/budtraning" className="text-accent underline">
          Tillbaka till budträningen
        </Link>
      </Panel>
    )
  }
  // key → ett temabyte startar passet om från noll.
  return <Pass key={tema.id} tema={tema} />
}

function Pass({ tema }: { tema: Traningstema }) {
  const [giv, setGiv] = useState<Traningsgiv | null>(() => traningsgiv(tema.id))
  const [valt, setValt] = useState<Bid | null>(null)
  // Det här passet (sedan sidan öppnades) + formen över tid (sparad logg).
  const [pass, setPass] = useState({ ratt: 0, antal: 0 })
  const [logg, setLogg] = useState<boolean[]>(() => loadTraningslogg(tema.id))
  const [visaIntro, setVisaIntro] = useState(() => loadTraningslogg(tema.id).length === 0)
  const [rapporterar, setRapporterar] = useState(false)

  const nasta = useCallback(() => {
    setGiv(traningsgiv(tema.id))
    setValt(null)
  }, [tema.id])

  const svarat = valt !== null
  const lagliga = useMemo(() => (giv && !svarat ? legalCalls(giv.history, 'S') : []), [giv, svarat])

  function bjud(bid: Bid) {
    if (!giv || svarat) return
    const ratt = bid === giv.facit.bid
    setValt(bid)
    setPass((p) => ({ ratt: p.ratt + (ratt ? 1 : 0), antal: p.antal + 1 }))
    setLogg(sparaTraningssvar(tema.id, ratt))
  }

  const huvud = (
    <div className="flex items-start justify-between gap-3 px-1">
      <div className="min-w-0">
        <h1 className="text-base font-semibold leading-tight sm:text-lg">
          <SuitText>{tema.titel}</SuitText>
        </h1>
        <p className="text-xs text-ink-muted">
          {pass.antal > 0 ? `Det här passet: ${pass.ratt} av ${pass.antal}` : 'Ny giv varje gång'}
          {logg.length > 0 && ` · senaste ${logg.length}: ${Math.round((logg.filter(Boolean).length / logg.length) * 100)} %`}
        </p>
      </div>
      <Link to="/budtraning" className="shrink-0 text-sm text-accent underline">
        Alla teman
      </Link>
    </div>
  )

  if (!giv) {
    return (
      <div className="space-y-4">
        {huvud}
        <Panel className="space-y-3 text-center">
          <p className="text-ink-soft">Hittade ingen passande giv den här gången.</p>
          <Button onClick={nasta}>Försök igen</Button>
        </Panel>
      </div>
    )
  }

  const ratt = svarat && valt === giv.facit.bid
  const visadeBud = svarat ? [...giv.history, { seat: 'S' as const, bid: valt }] : giv.history
  // Vad DITT bud hade betytt (tolkas ur auktionen, samma lager som vid bordet).
  const dinTolkning = svarat && !ratt ? interpretCall(visadeBud, giv.history.length).text : null
  const facitText = giv.facit.explanation ?? interpretCall([...giv.history, giv.facit], giv.history.length).text

  return (
    <div className="space-y-2.5 sm:space-y-4">
      {huvud}

      {/* Temats korta introduktion: öppen första gången, sedan hopfälld. */}
      <div className="rounded-xl border border-line bg-panel px-3 py-1.5 text-sm">
        <button
          type="button"
          onClick={() => setVisaIntro((v) => !v)}
          aria-expanded={visaIntro}
          className="focus-ring flex w-full items-center justify-between gap-2 text-left font-semibold text-ink"
        >
          Om situationen
          <span aria-hidden className="text-ink-faint">{visaIntro ? '–' : '+'}</span>
        </button>
        {visaIntro && (
          <div className="mt-1.5 space-y-1.5 text-ink-soft">
            <p className="leading-relaxed">
              <SuitText>{tema.intro}</SuitText>
            </p>
            <p className="text-xs text-ink-muted">
              Reglerna står i{' '}
              <Link to="/budsystem" className="text-accent underline">
                Budsystem
              </Link>
              : <SuitText>{tema.paragraf}</SuitText>.
            </p>
          </div>
        )}
      </div>

      <Felt>
        <div className="p-2.5">
          <AuctionGrid
            calls={visadeBud}
            dealer={giv.deal.dealer}
            vulnerability={giv.deal.vulnerability}
            activeSeat={svarat ? null : 'S'}
            hiddenHands
          />
        </div>

        {/* Din hand ligger MELLAN auktionen och budlådan: på telefon ska korten
            synas utan att rulla medan man väljer bud. */}
        <div className="relative border-y border-emerald-100/10 bg-emerald-950/25 px-2 pb-2 pt-2.5">
          {/* Spelbordets platta rad: kompakt (288 px) på telefon så alla tretton
              kort syns, fullstor från 640 px. */}
          <div className="sm:hidden">
            <HandFan hand={giv.deal.hands.S} flat kompakt />
          </div>
          <div className="hidden sm:block">
            <HandFan hand={giv.deal.hands.S} flat />
          </div>
          <div className="absolute bottom-1.5 right-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
            {hcp(giv.deal.hands.S)} hp
          </div>
        </div>

        <div className="px-3 pb-4 pt-3">
          {!svarat ? (
            <>
              <p className="mb-2 text-center text-sm font-medium text-emerald-50">
                {giv.history.some((c) => c.bid !== 'P') ? 'Din tur – vad bjuder du?' : 'Vad öppnar du med?'}
              </p>
              <BiddingBox legal={lagliga} onBid={bjud} history={giv.history} />
            </>
          ) : (
            <div
              role="status"
              className="mx-auto max-w-md rounded-xl bg-panel p-3 text-left shadow-xl ring-1 ring-line"
            >
              <p className={`mb-1.5 font-semibold ${ratt ? 'text-accent' : 'text-ink'}`}>
                {ratt ? '✓ Samma som rebidz' : 'rebidz bjuder'}{' '}
                <BidChip bid={giv.facit.bid} />
              </p>
              <p className="text-sm leading-relaxed text-ink-soft">
                <SuitText>{facitText}</SuitText>
              </p>
              {dinTolkning && (
                <p className="mt-2 border-t border-line pt-2 text-sm leading-relaxed text-ink-muted">
                  Ditt bud <BidChip bid={valt} className="scale-90" /> <SuitText>{dinTolkning}</SuitText>
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setRapporterar(true)}
                  className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
                >
                  Håller du inte med? Rapportera
                </button>
                <Button onClick={nasta}>Nästa giv →</Button>
              </div>
            </div>
          )}
        </div>

      </Felt>

      {rapporterar && (
        <FelrapportDialog
          deal={giv.deal}
          calls={[...giv.history, giv.facit]}
          contract={null}
          tricks={[]}
          onClose={() => setRapporterar(false)}
          lage={`Budträning: ${tema.titel}${valt ? ` (jag bjöd ${valt})` : ''}`}
          title="Rapportera budet"
          intro="Hela given och budgivningen fram till rebidz bud följer med automatiskt."
          categories={BIDDING_REPORT_CATEGORIES}
        />
      )}
    </div>
  )
}
