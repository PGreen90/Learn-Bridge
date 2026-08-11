// Beslut B etapp 2 (klientfasen) — "Dagens tävling"-sidan.
//
// Kräver konto (ägarbeslut 2026-08-10): utloggade möts av en logga-in-ruta.
// Hämtar dagens 12 givar från servern och låter spelaren spela dem LINJÄRT
// (giv 1 → 12) mot bottarna, med progress och paus (man kan lämna och fortsätta
// senare samma dag). Varje giv spelas i den vanliga spelskärmen (Play) i
// tävlingsläge — bottarna spelar med serverns play-frö så inskicket kan
// valideras senare (Led 2).
//
// Framstegen sparas LOKALT i Led 1 (per enhet, backend-lagret). Led 2 flyttar
// inskicket till kontot på servern och lägger till validering + topplista.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { Button } from '../components/Button'
import { Felt } from '../components/Felt'
import { SuitSymbol } from '../components/SuitSymbol'
import type { Seat } from '../types/bridge'
import { loadTavlingFramsteg, saveTavlingFramsteg } from '../lib/backend'
import { formatNedrakning, msTillNastaTavling } from '../lib/engine/daily'
import {
  fetchDagensTavling,
  fetchTopplista,
  submitTavlingGiv,
  type DagensTavling as TavlingData,
  type GivKontrakt,
  type GivResultat,
  type InskickStatus,
  type TavlingFramsteg,
  type TavlingsResultat,
  type TopplistaResultat,
} from '../lib/backend/tavling'
import { Play } from './Play'
import type { TavlingSpel } from './play/tavling-mode'

/** Index i givar-listan för den första ospelade given, eller null om alla är
 *  klara. Robust mot ordning: matchar på bricknummer, inte listindex. */
function förstaOspelade(tavling: TavlingData, klara: GivResultat[]): number | null {
  const klaraBrickor = new Set(klara.map((k) => k.board))
  const i = tavling.givar.findIndex((g) => !klaraBrickor.has(g.deal.board))
  return i === -1 ? null : i
}

