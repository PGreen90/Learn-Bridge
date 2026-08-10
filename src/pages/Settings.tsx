import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import {
  clearAllLocalData,
  loadAutoClaim,
  loadBidHelp,
  loadPlaySpeed,
  saveAutoClaim,
  saveBidHelp,
  savePlaySpeed,
} from '../lib/backend'
import { setThemeChoice, themeChoice, type ThemeChoice } from '../lib/theme'
import { isSoundEnabled, setSoundEnabled } from '../lib/sound'
import { SPEED_LABEL, type PlaySpeed } from './play/tempo'

// OBS (ägarbeslut 2026-08-03): panelen för GitHub-nyckeln (felrapporter direkt
// till GitHub) är helt BORTTAGEN ur gränssnittet — funktionen finns kvar i
// bakgrunden (lib/github-token.ts läses av FelrapportDialog, nyckeln ligger
// kvar i localStorage). Behöver nyckeln bytas när den gått ut: be Claude
// plocka fram panelen igen, eller kör i webbläsarkonsolen (rå sträng, ej JSON):
//   localStorage.setItem('rebidz:felrapport-token', 'github_pat_…')

/** En rad med av/på-knapp — Inställningssidans motsvarighet till spelmenyns
 *  toggles (egen, lätt variant: sidan ska inte dra in spelbordets moduler). */
function ToggleRow({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string
  hint: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <div className="text-sm font-semibold text-ink">{label}</div>
        <div className="text-xs text-ink-muted">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          on ? 'bg-emerald-600' : 'bg-line-strong'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

/** En rad med flervalsknappar (tema, tempo). */
function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="text-sm font-semibold text-ink">{label}</div>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
              value === o.value
                ? 'bg-emerald-700 text-white'
                : 'bg-control text-ink-soft hover:bg-hover-veil'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Settings() {
  // Spelinställningarna (Etapp D, granskningen 2026-08-02): samma lagrings-
  // nycklar som spelets ⋮-meny — förr fanns de BARA där, gömda mitt i spelet.
  // En ändring här slår igenom när nästa giv/bord monteras.
  const [theme, setTheme] = useState<ThemeChoice>(() => themeChoice())
  const [sound, setSound] = useState(() => isSoundEnabled())
  const [bidHelp, setBidHelp] = useState(() => loadBidHelp())
  const [autoClaim, setAutoClaim] = useState(() => loadAutoClaim())
  const [speed, setSpeed] = useState<PlaySpeed>(() => loadPlaySpeed())

  const [done, setDone] = useState(false)

  function handleReset() {
    clearAllLocalData()
    setDone(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inställningar">
        Här hanterar du appen och dina framsteg.
      </PageHeader>

      <Panel>
        <h2 className="text-lg font-semibold mb-1">Utseende</h2>
        <ChoiceRow
          label="Läge"
          value={theme}
          options={[
            { value: 'light', label: 'Ljust' },
            { value: 'dark', label: 'Mörkt' },
            { value: 'system', label: 'Följ systemet' },
          ]}
          onChange={(v) => {
            setTheme(v)
            setThemeChoice(v)
          }}
        />
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold mb-1">Spelet</h2>
        <p className="text-xs text-ink-muted mb-2">
          Samma inställningar finns i ⋮-menyn vid spelbordet. En ändring här
          gäller från nästa giv.
        </p>
        <div className="divide-y divide-line">
          <ToggleRow
            label="Budstöd"
            hint="motorns hintar och förklaringar i budlådan"
            on={bidHelp}
            onToggle={() => {
              saveBidHelp(!bidHelp)
              setBidHelp(!bidHelp)
            }}
          />
          <ToggleRow
            label="Ljud"
            hint="diskreta kortljud"
            on={sound}
            onToggle={() => {
              setSoundEnabled(!sound)
              setSound(!sound)
            }}
          />
          <ToggleRow
            label="Auto Claim"
            hint="säkra stick tas automatiskt i slutet av given"
            on={autoClaim}
            onToggle={() => {
              saveAutoClaim(!autoClaim)
              setAutoClaim(!autoClaim)
            }}
          />
          <ChoiceRow
            label="Tempo"
            value={speed}
            options={(['lugn', 'normal', 'snabb'] as PlaySpeed[]).map((v) => ({
              value: v,
              label: SPEED_LABEL[v],
            }))}
            onChange={(v) => {
              savePlaySpeed(v)
              setSpeed(v)
            }}
          />
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold mb-2">Nollställ framsteg</h2>
        <p className="text-ink-soft mb-4">
          Raderar allt appen sparat i den här webbläsaren (t.ex. vilka frågor du
          klarat och din Dagens giv-svit). Går inte att ångra.
        </p>
        <Button variant="secondary" onClick={handleReset}>
          Nollställ mina framsteg
        </Button>
        {done && (
          <p className="text-accent mt-3">
            ✓ Klart – framstegen är nollställda.
          </p>
        )}
      </Panel>

    </div>
  )
}
