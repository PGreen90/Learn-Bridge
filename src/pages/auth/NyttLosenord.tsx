// Välj nytt lösenord (Beslut B etapp 1, steg 5b). Nås via återställningslänken —
// callbacken har då redan loggat in sessionen, så updateUser får sätta lösenordet.

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { Button } from '../../components/Button'
import { useAuth } from '../../components/AuthProvider'
import { updatePassword } from '../../lib/backend/auth'
import { Field, FormError, FormNote, errorText } from './parts'

export function NyttLosenord() {
  const navigate = useNavigate()
  const { signedIn, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== repeat) {
      setError('Lösenorden matchar inte.')
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/konto', { replace: true }), 1500)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader title="Nytt lösenord" />
      <Panel>
        {done ? (
          <FormNote>Lösenordet är uppdaterat. Skickar dig vidare…</FormNote>
        ) : !loading && !signedIn ? (
          <div className="space-y-3">
            <FormError>
              Länken verkar ha gått ut eller redan använts. Begär en ny från "Glömt lösenord".
            </FormError>
            <p className="text-sm text-ink-soft">
              <Link to="/glomt-losenord" className="underline underline-offset-2 hover:text-ink">
                Begär ny återställningslänk
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <FormError>{error}</FormError>}
            <Field
              id="password"
              label="Nytt lösenord"
              hint="Minst 8 tecken."
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Field
              id="repeat"
              label="Upprepa lösenord"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? 'Sparar…' : 'Spara lösenord'}
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  )
}
