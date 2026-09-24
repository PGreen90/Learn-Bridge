// Delade vyer för tävlingen (Påbyggnad 3, 2026-09-13): Din ställning, Dina givar,
// giv-detaljen (travellern), Ställningen, kontraktscellen m.m. Används av dagens
// tävling (DagensTavling) OCH historiksidan (TavlingHistorik) — lyfta hit ur
// DagensTavling.tsx (etapp D3) så ingen sida importerar en annan sida.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Felt } from '../../components/Felt'
import { SuitSymbol } from '../../components/SuitSymbol'
import type { Seat } from '../../types/bridge'
import {
  fetchGivResultat,
  type BrickaRad,
  type GivKontrakt,
  type GivResultat,
  type GivResultatSvar,
  type GivResultatUtfall,
  type TopplistaResultat,
} from '../../lib/backend/tavling'

/** Spelförarens säte på svenska (kompakt, till kontraktscellen). */
export const SÄTE_SV: Record<Seat, string> = { N: 'N', E: 'Ö', S: 'S', W: 'V' }

/** Resultatet relativt kontraktet: "=", "+1", "−2" (ur spelförarens sikt). */
export function resultatText(k?: GivKontrakt | null): string {
  if (!k) return '—'
  if (k.diff === 0) return '='
  return k.diff > 0 ? `+${k.diff}` : `−${-k.diff}`
}

/** Kontraktscellen: nivå + färgsymbol (spader svart) + ev. dubbling + säte.
 *  `null` = utpassad giv; `undefined` = äldre framsteg utan kontraktsfält. */
export function Kontraktscell({ k }: { k?: GivKontrakt | null }) {
  if (k === null) return <span className="text-emerald-100/60">Passad</span>
  if (!k) return <span className="text-emerald-100/60">—</span>
  return (
    <span className="inline-flex items-center gap-0.5 text-emerald-50">
      <span className="tabular-nums">{k.level}</span>
      {k.strain === 'NT' ? (
        <span className="font-semibold">NT</span>
      ) : (
        <SuitSymbol suit={k.strain} />
      )}
      {k.doubled && <span className="font-semibold text-danger">{k.doubled}</span>}
      <span className="ml-1 text-xs text-emerald-100/60">{SÄTE_SV[k.declarer]}</span>
    </span>
  )
}

/** Ditt eget läge överst i ställningen (UI-polish steg 3): placering + snitt-MP%.
 *  Visas så fort servern har minst ett inskick från dig (Påbyggnad 3: alla med
 *  inskick står på listan — ospelade givar räknas som 40 % tills de spelats, så
 *  snittet är ett TILLSVIDARE-snitt tills alla givar är inne). Har du inte
 *  skickat in något alls är kortet tyst. */
export function DinStällning({ resultat, total }: { resultat: TopplistaResultat | null; total: number }) {
  if (!resultat || resultat.status !== 'ok') return null
  const { du, topplista, provisoriskProcent } = resultat.data
  if (!du) return null

  const { placering, snitt } = du
  const spelade = du.spelade ?? du.antalGivar
  const antalRankade = topplista.length
  const medalj = placering === 1 ? '🥇' : placering === 2 ? '🥈' : placering === 3 ? '🥉' : null
  return (
    <div className="w-full rounded-xl bg-gradient-to-br from-emerald-800/70 to-emerald-950/60 p-4 ring-1 ring-gold-400/30">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-emerald-100/60">
        Din ställning
      </p>
      <div className="flex items-stretch justify-around gap-4 text-center">
        <div className="flex flex-col items-center justify-center">
          <span className="flex items-baseline gap-1">
            {medalj && <span className="text-2xl leading-none">{medalj}</span>}
            <span className="font-brand text-4xl leading-none text-gold-200 tabular-nums">{placering}</span>
          </span>
          <span className="mt-1 text-xs text-emerald-100/60">av {antalRankade} spelare</span>
        </div>
        <div className="w-px self-stretch bg-emerald-100/10" />
        <div className="flex flex-col items-center justify-center">
          <span className="font-brand text-4xl leading-none text-gold-200 tabular-nums">
            {snitt.toFixed(1)}<span className="text-2xl"> %</span>
          </span>
          <span className="mt-1 text-xs text-emerald-100/60">{`${spelade}/${total} givar`}</span>
        </div>
      </div>
      {spelade < total && (
        <p className="mt-2 text-center text-[11px] text-emerald-100/60">
          Ospelade givar räknas som {provisoriskProcent ?? 40} % tills du spelat dem.
        </p>
      )}
    </div>
  )
}

