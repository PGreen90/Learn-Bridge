// Skapa konto (Beslut B etapp 1, steg 5b).

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { Button } from '../../components/Button'
import { useAuth } from '../../components/AuthProvider'
import { signUp } from '../../lib/backend/auth'
import { validateDisplayName } from '../../lib/backend/display-name'
import { Field, FormError, FormNote, errorText } from './parts'

export function Registrera() {
  const navigate = useNavigate()
  const { signedIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [is13Plus, setIs13Plus] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (signedIn) navigate('/konto', { replace: true })
  }, [signedIn, navigate])

  // Levande namnkontroll: visa felet först när fältet har innehåll.
  const nameCheck = useMemo(() => validateDisplayName(displayName), [displayName])
  const nameError = displayName.length > 0 && !nameCheck.ok ? nameCheck.message : null

  const canSubmit =
    nameCheck.ok && is13Plus && acceptTerms && email.length > 0 && password.length > 0 && !busy

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signUp({ email, password, displayName, is13Plus })
      setDone(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <PageHeader title="Nästan klar" />
        <Panel>
          <div className="space-y-4">
            <FormNote>
              Vi har skickat ett bekräftelsemejl till <strong>{email}</strong>. Klicka på länken
              i mejlet för att aktivera kontot och logga in. Kolla även skräpposten.
            </FormNote>
            <p className="text-sm text-ink-soft">
              När du bekräftat: <Link to="/logga-in" className="font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-300">logga in här</Link>.
            </p>
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader title="Skapa konto" />
      <Panel>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <FormError>{error}</FormError>}
          <Field
            id="displayName"
            label="Visningsnamn"
            hint={
              nameError ?? '4–10 tecken: bokstäver, siffror, _ och -. Syns för andra spelare. Låst efteråt — välj med omsorg.'
            }
            autoComplete="off"
            maxLength={10}
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
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
            hint="Minst 8 tecken."
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-emerald-600"
              checked={is13Plus}
              onChange={(e) => setIs13Plus(e.target.checked)}
            />
            <span>Jag är minst 13 år.</span>
          </label>

          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-emerald-600"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            <span>
              Jag har läst och godkänner{' '}
              <Link to="/villkor" className="underline underline-offset-2 hover:text-ink">användarvillkoren</Link>{' '}
              och{' '}
              <Link to="/integritet" className="underline underline-offset-2 hover:text-ink">integritetspolicyn</Link>.
            </span>
          </label>

          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit}>
              {busy ? 'Skapar konto…' : 'Skapa konto'}
            </Button>
          </div>
        </form>
      </Panel>
      <p className="text-center text-sm text-ink-soft">
        Har du redan ett konto?{' '}
        <Link to="/logga-in" className="font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-300">
          Logga in
        </Link>
      </p>
    </div>
  )
}
