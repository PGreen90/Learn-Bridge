import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { clearAllProgress, loadValue, saveValue } from '../lib/storage'
import { clearGithubToken, loadGithubToken, saveGithubToken } from '../lib/github-token'
import { setThemeChoice, themeChoice, type ThemeChoice } from '../lib/theme'
import { isSoundEnabled, setSoundEnabled } from '../lib/sound'
import { SPEED_LABEL, type PlaySpeed } from './play/tempo'

/**
 * Länken till GitHubs sida för att skapa en fine-grained token, förifylld med
 * ett namn och den snävaste behörigheten (Issues) redan påslagen. Ägaren
 * behöver bara välja repot Learn-Bridge, sätta utgångsdatum och generera.
 */
const TOKEN_CREATE_URL = 'https://github.com/settings/personal-access-tokens/new'

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
  const [bidHelp, setBidHelp] = useState(() => loadValue('bidHelp', true))
  const [autoClaim, setAutoClaim] = useState(() => loadValue('autoClaim', true))
  const [speed, setSpeed] = useState<PlaySpeed>(() => loadValue<PlaySpeed>('playSpeed', 'normal'))

  const [done, setDone] = useState(false)
  const [token, setToken] = useState(() => loadGithubToken() ?? '')
  const [saved, setSaved] = useState(false)
  const hasToken = loadGithubToken() !== null

  function handleReset() {
    clearAllProgress()
    setDone(true)
  }

  function handleSaveToken() {
    saveGithubToken(token)
    setSaved(true)
  }

  function handleClearToken() {
    clearGithubToken()
    setToken('')
    setSaved(false)
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
              saveValue('bidHelp', !bidHelp)
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
              saveValue('autoClaim', !autoClaim)
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
              saveValue('playSpeed', v)
              setSpeed(v)
            }}
          />
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold mb-2">Nollställ framsteg</h2>
        <p className="text-ink-soft mb-4">
          Raderar allt appen sparat i den här webbläsaren (t.ex. vilka frågor du
          klarat och din Dagens giv-svit). Går inte att ångra. (GitHub-nyckeln
          nedan påverkas inte.)
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

      {/* Ägarverktyget (Etapp D): hopfällt längst ner — en vanlig besökare
          möttes förr av GitHub-instruktioner som första (och enda) innehåll. */}
      <Panel>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-ink-soft">
            För appens ägare: skicka felrapporter direkt till GitHub
          </summary>
          <div className="pt-3">
            <p className="text-ink-soft mb-3">
              Slå på det här så skickas felrapporter direkt med ett klick – du slipper
              gå in på GitHub. Klistra in en GitHub-nyckel nedan (skapas en gång).
              Nyckeln sparas bara i den här webbläsaren.
            </p>

            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft mb-3">
              <li>
                Öppna{' '}
                <a
                  href={TOKEN_CREATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  GitHubs sida för att skapa en nyckel
                </a>{' '}
                (du måste vara inloggad som PGreen90).
              </li>
              <li>Ge den ett namn, t.ex. ”rebidz felrapporter”, och sätt ett utgångsdatum.</li>
              <li>
                Under <strong>Repository access</strong>: välj <strong>Only select repositories</strong>{' '}
                → <strong>Learn-Bridge</strong>.
              </li>
              <li>
                Under <strong>Permissions → Repository permissions → Issues</strong>: välj{' '}
                <strong>Read and write</strong>.
              </li>
              <li>
                Klicka <strong>Generate token</strong>, kopiera nyckeln och klistra in den här nedanför.
              </li>
            </ol>

            <input
              type="password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value)
                setSaved(false)
              }}
              placeholder="github_pat_…"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-line-strong bg-control p-2 text-sm text-ink focus:border-emerald-500 focus:outline-none"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button onClick={handleSaveToken} disabled={!token.trim()}>
                Spara nyckel
              </Button>
              {hasToken && (
                <Button variant="secondary" onClick={handleClearToken}>
                  Ta bort nyckel
                </Button>
              )}
              {saved && (
                <span className="text-accent text-sm">
                  ✓ Sparad – felrapporter skickas nu direkt.
                </span>
              )}
            </div>

            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              Nyckeln lämnar aldrig den här webbläsaren och ligger inte i appens kod.
              Den kan bara skapa felrapporter i Learn-Bridge – inget annat. Har du inte
              sparat någon nyckel öppnas rapporten som förr på GitHub.
            </p>
          </div>
        </details>
      </Panel>
    </div>
  )
}
