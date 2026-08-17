// Beslut B etapp 4 (4A) — bordsskärmen: väntrummet.
//
// Här samlas spelarna före start: stolskartan (kompassdiamanten), inbjudnings-
// länken, stolbyten och lämna/avsluta. Själva spelet (bud + kort) byggs i 4B —
// startknappen står som förhandsvisning tills dess.
//
// Synkmodellen (docs/bord-plan.md): hjärtslaget var 5:e sekund är den
// auktoritativa vägen (närvaro + "har något hänt?"), realtidsprenumerationen
// på händelseloggen är latenssocker. Båda svarar med händelser/sekvensnummer;
// väntrummet svarar med att hämta om hela läget (billigt och enkelt — spelets
// finkorniga händelsekö kommer i 4B).
//
// Sidan är IMMERSIV (helskärm, dold header — Layout.tsx) och kör den vinröda
// duken (Felt tone="vanner", ägarbeslut 2026-08-17).

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../components/AuthProvider'
import { Felt } from '../../components/Felt'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { SEAT_LABEL } from '../../lib/bidding'
import type { Seat } from '../../types/bridge'
import {
  bordHjartslag,
  gaMedBord,
  hamtaBordLage,
  prenumereraBordHandelser,
  stolHandling,
  type BordLage,
  type BordStol,
} from '../../lib/backend/bord'
import { SPELFORM_ETIKETT } from './SpelaMedVanner'

const HJARTSLAG_MS = 5_000

function Skarm({ children }: { children: React.ReactNode }) {
  return (
    <Felt
      tone="vanner"
      rounded="rounded-none"
      className="flex min-h-[100dvh] w-full flex-col items-center justify-center border-transparent px-5 py-10 shadow-none"
    >
      {children}
    </Felt>
  )
}

function HemLank() {
  return (
    <Link
      to="/spela-med-vanner"
      className="text-xs font-semibold text-rose-100/70 underline underline-offset-2 hover:text-rose-50"
    >
      ← Till Spela med vänner
    </Link>
  )
}

