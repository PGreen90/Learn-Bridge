import { useState } from 'react'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { clearAllProgress } from '../lib/storage'
import { clearGithubToken, loadGithubToken, saveGithubToken } from '../lib/github-token'

/**
 * Länken till GitHubs sida för att skapa en fine-grained token, förifylld med
 * ett namn och den snävaste behörigheten (Issues) redan påslagen. Ägaren
 * behöver bara välja repot Learn-Bridge, sätta utgångsdatum och generera.
 */
const TOKEN_CREATE_URL =
  'https://github.com/settings/personal-access-tokens/new'

export function Settings() {
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
      <Panel>
        <h1 className="text-2xl font-bold mb-2">Inställningar</h1>
        <p className="text-ink-soft">Här hanterar du appen och dina framsteg.</p>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold mb-2">Skicka felrapporter direkt</h2>
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
          <li>Ge den ett namn, t.ex. ”RebidZ felrapporter”, och sätt ett utgångsdatum.</li>
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
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold mb-2">Nollställ framsteg</h2>
        <p className="text-ink-soft mb-4">
          Raderar allt appen sparat i den här webbläsaren (t.ex. vilka frågor du
          klarat). Går inte att ångra. (GitHub-nyckeln ovan påverkas inte.)
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