/** Din resultattabell (UI-polish steg 4): en rad per spelad giv — kontrakt,
 *  resultat och din MP%. MP% kommer från serverns `dinaGivar` (matchat på
 *  bricka); en giv som ännu inte poängsatts (för få spelare) visar "väntar",
 *  och en avvisad giv en röd markör i stället för procent. */
export function Resultattabell({
  klara,
  topplista,
  onÖppna,
}: {
  klara: GivResultat[]
  topplista: TopplistaResultat | null
  /** Klick på en giv → öppna dess detaljvy (travellern, steg 6). */
  onÖppna: (board: number) => void
}) {
  if (klara.length === 0) return null
  const mpPerBricka = new Map<number, number>()
  // Kontrakt/resultat från servern (auktoritativt) — fyller även givar spelade
  // före kontraktssparningen. `undefined` i mappen = servern sa inget (då
  // används det lokalt sparade kontraktet som reserv).
  const kontraktPerBricka = new Map<number, GivKontrakt | null>()
  if (topplista?.status === 'ok') {
    for (const g of topplista.data.dinaGivar) {
      mpPerBricka.set(g.board, g.procent)
      if (g.kontrakt !== undefined) kontraktPerBricka.set(g.board, g.kontrakt)
    }
  }
  const rader = [...klara].sort((a, b) => a.board - b.board)
  return (
    <div className="w-full space-y-2 rounded-xl bg-emerald-950/40 p-4 ring-1 ring-emerald-100/10">
      <h2 className="text-center font-brand text-lg text-gold-200">Dina givar</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-emerald-100/55">
              <th className="py-1 pr-2 text-left font-medium">Giv</th>
              <th className="px-2 py-1 text-left font-medium">Kontrakt</th>
              <th className="px-2 py-1 text-center font-medium">Resultat</th>
              <th className="py-1 pl-2 text-right font-medium">Din MP%</th>
            </tr>
          </thead>
          <tbody>
            {rader.map((r) => {
              const mp = mpPerBricka.get(r.board)
              // Serverns MP% vinner över den lokala "avvisad"-lappen: en giv som
              // godkänts i efterhand (rättad i databasen, 2026-09-24) ska visa procent.
              const avvisad = r.inskickStatus === 'avvisad' && mp === undefined
              // Servern har tagit emot given men den är inte poängsatt än (för få
              // spelare). Då "väntar" — och i snittet räknas den som 40 % tills
              // fler spelat den (Påbyggnad 3; det gamla "preliminärt 100 %"
              // motsade ställningen).
              const inne = r.inskickStatus === 'godkand' || r.inskickStatus === 'redan'
              // Kontrakt/resultat: serverns värde vinner (fyller även äldre
              // givar); annars det lokalt sparade.
              const kontrakt = kontraktPerBricka.has(r.board)
                ? kontraktPerBricka.get(r.board)!
                : r.kontrakt
              // Varje spelad giv går att öppna → travellern (fältets resultat).
              const öppna = () => onÖppna(r.board)
              return (
                <tr
                  key={r.board}
                  className="cursor-pointer border-t border-emerald-100/5 hover:bg-emerald-900/30"
                  role="button"
                  tabIndex={0}
                  title="Visa fältets resultat"
                  onClick={öppna}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      öppna()
                    }
                  }}
                >
                  <td className="py-1.5 pr-2 tabular-nums text-emerald-100/70">
                    {r.board}
                    <span className="ml-1 text-gold-300/70">›</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <Kontraktscell k={kontrakt} />
                  </td>
                  <td className="px-2 py-1.5 text-center tabular-nums text-emerald-50">
                    {resultatText(kontrakt)}
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">
                    {avvisad ? (
                      <span className="text-danger" title="Inskicket avvisades">✗</span>
                    ) : mp !== undefined ? (
                      <span className="font-semibold text-gold-200">{mp.toFixed(0)} %</span>
                    ) : r.inskickStatus === 'fel' ? (
                      // Inskicket kom aldrig fram (2026-09-13): sägs rakt ut, och
                      // skickas om vid sidöppning / uppdatera-knappen.
                      <span
                        className="text-gold-300/80"
                        title="Inskicket kom inte fram till servern — skickas om när du öppnar sidan eller trycker på uppdatera-knappen"
                      >
                        ej inskickad
                      </span>
                    ) : (
                      <span
                        className="text-emerald-100/60"
                        title={
                          inne
                            ? 'Given är inne men inte poängsatt än — räknas som 40 % i snittet tills fler spelat den'
                            : 'Väntar på serverns bekräftelse'
                        }
                      >
                        väntar
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-center text-[11px] text-emerald-100/60">Tryck på en giv för fältets resultat.</p>
    </div>
  )
}

/** Detaljvy för EN spelad giv (steg 6): hela fältets traveller (kontrakt ·
 *  resultat · MP%, din rad markerad). Varje rad öppnar genomgången "Så spelade
 *  X given" (Påbyggnad 3) — din egen rad leder vidare till rondgenomgången med
 *  förklaringar. */
export function GivDetalj({
  board,
  dag,
  onBack,
  onGranska,
  onÖvning,
}: {
  board: number
  /** Tävlingsdag (YYYY-MM-DD) för historiken; utelämnad = dagens tävling. */
  dag?: string
  onBack: () => void
  /** Klick på en spelares rad → stega igenom hur hen bjöd och spelade given. */
  onGranska: (rad: BrickaRad) => void
  /** Spela om given i övningsläge (räknas inte). Utelämnad → ingen knapp. */
  onÖvning?: () => void
}) {
  const [utfall, setUtfall] = useState<GivResultatUtfall | null>(null)
  useEffect(() => {
    let active = true
    setUtfall(null)
    fetchGivResultat(board, dag).then((u) => {
      if (active) setUtfall(u)
    })
    return () => {
      active = false
    }
  }, [board, dag])

  return (
    <Skärm>
      <div className="w-full max-w-xl space-y-5">
        <header className="text-center">
          <h1 className="font-brand text-2xl text-emerald-50">Giv {board}</h1>
          <p className="text-sm text-emerald-100/70">Hela fältets resultat</p>
        </header>

        {!utfall ? (
          <p className="text-center text-sm text-emerald-100/60">Hämtar resultaten …</p>
        ) : utfall.status !== 'ok' ? (
          <p className="text-center text-sm text-emerald-100/70">{utfall.fel}</p>
        ) : (
          <TravellerTabell data={utfall.data} onVälj={onGranska} />
        )}

        <div className="flex flex-col items-center gap-3">
          {/* Spela om given i övningsläge (2026-08-12). Tydligt märkt "räknas
              inte" så det aldrig förväxlas med tävlingsresultatet. */}
          {onÖvning && (
            <>
              <Button variant="secondary" onClick={onÖvning}>
                🔄 Spela given igen — övning
              </Button>
              <p className="text-[11px] text-emerald-100/60">Övning räknas inte i tävlingen.</p>
            </>
          )}
          <button
            onClick={onBack}
            className="text-sm font-semibold text-emerald-100/70 underline underline-offset-2 hover:text-emerald-50"
          >
            ← Tillbaka till översikten
          </button>
        </div>
      </div>
    </Skärm>
  )
}

/** Travellern: en rad per spelare på brickan (bäst MP% först), din rad markerad.
 *  Varje rad är klickbar (Påbyggnad 3) → "Så spelade X given". */
export function TravellerTabell({ data, onVälj }: { data: GivResultatSvar; onVälj: (rad: BrickaRad) => void }) {
  if (data.resultat.length === 0) {
    return <p className="text-center text-sm text-emerald-100/70">Inga resultat än.</p>
  }
  const ensam = data.resultat.length < 2
  return (
    <div className="w-full space-y-2 rounded-xl bg-emerald-950/40 p-4 ring-1 ring-emerald-100/10">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-emerald-100/55">
              <th className="py-1 pr-2 text-left font-medium">Spelare</th>
              <th className="px-2 py-1 text-left font-medium">Kontrakt</th>
              <th className="px-2 py-1 text-center font-medium">Resultat</th>
              <th className="py-1 pl-2 text-right font-medium">MP%</th>
            </tr>
          </thead>
          <tbody>
            {data.resultat.map((r, i) => {
              const välj = () => onVälj(r)
              return (
              <tr
                key={i}
                className={`cursor-pointer border-t border-emerald-100/5 hover:bg-emerald-900/30 ${r.jag ? 'bg-gold-400/10' : ''}`}
                role="button"
                tabIndex={0}
                title={r.jag ? 'Se hur du spelade given' : `Se hur ${r.namn} spelade given`}
                onClick={välj}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    välj()
                  }
                }}
              >
                <td className={`py-1.5 pr-2 ${r.jag ? 'font-semibold text-gold-200' : 'text-emerald-50'}`}>
                  {r.namn}
                  {r.jag && ' (du)'}
                  <span className="ml-1 text-gold-300/70">›</span>
                </td>
                <td className="px-2 py-1.5">
                  <Kontraktscell k={r.kontrakt} />
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums text-emerald-50">
                  {resultatText(r.kontrakt)}
                </td>
                <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-gold-200">
                  {r.procent.toFixed(0)} %
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {ensam && (
        <p className="text-center text-[11px] text-emerald-100/60">
          Väntar på fler spelare på den här given.
        </p>
      )}
      <p className="text-center text-[11px] text-emerald-100/60">
        Tryck på en spelare för att se hur given bjöds och spelades.
      </p>
    </div>
  )
}

/** Dagens topplista (provisorisk). Tyst medan den hämtas eller om servern inte
 *  har någon tävling/svarar — översikten fungerar ändå. */
export function TopplistaVy({ resultat }: { resultat: TopplistaResultat | null }) {
  if (!resultat) {
    return <p className="text-center text-xs text-emerald-100/60">Hämtar ställningen …</p>
  }
  if (resultat.status !== 'ok') return null
  const { topplista, poängsattaGivar, storlek, provisoriskProcent, slutlig } = resultat.data
  return (
    <div className="w-full space-y-2 rounded-xl bg-emerald-950/40 p-4 ring-1 ring-emerald-100/10">
      <h2 className="text-center font-brand text-lg text-gold-200">Ställningen</h2>
      {topplista.length === 0 ? (
        <p className="text-center text-sm text-emerald-100/70">
          Ingen har skickat in någon giv än — ställningen visas så fort den första
          given är inne.
        </p>
      ) : (
        <>
          <ol className="space-y-1">
            {topplista.map((rad, i) => {
              const medalj = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              return (
                <li
                  key={`${rad.namn}-${i}`}
                  className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                    rad.jag
                      ? 'bg-gold-400/15 ring-1 ring-gold-400/40'
                      : 'bg-emerald-950/40'
                  }`}
                >
                  <span className={`flex items-center gap-2 ${rad.jag ? 'font-semibold text-gold-100' : 'text-emerald-50'}`}>
                    <span className="w-5 text-right tabular-nums text-emerald-100/60">
                      {medalj ?? `${i + 1}.`}
                    </span>
                    {rad.namn}
                    {rad.jag && <span className="text-xs text-gold-300/80">(du)</span>}
                    {/* Spelade givar (Påbyggnad 3): "7/12" — äldre svar saknar fältet. */}
                    <span className="text-xs tabular-nums text-emerald-100/60" title="Spelade givar">
                      {rad.spelade ?? rad.antalGivar}/{storlek}
                    </span>
                  </span>
                  <span className="font-semibold text-gold-200">{rad.snitt.toFixed(1)} %</span>
                </li>
              )
            })}
          </ol>
          <p className="text-center text-[11px] text-emerald-100/60">
            Ospelade givar räknas som {provisoriskProcent ?? 40} % tills de spelats ·{' '}
            {poängsattaGivar} {poängsattaGivar === 1 ? 'giv' : 'givar'} poängsatt
            {poängsattaGivar === 1 ? '' : 'a'} · {slutlig ? 'slutlig' : 'provisorisk'}
          </p>
        </>
      )}
      {/* Öppen redovisning (trebottarna, ägar-ja 2026-09-01): datorspelarna har
          människonamn och pekas aldrig ut — men att de finns sägs rakt ut. */}
      <p className="text-center text-[11px] text-emerald-100/60">
        I tävlingen deltar även datorspelare.
      </p>
    </div>
  )
}

/** Full-skärms grön yta (spelvyn är immersiv — ingen header). */
export function Skärm({ children }: { children: React.ReactNode }) {
  return (
    <Felt className="flex min-h-[100dvh] w-full flex-col items-center justify-center rounded-none border-transparent px-5 py-10 shadow-none">
      {children}
    </Felt>
  )
}

export function HemLänk() {
  return (
    <Link
      to="/"
      className="text-xs font-semibold text-emerald-100/70 underline underline-offset-2 transition-opacity hover:text-emerald-50"
    >
      ← Till startsidan
    </Link>
  )
}