function StolKort({
  stol,
  arDin,
  iLobby,
  arbetar,
  onValj,
}: {
  stol: BordStol
  arDin: boolean
  iLobby: boolean
  arbetar: boolean
  onValj: (stol: Seat) => void
}) {
  const grund = 'flex min-h-24 w-36 flex-col items-center justify-center gap-1 rounded-2xl p-3 text-center ring-1 transition-colors'
  const utseende = arDin
    ? 'bg-gold-400/15 ring-gold-400/40'
    : 'bg-red-950/30 ring-rose-50/10'
  return (
    <div className={`${grund} ${utseende}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-100/60">
        {SEAT_LABEL[stol.stol]}
      </p>
      {stol.namn ? (
        <p className="font-semibold text-rose-50">
          {stol.namn}
          {arDin && <span className="text-gold-200"> (du)</span>}
        </p>
      ) : (
        <>
          <p className="text-sm text-rose-100/70">{stol.typ === 'bot' ? 'Bot' : 'Ledig'}</p>
          {iLobby && stol.typ === 'ledig' && (
            <button
              type="button"
              disabled={arbetar}
              onClick={() => onValj(stol.stol)}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-50 ring-1 ring-rose-50/25 transition-colors hover:bg-red-950/45 disabled:opacity-50"
            >
              Sätt dig här
            </button>
          )}
        </>
      )}
    </div>
  )
}

export function Bord() {
  const { kod = '' } = useParams()
  const { loading: authLaddar, signedIn } = useAuth()
  const navigate = useNavigate()
  const [lage, setLage] = useState<BordLage | null>(null)
  const [fel, setFel] = useState<string | null>(null)
  const [handlingsFel, setHandlingsFel] = useState<string | null>(null)
  const [arbetar, setArbetar] = useState(false)
  const [kopierad, setKopierad] = useState(false)
  const [visaAvsluta, setVisaAvsluta] = useState(false)
  const senasteSeqRef = useRef(0)

  const hamta = useCallback(async () => {
    const svar = await hamtaBordLage(kod.toUpperCase())
    if (!svar.ok) {
      setFel(svar.fel)
      return
    }
    setFel(null)
    senasteSeqRef.current = svar.senasteSeq
    setLage({ meta: svar.meta, stolar: svar.stolar, events: svar.events, senasteSeq: svar.senasteSeq })
  }, [kod])

  useEffect(() => {
    if (signedIn) void hamta()
  }, [signedIn, hamta])

  // Realtidsprenumerationen (deltagare): varje ny händelse → hämta om läget.
  const bordId = lage?.meta.id ?? null
  const dinStol = lage?.meta.dinStol ?? null
  useEffect(() => {
    if (!bordId || !dinStol) return
    return prenumereraBordHandelser(bordId, () => {
      void hamta()
    })
  }, [bordId, dinStol, hamta])

  // Hjärtslaget (deltagare): närvaro + auktoritativ ikapphämtning.
  const status = lage?.meta.status ?? null
  useEffect(() => {
    if (!dinStol || status === 'avslutat' || status === 'klar') return
    const id = setInterval(() => {
      void (async () => {
        const svar = await bordHjartslag(kod.toUpperCase(), senasteSeqRef.current)
        if (!svar.ok) {
          // T.ex. bortplockad från bordet eller bordet stängt — läs om läget.
          void hamta()
          return
        }
        if (svar.events.length || svar.senasteSeq > senasteSeqRef.current) void hamta()
      })()
    }, HJARTSLAG_MS)
    return () => clearInterval(id)
  }, [kod, dinStol, status, hamta])

  async function korHandling(f: () => Promise<{ ok: boolean; fel?: string }>) {
    setArbetar(true)
    setHandlingsFel(null)
    const svar = await f()
    if (!svar.ok) setHandlingsFel(svar.fel ?? 'Något gick fel')
    await hamta()
    setArbetar(false)
  }

  function valjStol(stol: Seat) {
    void korHandling(() =>
      dinStol ? stolHandling(kod.toUpperCase(), 'byt-stol', stol) : gaMedBord(kod.toUpperCase(), stol),
    )
  }

  async function lamna() {
    setArbetar(true)
    await stolHandling(kod.toUpperCase(), 'lamna')
    navigate('/spela-med-vanner')
  }

  async function avsluta() {
    setArbetar(true)
    await stolHandling(kod.toUpperCase(), 'avsluta')
    setVisaAvsluta(false)
    navigate('/spela-med-vanner')
  }

  function kopieraLank() {
    const lank = `${window.location.origin}/#/bord/${kod.toUpperCase()}`
    void navigator.clipboard?.writeText(lank).then(() => {
      setKopierad(true)
      setTimeout(() => setKopierad(false), 1800)
    })
  }

  if (authLaddar) return <Skarm>{null}</Skarm>

  if (!signedIn) {
    return (
      <Skarm>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-rose-50">Bord {kod.toUpperCase()}</h1>
          <p className="text-rose-100/70">Logga in för att sätta dig vid bordet.</p>
          <Link to="/logga-in">
            <Button>Logga in</Button>
          </Link>
          <div>
            <HemLank />
          </div>
        </div>
      </Skarm>
    )
  }

  if (fel && !lage) {
    return (
      <Skarm>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-rose-50">Hoppsan</h1>
          <p role="alert" className="text-rose-100/70">{fel}</p>
          <HemLank />
        </div>
      </Skarm>
    )
  }

  if (!lage) {
    return (
      <Skarm>
        <p className="text-rose-100/70">Hämtar bordet …</p>
      </Skarm>
    )
  }

  const { meta, stolar } = lage

  if (meta.status === 'avslutat' || meta.status === 'klar') {
    return (
      <Skarm>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-rose-50">Bordet är avslutat</h1>
          <p className="text-rose-100/70">Tack för besöket — skapa ett nytt bord när ni vill spela igen.</p>
          <HemLank />
        </div>
      </Skarm>
    )
  }

  const perStol = new Map(stolar.map((s) => [s.stol, s]))
  const stolKort = (stol: Seat) => {
    const s = perStol.get(stol)
    if (!s) return null
    return (
      <StolKort
        stol={s}
        arDin={meta.dinStol === stol}
        iLobby={meta.status === 'lobby'}
        arbetar={arbetar}
        onValj={valjStol}
      />
    )
  }

  return (
    <Skarm>
      <div className="flex w-full max-w-xl flex-col items-center gap-6">
        <header className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">
            Spela med vänner
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-rose-50">Bord {meta.kod}</h1>
          <p className="mt-1 text-sm text-rose-100/70">
            {SPELFORM_ETIKETT[meta.spelform]} · {meta.givar} givar ·{' '}
            {meta.tempo === 'lugn' ? 'Lugnt' : meta.tempo === 'snabb' ? 'Snabbt' : 'Normalt'} tempo
            {meta.privat ? ' · Privat' : ''}
          </p>
        </header>

        {/* Kompassdiamanten: N överst, V/Ö på sidorna, S nederst. */}
        <div className="grid grid-cols-3 place-items-center gap-3">
          <div />
          {stolKort('N')}
          <div />
          {stolKort('W')}
          <div className="px-2 text-center text-xs text-rose-100/50">
            {meta.status === 'lobby' ? 'Lediga stolar fylls med bottar vid start' : ''}
          </div>
          {stolKort('E')}
          <div />
          {stolKort('S')}
          <div />
        </div>

        {handlingsFel && (
          <p role="alert" className="text-sm font-medium text-rose-200">
            {handlingsFel}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {meta.dinStol && (
            <button
              type="button"
              onClick={kopieraLank}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-50 ring-1 ring-rose-50/25 transition-colors hover:bg-red-950/45"
            >
              {kopierad ? 'Länk kopierad ✓' : 'Kopiera inbjudningslänk'}
            </button>
          )}
          {meta.duArAgare && (
            <>
              <Button disabled title="Spelstarten byggs i nästa steg">
                Starta spelet
              </Button>
              <Button variant="secondary" disabled={arbetar} onClick={() => setVisaAvsluta(true)}>
                Avsluta bordet
              </Button>
            </>
          )}
          {meta.dinStol && !meta.duArAgare && (
            <Button variant="secondary" disabled={arbetar} onClick={() => void lamna()}>
              Lämna bordet
            </Button>
          )}
        </div>
        {meta.duArAgare && (
          <p className="text-xs text-rose-100/50">
            Spelstarten kommer i nästa delleverans — bjud in och prova stolarna så länge.
          </p>
        )}

        <HemLank />
      </div>

      {visaAvsluta && (
        <Dialog onClose={() => setVisaAvsluta(false)} className="w-full max-w-sm p-6">
          <h2 className="text-lg font-semibold text-ink">Avsluta bordet?</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Bordet stängs för alla som sitter här. Det går inte att ångra.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setVisaAvsluta(false)}>
              Avbryt
            </Button>
            <Button disabled={arbetar} onClick={() => void avsluta()}>
              Avsluta bordet
            </Button>
          </div>
        </Dialog>
      )}
    </Skarm>
  )
}
