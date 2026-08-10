// Glömt lösenord — begär återställningsmejl (Beslut B etapp 1, steg 5b).

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { Button } from '../../components/Button'
import { sendPasswordReset } from '../../lib/backend/auth'
import { Field, FormError, FormNote, errorText } from './parts'

export function GlomtLosenord() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await sendPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader title="Glömt lösenord" />
      <Panel>
        {sent ? (
          <FormNote>
            Om det finns ett konto med <strong>{email}</strong> har vi skickat en
            återställningslänk dit. Öppna länken i mejlet för att välja ett nytt lösenord.
          </FormNote>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <FormError>{error}</FormError>}
            <p className="text-sm text-ink-soft">
              Skriv din e-postadress så skickar vi en länk där du kan välja ett nytt lösenord.
            </p>
            <Field
              id="email"
              label="E-post"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? 'Skickar…' : 'Skicka länk'}
              </Button>
            </div>
          </form>
        )}
      </Panel>
      <p className="text-center text-sm text-ink-soft">
        <Link to="/logga-in" className="underline underline-offset-2 hover:text-ink">
          Tillbaka till inloggning
        </Link>
      </p>
    </div>
  )
}