export function DagensTavling() {
  const { loading: authLoading, signedIn } = useAuth()
  // null = laddar; annars utfallet av hämtningen.
  const [resultat, setResultat] = useState<TavlingsResultat | null>(null)
  const [framsteg, setFramsteg] = useState<TavlingFramsteg | null>(null)
  // Index i givar-listan för given som spelas just nu (null = översikten visas).
  const [spelIndex, setSpelIndex] = useState<number | null>(null)
  // Dagens topplista (hämtas på översikten).
  const [topplista, setTopplista] = useState<TopplistaResultat | null>(null)
  // Alltid senaste framsteget (utan att fastna i en gammal closure) — så
  // bokföring på färdig giv och "nästa giv"-navigeringen läser samma sanning.
  const framstegRef = useRef<TavlingFramsteg | null>(null)
  useEffect(() => {
    framstegRef.current = framsteg
  }, [framsteg])

  // Hämta dagens tävling när vi vet att användaren är inloggad.
  useEffect(() => {
    if (!signedIn) return
    let active = true
    setResultat(null)
    fetchDagensTavling().then((r) => {
      if (active) setResultat(r)
    })
    return () => {
      active = false
    }
  }, [signedIn])

  // När tävlingen laddats: läs in lokala framsteg (bara om de hör till DAGENS
  // tävlingsnummer — gårdagens framsteg återupptas aldrig).
  useEffect(() => {
    if (!resultat || resultat.status !== 'ok') return
    const nummer = resultat.tavling.nummer
    const sparat = loadTavlingFramsteg()
    setFramsteg(sparat && sparat.nummer === nummer ? sparat : { nummer, klara: [] })
  }, [resultat])

  // Hämta topplistan när översikten visas (och efter varje giv man kommer
  // tillbaka från) — den uppdateras löpande under dagen.
  useEffect(() => {
    if (!resultat || resultat.status !== 'ok' || spelIndex !== null) return
    let active = true
    fetchTopplista().then((t) => {
      if (active) setTopplista(t)
    })
    return () => {
      active = false
    }
  }, [resultat, spelIndex])

  // --- Grindar: konto krävs -------------------------------------------------
  if (authLoading) {
    return <Skärm><p className="text-emerald-100/80">Laddar …</p></Skärm>
  }
  if (!signedIn) {
    return (
      <Skärm>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-emerald-50">Dagens tävling</h1>
          <p className="text-emerald-100/80">
            Samma 12 givar för alla varje dag. För att spela tävlingen och komma med
            på topplistan behöver du ett konto.
          </p>
          <div className="flex flex-col items-center gap-2">
            <Link to="/logga-in">
              <Button>Logga in</Button>
            </Link>
            <Link
              to="/registrera"
              className="text-sm font-medium text-gold-200 underline underline-offset-2 hover:text-gold-100"
            >
              Skapa konto
            </Link>
          </div>
          <HemLänk />
        </div>
      </Skärm>
    )
  }

  // --- Laddar / fel / ingen tävling ----------------------------------------
  if (!resultat) {
    return <Skärm><p className="text-emerald-100/80">Hämtar dagens tävling …</p></Skärm>
  }
  if (resultat.status === 'ingen') {
    return (
      <Skärm>
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-2xl font-semibold text-emerald-50">Dagens tävling</h1>
          <p className="text-emerald-100/80">
            Dagens givar är inte klara än. De skapas strax efter midnatt — titta in
            om en liten stund.
          </p>
          <HemLänk />
        </div>
      </Skärm>
    )
  }
  if (resultat.status === 'fel') {
    return (
      <Skärm>
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-2xl font-semibold text-emerald-50">Dagens tävling</h1>
          <p className="text-emerald-100/80">{resultat.fel}</p>
          <HemLänk />
        </div>
      </Skärm>
    )
  }

  const tavling = resultat.tavling
  if (!framsteg) {
    return <Skärm><p className="text-emerald-100/80">Laddar framsteg …</p></Skärm>
  }

  // --- Spela en giv (tävlingsläge i den vanliga spelskärmen) ----------------
  if (spelIndex !== null) {
    const giv = tavling.givar[spelIndex]
    // Sista given? (att slutföra just den här fyller serien.)
    const kvarEfterDenna = tavling.givar.filter(
      (g) => g.deal.board !== giv.deal.board && !framsteg.klara.some((k) => k.board === g.deal.board),
    ).length
    const spel: TavlingSpel = {
      giv,
      nummer: tavling.nummer,
      board: giv.deal.board,
      total: tavling.storlek,
      sista: kvarEfterDenna === 0,
      onResultat: (r, inskick) => {
        // BOKFÖR i samma stund given är klar (ersätt ev. tidigare rad för samma
        // bricka). Läser/ skriver framstegRef så navigeringen efteråt ser den
        // uppdaterade listan även om React ännu inte hunnit rendera om.
        const base = framstegRef.current?.klara ?? []
        const klara = [...base.filter((k) => k.board !== r.board), r]
        const nytt: TavlingFramsteg = { nummer: tavling.nummer, klara }
        framstegRef.current = nytt
        saveTavlingFramsteg(nytt)
        setFramsteg(nytt)
        // Skicka in i bakgrunden; märk raden med serverns svar när det kommer.
        submitTavlingGiv(inskick).then((svar) => {
          setFramsteg((f) => {
            if (!f || f.nummer !== tavling.nummer) return f
            const uppd = f.klara.map((k) =>
              k.board === r.board ? { ...k, inskickStatus: svar.status } : k,
            )
            const nf: TavlingFramsteg = { ...f, klara: uppd }
            framstegRef.current = nf
            saveTavlingFramsteg(nf)
            return nf
          })
        })
      },
      // Efter en klar giv landar man på ÖVERSIKTEN (ägarbeslut 2026-08-11) — där
      // ser man sina framsteg + ställningen och startar nästa giv med "Fortsätt".
      onNästa: () => setSpelIndex(null),
      onÖversikt: () => setSpelIndex(null),
    }
    return <Play key={`tavling-${tavling.nummer}-${giv.deal.board}`} tavling={spel} />
  }

  // --- Översikten -----------------------------------------------------------
  const antalKlara = framsteg.klara.length
  const alltKlart = antalKlara >= tavling.storlek
  const nästa = förstaOspelade(tavling, framsteg.klara)

  return (
    <Skärm>
      <div className="w-full max-w-xl space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold text-emerald-50">
            Dagens tävling <span className="text-gold-300">#{tavling.nummer}</span>
          </h1>
          <p className="text-emerald-100/75">
            {tavling.storlek} givar — samma för alla i dag. Spela dem i tur och ordning.
          </p>
          <Nedrakning />
        </header>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-emerald-100/80">
            <span>{antalKlara} av {tavling.storlek} klara</span>
            {!alltKlart && nästa !== null && (
              <span className="text-gold-200">Nästa: giv {tavling.givar[nästa].deal.board}</span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-950/60 ring-1 ring-emerald-100/10">
            <div
              className="h-full rounded-full bg-gold-400 transition-all"
              style={{ width: `${(antalKlara / tavling.storlek) * 100}%` }}
            />
          </div>
        </div>

        {/* De 12 givarna som brickor */}
        <div className="grid grid-cols-6 gap-2">
          {tavling.givar.map((g, i) => {
            const klar = framsteg.klara.find((k) => k.board === g.deal.board)
            const ärNästa = i === nästa
            const avvisad = klar?.inskickStatus === 'avvisad'
            return (
              <div
                key={g.deal.id}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-semibold ring-1 ${
                  avvisad
                    ? 'bg-danger/15 text-danger ring-danger/40'
                    : klar
                      ? 'bg-gold-400/15 text-gold-200 ring-gold-400/40'
                      : ärNästa
                        ? 'bg-emerald-800/60 text-emerald-50 ring-gold-400/40'
                        : 'bg-emerald-950/40 text-emerald-100/50 ring-emerald-100/10'
                }`}
                title={
                  klar
                    ? `${klar.headline}${STATUS_TITEL[klar.inskickStatus ?? 'pending']}`
                    : undefined
                }
              >
                <span>{g.deal.board}</span>
                {klar && <span className="text-[10px] leading-none">{STATUS_GLYF[klar.inskickStatus ?? 'pending']}</span>}
              </div>
            )
          })}
        </div>

        {/* Huvudknapp */}
        <div className="flex flex-col items-center gap-3">
          {alltKlart ? (
            <div className="w-full rounded-xl bg-emerald-950/45 p-4 text-center ring-1 ring-gold-400/25">
              <p className="font-brand text-lg text-gold-200">🎉 Alla {tavling.storlek} givar spelade!</p>
              <p className="text-sm text-emerald-100/75">
                Dina givar är inskickade och validerade. Ställningen nedan uppdateras
                löpande under dagen och blir slutlig efter midnatt.
              </p>
            </div>
          ) : nästa !== null ? (
            <Button onClick={() => setSpelIndex(nästa)}>
              {antalKlara === 0 ? 'Starta tävlingen →' : `Fortsätt – giv ${tavling.givar[nästa].deal.board} →`}
            </Button>
          ) : null}
        </div>

        {/* Din ställning (steg 3) → dina givar (steg 4) → topplistan (Led 3). */}
        <DinStällning resultat={topplista} />
        <Resultattabell klara={framsteg.klara} topplista={topplista} />
        <TopplistaVy resultat={topplista} />

        <div className="flex justify-center">
          <HemLänk />
        </div>
      </div>
    </Skärm>
  )
}

/** Nedräkning till nästa tävling (midnatt svensk tid) — så länge man har på sig
 *  att spela klart dagens. Tickar varje sekund och räknar om mot Sthlm-midnatt
 *  (aldrig ett lagrat värde som kan driva) så den stämmer i alla tidszoner. */
function Nedrakning() {
  const [ms, setMs] = useState(() => msTillNastaTavling())
  useEffect(() => {
    const id = setInterval(() => setMs(msTillNastaTavling()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-950/50 px-3 py-1 text-sm text-emerald-100/80 ring-1 ring-emerald-100/10">
      <span>Nästa tävling om</span>
      <span className="font-semibold tabular-nums text-gold-200">{formatNedrakning(ms)}</span>
    </div>
  )
}

/** Liten statusmarkör på en spelad giv-bricka (inskickets utfall). */
const STATUS_GLYF: Record<InskickStatus | 'pending', string> = {
  godkand: '✓',
  avvisad: '✗',
  granskning: '?',
  redan: '✓',
  fel: '⚠',
  pending: '·',
}
const STATUS_TITEL: Record<InskickStatus | 'pending', string> = {
  godkand: ' — inskickad ✓',
  avvisad: ' — inskicket avvisades',
  granskning: ' — under granskning',
  redan: ' — redan inskickad',
  fel: ' — nådde inte servern (spara lokalt)',
  pending: ' — skickar in …',
}

/** Ditt eget läge överst i ställningen (UI-polish steg 3): placering + snitt-MP%.
 *  Visas bara när servern gett dina siffror (inloggad + minst en poängsatt giv);
 *  annars tyst, så översikten ser lugn ut tills du faktiskt är rankad. */
function DinStällning({ resultat }: { resultat: TopplistaResultat | null }) {
  if (!resultat || resultat.status !== 'ok') return null
  const { du, topplista } = resultat.data
  if (!du) return null
  const antalRankade = topplista.length
  const medalj = du.placering === 1 ? '🥇' : du.placering === 2 ? '🥈' : du.placering === 3 ? '🥉' : null
  return (
    <div className="w-full rounded-xl bg-gradient-to-br from-emerald-800/70 to-emerald-950/60 p-4 ring-1 ring-gold-400/30">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-emerald-100/60">
        Din ställning
      </p>
      <div className="flex items-stretch justify-around gap-4 text-center">
        <div className="flex flex-col items-center justify-center">
          <span className="flex items-baseline gap-1">
            {medalj && <span className="text-2xl leading-none">{medalj}</span>}
            <span className="font-brand text-4xl leading-none text-gold-200 tabular-nums">{du.placering}</span>
          </span>
          <span className="mt-1 text-xs text-emerald-100/60">av {antalRankade} spelare</span>
        </div>
        <div className="w-px self-stretch bg-emerald-100/10" />
        <div className="flex flex-col items-center justify-center">
          <span className="font-brand text-4xl leading-none text-gold-200 tabular-nums">
            {du.snitt.toFixed(1)}<span className="text-2xl"> %</span>
          </span>
          <span className="mt-1 text-xs text-emerald-100/60">
            {du.antalGivar} {du.antalGivar === 1 ? 'poängsatt giv' : 'poängsatta givar'}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Spelförarens säte på svenska (kompakt, till kontraktscellen). */
const SÄTE_SV: Record<Seat, string> = { N: 'N', E: 'Ö', S: 'S', W: 'V' }

/** Resultatet relativt kontraktet: "=", "+1", "−2" (ur spelförarens sikt). */
function resultatText(k?: GivKontrakt | null): string {
  if (!k) return '—'
  if (k.diff === 0) return '='
  return k.diff > 0 ? `+${k.diff}` : `−${-k.diff}`
}

/** Kontraktscellen: nivå + färgsymbol (spader svart) + ev. dubbling + säte.
 *  `null` = utpassad giv; `undefined` = äldre framsteg utan kontraktsfält. */
function Kontraktscell({ k }: { k?: GivKontrakt | null }) {
  if (k === null) return <span className="text-emerald-100/50">Passad</span>
  if (!k) return <span className="text-emerald-100/40">—</span>
  return (
    <span className="inline-flex items-center gap-0.5 text-emerald-50">
      <span className="tabular-nums">{k.level}</span>
      {k.strain === 'NT' ? (
        <span className="font-semibold">NT</span>
      ) : (
        <SuitSymbol suit={k.strain} />
      )}
      {k.doubled && <span className="font-semibold text-danger">{k.doubled}</span>}
      <span className="ml-1 text-xs text-emerald-100/50">{SÄTE_SV[k.declarer]}</span>
    </span>
  )
}

/** Din resultattabell (UI-polish steg 4): en rad per spelad giv — kontrakt,
 *  resultat och din MP%. MP% kommer från serverns `dinaGivar` (matchat på
 *  bricka); en giv som ännu inte poängsatts (för få spelare) visar "väntar",
 *  och en avvisad giv en röd markör i stället för procent. */
function Resultattabell({
  klara,
  topplista,
}: {
  klara: GivResultat[]
  topplista: TopplistaResultat | null
}) {
  if (klara.length === 0) return null
  const mpPerBricka = new Map<number, number>()
  if (topplista?.status === 'ok') {
    for (const g of topplista.data.dinaGivar) mpPerBricka.set(g.board, g.procent)
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
              const avvisad = r.inskickStatus === 'avvisad'
              return (
                <tr key={r.board} className="border-t border-emerald-100/5">
                  <td className="py-1.5 pr-2 tabular-nums text-emerald-100/70">{r.board}</td>
                  <td className="px-2 py-1.5">
                    <Kontraktscell k={r.kontrakt} />
                  </td>
                  <td className="px-2 py-1.5 text-center tabular-nums text-emerald-50">
                    {resultatText(r.kontrakt)}
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">
                    {avvisad ? (
                      <span className="text-danger" title="Inskicket avvisades">✗</span>
                    ) : mp === undefined ? (
                      <span className="text-emerald-100/40">väntar</span>
                    ) : (
                      <span className="font-semibold text-gold-200">{mp.toFixed(0)} %</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Dagens topplista (provisorisk). Tyst medan den hämtas eller om servern inte
 *  har någon tävling/svarar — översikten fungerar ändå. */
function TopplistaVy({ resultat }: { resultat: TopplistaResultat | null }) {
  if (!resultat) {
    return <p className="text-center text-xs text-emerald-100/50">Hämtar ställningen …</p>
  }
  if (resultat.status !== 'ok') return null
  const { topplista, poängsattaGivar, minPerGiv } = resultat.data
  return (
    <div className="w-full space-y-2 rounded-xl bg-emerald-950/40 p-4 ring-1 ring-emerald-100/10">
      <h2 className="text-center font-brand text-lg text-gold-200">Ställningen</h2>
      {topplista.length === 0 ? (
        <p className="text-center text-sm text-emerald-100/70">
          Väntar på fler resultat — en giv ger poäng först när minst {minPerGiv} spelare
          har spelat den.
        </p>
      ) : (
        <>
          <ol className="space-y-1">
            {topplista.map((rad, i) => (
              <li
                key={`${rad.namn}-${i}`}
                className="flex items-center justify-between rounded-lg bg-emerald-950/40 px-3 py-1.5 text-sm"
              >
                <span className="flex items-center gap-2 text-emerald-50">
                  <span className="w-5 text-right text-emerald-100/60">{i + 1}.</span>
                  {rad.namn}
                </span>
                <span className="font-semibold text-gold-200">{rad.snitt.toFixed(1)} %</span>
              </li>
            ))}
          </ol>
          <p className="text-center text-[11px] text-emerald-100/50">
            {poängsattaGivar} {poängsattaGivar === 1 ? 'giv' : 'givar'} med tillräckligt många
            spelare · provisorisk
          </p>
        </>
      )}
    </div>
  )
}

/** Full-skärms grön yta (spelvyn är immersiv — ingen header). */
function Skärm({ children }: { children: React.ReactNode }) {
  return (
    <Felt className="flex min-h-[100dvh] w-full flex-col items-center justify-center rounded-none border-transparent px-5 py-10 shadow-none">
      {children}
    </Felt>
  )
}

function HemLänk() {
  return (
    <Link
      to="/"
      className="text-xs font-semibold text-emerald-100/70 underline underline-offset-2 transition-opacity hover:text-emerald-50"
    >
      ← Till startsidan
    </Link>
  )
}
