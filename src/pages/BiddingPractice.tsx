import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { getExercises, getThemesByScope, SCOPES } from '../lib/bidding'
import { loadThemeScore } from '../lib/backend'
import type { Scope } from '../types/bridge'

export function BiddingPractice() {
  const [scope, setScope] = useState<Scope>('opening')
  const themes = getThemesByScope(scope)

  return (
    <div className="space-y-6">
      <PageHeader title="Budträning">
        Välj först ett läge, sedan ett tema att träna på.
      </PageHeader>

      <Panel>
        <p className="text-sm font-semibold text-ink-muted mb-3">1. Välj läge</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              className={`text-left rounded-xl border p-3 transition-colors ${
                scope === s.id
                  ? 'border-emerald-500 bg-accent-soft'
                  : 'border-line bg-panel hover:bg-control-hover'
              }`}
            >
              <div className="font-semibold text-ink">{s.title}</div>
              <div className="text-xs text-ink-muted mt-0.5">{s.description}</div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <p className="text-sm font-semibold text-ink-muted mb-3">2. Välj tema</p>
        <div className="space-y-2">
          {themes.map((t) => {
            const count = getExercises(t.id).length
            const result = loadThemeScore(t.id)
            return (
              <Link
                key={t.id}
                to={`/budtraning/${t.id}`}
                className="flex items-center justify-between rounded-xl border border-line p-4 hover:bg-control-hover transition-colors"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-ink">
                    {t.title}
                    {/* Guldmärket (faceliften 2026-08-02): alla rätt senaste
                        rundan → temat bär en guldspader (guld = belöning). */}
                    {result && result.total > 0 && result.correct === result.total && (
                      <span title="Alla rätt — guldspader!">
                        <BrandMark bare className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-ink-muted">{t.description}</div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-xs text-ink-faint">{count} frågor</div>
                  {result && (
                    /* Guld = belöning (faceliften 2026-08-02): poängen i
                       guldserifen, som en graverad plakett. */
                    <div className="text-sm font-semibold text-ink-muted">
                      Senast:{' '}
                      <span className="font-brand text-base text-gold-600 dark:text-gold-300">
                        {result.correct}/{result.total}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
          {themes.length === 0 && (
            <p className="text-ink-muted text-sm">Inga teman här än – kommer snart.</p>
          )}
        </div>
      </Panel>
    </div>
  )
}
