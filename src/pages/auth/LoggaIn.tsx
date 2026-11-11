// Logga in (Beslut B etapp 1, steg 5b).

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { Button } from '../../components/Button'
import { useAuth } from '../../components/AuthProvider'
import { signIn } from '../../lib/backend/auth'
import { inloggLank, malEfterInloggning } from '../../lib/efter-inloggning'
import { Field, FormError, errorText } from './parts'

export function LoggaIn() {
  const navigate = useNavigate()
  const { signedIn } = useAuth()
  // Vart man var på väg (t.ex. Dagens tävling) — dit ska man tillbaka efteråt.
  const [params] = useSearchParams()
  const till = params.get('till')
  const mal = useRef<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Inloggad (redan, eller nyss) → tillbaka dit man var på väg, annars kontosidan.
  // EN väg för båda fallen, så det sparade målet bara läses (och glöms) en gång.
  useEffect(() => {
    if (!signedIn) return
    // Räknas ut EN gång: det sparade målet glöms när det lästs, och effekten
    // kan köras två gånger (utvecklingsläget).
    mal.current ??= malEfterInloggning(till)
    navigate(mal.current, { replace: true })
  }, [signedIn, navigate, till])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password)
      // Vidare sker i effekten ovan när inloggningen slagit igenom.
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader title="Logga in" />
      <Panel>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <FormError>{error}</FormError>}
          <Field
            id="email"
            label="E-post"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            id="password"
            label="Lösenord"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/glomt-losenord"
              className="text-sm text-ink-soft underline underline-offset-2 hover:text-ink"
            >
              Glömt lösenordet?
            </Link>
            <Button type="submit" disabled={busy}>
              {busy ? 'Loggar in…' : 'Logga in'}
            </Button>
          </div>
        </form>
      </Panel>
      <p className="text-center text-sm text-ink-soft">
        Har du inget konto?{' '}
        <Link to={inloggLank('/registrera', till)} className="font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-300">
          Skapa konto
        </Link>
      </p>
    </div>
  )
}
