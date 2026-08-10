// Mitt konto (Beslut B etapp 1, steg 5b + 6). Visar visningsnamn + e-post, låter
// användaren logga ut, exportera sin data (GDPR-portabilitet) och radera kontot
// ("radera allt", oåterkalleligt).

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { Button } from '../../components/Button'
import { useAuth } from '../../components/AuthProvider'
import { deleteOwnAccount, exportMyData } from '../../lib/backend/account'
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
  const [confirmText, setConfirmText] = useState('')

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

  async function onExport() {
    setError(null)
    try {
      const data = await exportMyData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rebidz-min-data.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(errorText(err))
    }
  }

  async function onDelete() {
    setError(null)
    setBusy(true)
    try {
      await deleteOwnAccount()
      // Sessionen är nu ogiltig — logga ut lokalt och gå hem.
      await signOut().catch(() => {})
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader title="Mitt konto" />

      {error && <FormError>{error}</FormError>}

      <Panel>
        <div className="space-y-1">
          <Row label="Visningsnamn" value={profile?.display_name ?? '—'} />
          <Row label="E-post" value={user?.email ?? '—'} />
        </div>
      </Panel>

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onExport} disabled={busy}>
          Exportera min data
        </Button>
        <Button variant="secondary" onClick={onSignOut} disabled={busy}>
          {busy ? 'Loggar ut…' : 'Logga ut'}
        </Button>
      </div>

      {/* Farozon: radera konto. Kräver att man skriver RADERA för att undvika
          olyckor — åtgärden är oåterkallelig och tar bort ALLT. */}
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
        <h2 className="text-base font-semibold text-red-700 dark:text-red-300">Radera konto</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Tar bort ditt konto och <strong>all</strong> din data permanent. Detta går inte att
          ångra. Skriv <strong>RADERA</strong> i rutan för att bekräfta.
        </p>
        <input
          aria-label="Skriv RADERA för att bekräfta"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="RADERA"
          className="mt-3 w-full rounded-lg border border-control-line bg-control px-3 py-2 text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onDelete}
            disabled={busy || confirmText !== 'RADERA'}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Raderar…' : 'Radera konto permanent'}
          </button>
        </div>
      </div>
    </div>
  )
}
