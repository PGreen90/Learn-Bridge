// Mitt konto (Beslut B etapp 1, steg 5b). Visar visningsnamn + e-post och låter
// användaren logga ut. Radera/exportera konto byggs in i steg 6.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { Button } from '../../components/Button'
import { useAuth } from '../../components/AuthProvider'
import { errorText, FormError } from './parts'

/** En etikett-/värde-rad. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  )
}

export function Konto() {
  const navigate = useNavigate()
  const { loading, signedIn, user, profile, signOut } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Inte inloggad (och klar med laddningen) → till inloggningen.
  useEffect(() => {
    if (!loading && !signedIn) navigate('/logga-in', { replace: true })
  }, [loading, signedIn, navigate])

  if (loading || !signedIn) return null

  async function onSignOut() {
    setError(null)
    setBusy(true)
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader title="Mitt konto" />
      <Panel>
        <div className="space-y-1">
          {error && (
            <div className="pb-3">
              <FormError>{error}</FormError>
            </div>
          )}
          <Row label="Visningsnamn" value={profile?.display_name ?? '—'} />
          <Row label="E-post" value={user?.email ?? '—'} />
        </div>
      </Panel>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onSignOut} disabled={busy}>
          {busy ? 'Loggar ut…' : 'Logga ut'}
        </Button>
      </div>
    </div>
  )
}
