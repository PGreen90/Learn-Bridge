// Inloggningslänkens landningssida (Beslut B etapp 1, steg 5b). Hit hamnar man
// efter att ha klickat en bekräftelse- eller återställningslänk i mejlet (via
// bootstrappen som flyttade in parametrarna i #-adressen). Här slutförs
// inloggningen och man skickas vidare till rätt ställe.

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { BrandMark } from '../../components/BrandMark'
import { exchangeCodeForSession, verifyEmailOtp } from '../../lib/backend/auth'
import { FormError, errorText } from './parts'

export function AuthCallback() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    // Kör bara en gång (även under StrictMode:s dubbelkörning) — en kod/token får
    // bara lösas in en gång.
    if (ran.current) return
    ran.current = true

    const tokenHash = params.get('token_hash')
    const type = params.get('type') as EmailOtpType | null
    const code = params.get('code')
    const flow = params.get('flow')
    const linkError = params.get('error_description') ?? params.get('error')

    const isReset = type === 'recovery' || flow === 'reset'
    const target = isReset ? '/nytt-losenord' : '/konto'

    async function run() {
      if (linkError) {
        setError('Länken gick inte att använda: ' + linkError)
        return
      }
      try {
        if (tokenHash && type) {
          await verifyEmailOtp(tokenHash, type)
        } else if (code) {
          await exchangeCodeForSession(code)
        } else {
          setError('Ogiltig länk — parametrar saknas.')
          return
        }
        navigate(target, { replace: true })
      } catch (err) {
        setError(errorText(err))
      }
    }

    void run()
  }, [params, navigate])

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader title="Loggar in" />
      <Panel>
        {error ? (
          <div className="space-y-3">
            <FormError>{error}</FormError>
            <p className="text-sm text-ink-soft">
              Prova att{' '}
              <a href="#/logga-in" className="underline underline-offset-2 hover:text-ink">
                logga in
              </a>{' '}
              eller begära en ny länk.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-ink-soft">
            <BrandMark bare className="gold-pulse h-6 w-6" />
            <span>Ett ögonblick — vi slutför inloggningen…</span>
          </div>
        )}
      </Panel>
    </div>
  )
}
