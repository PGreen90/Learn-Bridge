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

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { Button } from '../components/Button'
import { Felt } from '../components/Felt'
import { loadTavlingFramsteg, saveTavlingFramsteg } from '../lib/backend'
import {
  fetchDagensTavling,
  fetchTopplista,
  submitTavlingGiv,
  type DagensTavling as TavlingData,
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
      onKlar: (r, inskick) => {
        // Bokför resultatet (ersätt ev. tidigare rad för samma bricka) och gå
        // direkt vidare till nästa ospelade giv — eller till översikten
        // (ställningen) när serien är klar.
        const klara = [...framsteg.klara.filter((k) => k.board !== r.board), r]
        const nytt: TavlingFramsteg = { nummer: tavling.nummer, klara }
        saveTavlingFramsteg(nytt)
        setFramsteg(nytt)
        setSpelIndex(förstaOspelade(tavling, klara))
        // Skicka in given i bakgrunden; märk raden med serverns svar när det kommer.
        submitTavlingGiv(inskick).then((svar) => {
          setFramsteg((f) => {
            if (!f || f.nummer !== tavling.nummer) return f
            const uppd = f.klara.map((k) =>
              k.board === r.board ? { ...k, inskickStatus: svar.status } : k,
            )
            const nf: TavlingFramsteg = { ...f, klara: uppd }
            saveTavlingFramsteg(nf)
            return nf
          })
        })
      },
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
        <header className="space-y-1 text-center">
          <h1 className="text-3xl font-semibold text-emerald-50">
            Dagens tävling <span className="text-gold-300">#{tavling.nummer}</span>
          </h1>
          <p className="text-emerald-100/75">
            {tavling.storlek} givar — samma för alla i dag. Spela dem i tur och ordning.
          </p>
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

        {/* Topplistan (Led 3) — provisorisk under dagen. */}
        <TopplistaVy resultat={topplista} />

        <div className="flex justify-center">
          <HemLänk />
        </div>
      </div>
    </Skärm>
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
