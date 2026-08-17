// Beslut B etapp 4 (4A) — lobbyn för "Spela med vänner".
//
// Öppna bord listas för alla inloggade; ett bord skapas med inställningarna
// (spelform, antal givar, tempo, privat) och man ansluter genom att gå till
// bordets väntrum (Bord.tsx) och sätta sig på en ledig stol. Privata bord syns
// inte i listan utan nås via inbjudningskoden/länken.
//
// Sidan ligger i NORMAL layout (centrerad spalte) — det är själva bordsskärmen
// som är immersiv. Vänner-ytans vinröda prägel syns här som accent på korten.

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../components/AuthProvider'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import {
  hamtaBordslista,
  skapaBord,
  type BordIListan,
  type BordSpelform,
  type BordTempo,
} from '../../lib/backend/bord'

export const SPELFORM_ETIKETT: Record<BordSpelform, string> = {
  full: 'Full bridge',
  budgivning: 'Endast budgivning',
  spelforing: 'Endast spelföring',
}

const TEMPO_ETIKETT: Record<BordTempo, string> = {
  lugn: 'Lugnt',
  normal: 'Normalt',
  snabb: 'Snabbt',
}

/** Stolssammanfattning för listraden: namnen + antal lediga platser. */
function stolText(bord: BordIListan): string {
  const namn = bord.stolar.filter((s) => s.namn).map((s) => s.namn)
  const lediga = bord.stolar.filter((s) => s.typ === 'ledig').length
  const delar = []
  if (namn.length) delar.push(namn.join(', '))
  if (lediga > 0) delar.push(`${lediga} ledig${lediga === 1 ? '' : 'a'} stol${lediga === 1 ? '' : 'ar'}`)
  return delar.join(' · ') || 'Tomt bord'
}

function SkapaBordDialog({
  onClose,
  onSkapat,
}: {
  onClose: () => void
  onSkapat: (kod: string) => void
}) {
  const [spelform, setSpelform] = useState<BordSpelform>('full')
  const [givar, setGivar] = useState(8)
  const [tempo, setTempo] = useState<BordTempo>('normal')
  const [privat, setPrivat] = useState(false)
  const [skapar, setSkapar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)

  async function skapa() {
    setSkapar(true)
    setFel(null)
    const svar = await skapaBord({ spelform, givar, tempo, privat })
    if (!svar.ok) {
      setFel(svar.fel)
      setSkapar(false)
      return
    }
    onSkapat(svar.bord.kod)
  }

  const valKnapp = (aktiv: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition-colors ${
      aktiv
        ? 'bg-emerald-600 text-white ring-emerald-600'
        : 'bg-control text-ink ring-control-line hover:bg-control-hover'
    }`

  return (
    <Dialog onClose={skapar ? undefined : onClose} className="w-full max-w-md p-6">
      <h2 className="text-xl font-semibold text-ink">Skapa ett bord</h2>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-sm font-medium text-ink">Spelform</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(Object.keys(SPELFORM_ETIKETT) as BordSpelform[]).map((f) => (
              <button key={f} type="button" className={valKnapp(spelform === f)} onClick={() => setSpelform(f)}>
                {SPELFORM_ETIKETT[f]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Antal givar</p>
          <div className="mt-1.5 flex items-center gap-2">
            {[4, 8, 12].map((n) => (
              <button key={n} type="button" className={valKnapp(givar === n)} onClick={() => setGivar(n)}>
                {n}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={24}
              value={givar}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isInteger(n)) setGivar(Math.max(1, Math.min(24, n)))
              }}
              aria-label="Antal givar (1–24)"
              className="w-16 rounded-lg border border-control-line bg-control px-2 py-1.5 text-sm text-ink"
            />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Bottarnas tempo</p>
          <div className="mt-1.5 flex gap-2">
            {(Object.keys(TEMPO_ETIKETT) as BordTempo[]).map((t) => (
              <button key={t} type="button" className={valKnapp(tempo === t)} onClick={() => setTempo(t)}>
                {TEMPO_ETIKETT[t]}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={privat}
            onChange={(e) => setPrivat(e.target.checked)}
            className="h-4 w-4 accent-emerald-600"
          />
          Privat bord — syns inte i listan, nås bara via inbjudningskoden
        </label>
        {fel && (
          <p role="alert" className="text-sm font-medium text-danger">
            {fel}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={skapar}>
            Avbryt
          </Button>
          <Button onClick={() => void skapa()} disabled={skapar}>
            {skapar ? 'Skapar …' : 'Skapa bordet'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export function SpelaMedVanner() {
  const { loading: authLaddar, signedIn } = useAuth()
  const navigate = useNavigate()
  const [bord, setBord] = useState<BordIListan[] | null>(null)
  const [mitt, setMitt] = useState<{ kod: string } | null>(null)
  const [fel, setFel] = useState<string | null>(null)
  const [visaSkapa, setVisaSkapa] = useState(false)
  const [kodInmatning, setKodInmatning] = useState('')

  const uppdatera = useCallback(async () => {
    setFel(null)
    const svar = await hamtaBordslista()
    if (!svar.ok) {
      setFel(svar.fel)
      return
    }
    setBord(svar.bord)
    setMitt(svar.mitt)
  }, [])

  useEffect(() => {
    if (signedIn) void uppdatera()
  }, [signedIn, uppdatera])

  if (authLaddar) return null

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <PageHeader title="Spela med vänner">
          Öppna ett bord, bjud in vänner och fyll tomma stolar med bottar — budgivning,
          spelföring eller full bridge.
        </PageHeader>
        <Panel className="space-y-4 text-center">
          <p className="text-ink-soft">Du behöver vara inloggad för att spela vid ett bord.</p>
          <Link to="/logga-in">
            <Button>Logga in</Button>
          </Link>
          <p className="text-sm text-ink-muted">
            Inget konto?{' '}
            <Link to="/registrera" className="font-semibold text-accent underline underline-offset-2">
              Registrera dig
            </Link>
          </p>
        </Panel>
      </div>
    )
  }

  const oppnaBord = bord?.filter((b) => !b.dittBord) ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Spela med vänner">
        Öppna ett bord, bjud in vänner och fyll tomma stolar med bottar — budgivning,
        spelföring eller full bridge.
      </PageHeader>

      {fel && (
        <Panel className="border-l-4 border-danger">
          <p role="alert" className="text-danger">{fel}</p>
        </Panel>
      )}

      {mitt && (
        <Panel className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">Ditt bord</p>
            <p className="text-sm text-ink-muted">Kod {mitt.kod}</p>
          </div>
          <Button onClick={() => navigate(`/bord/${mitt.kod}`)}>Till bordet →</Button>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setVisaSkapa(true)} disabled={!!mitt}>
          Skapa bord
        </Button>
        <Button variant="secondary" onClick={() => void uppdatera()}>
          Uppdatera listan
        </Button>
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const kod = kodInmatning.trim().toUpperCase()
            if (kod) navigate(`/bord/${kod}`)
          }}
        >
          <input
            value={kodInmatning}
            onChange={(e) => setKodInmatning(e.target.value)}
            placeholder="Bordskod"
            aria-label="Gå med via bordskod"
            className="w-28 rounded-lg border border-control-line bg-control px-3 py-2 text-sm uppercase text-ink placeholder:normal-case placeholder:text-ink-faint"
          />
          <Button type="submit" variant="secondary" disabled={!kodInmatning.trim()}>
            Gå med
          </Button>
        </form>
      </div>
      {mitt && (
        <p className="text-sm text-ink-muted">
          Du kan bara ha ett bord i taget — lämna ditt nuvarande för att skapa ett nytt.
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold text-ink">Öppna bord</h2>
        {bord === null ? (
          <p className="mt-2 text-ink-soft">Hämtar bordslistan …</p>
        ) : oppnaBord.length === 0 ? (
          <p className="mt-2 text-ink-soft">Inga öppna bord just nu — skapa det första!</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {oppnaBord.map((b) => (
              <li
                key={b.kod}
                className="flex items-center gap-3 rounded-xl bg-panel p-3 ring-1 ring-line"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {SPELFORM_ETIKETT[b.spelform]} · {b.givar} givar
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {stolText(b)} · {TEMPO_ETIKETT[b.tempo]} tempo
                    {b.status === 'spelar' ? ' · Pågår' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/bord/${b.kod}`)}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink ring-1 ring-line transition-colors hover:bg-surface"
                >
                  {b.status === 'lobby' ? 'Gå med →' : 'Titta →'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {visaSkapa && (
        <SkapaBordDialog
          onClose={() => setVisaSkapa(false)}
          onSkapat={(kod) => navigate(`/bord/${kod}`)}
        />
      )}
    </div>
  )
}
