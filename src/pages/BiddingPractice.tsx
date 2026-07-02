import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Panel } from '../components/Panel'
import { getExercises, getThemesByScope, SCOPES } from '../lib/bidding'
import { loadValue } from '../lib/storage'
import type { Scope } from '../types/bridge'

interface ThemeResult {
  correct: number
  total: number
}

export function BiddingPractice() {
  const [scope, setScope] = useState<Scope>('opening')
  const themes = getThemesByScope(scope)

  return (
    <div className="space-y-6">
      <Panel>
        <h1 className="text-2xl font-bold mb-1">Budträning</h1>
        <p className="text-slate-600 dark:text-slate-400">Välj först ett läge, sedan ett tema att träna på.</p>
      </Panel>

      <Panel>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">1. Välj läge</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              className={`text-left rounded-xl border p-3 transition-colors ${
                scope === s.id
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                  : 'border-emerald-950/10 bg-white hover:bg-club-50 dark:border-emerald-100/10 dark:bg-club-900 dark:hover:bg-club-800'
              }`}
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">{s.title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.description}</div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">2. Välj tema</p>
        <div className="space-y-2">
          {themes.map((t) => {
            const count = getExercises(t.id).length
            const result = loadValue<ThemeResult | null>(`theme:${t.id}`, null)
            return (
              <Link
                key={t.id}
                to={`/budtraning/${t.id}`}
                className="flex items-center justify-between rounded-xl border border-emerald-950/10 p-4 hover:bg-club-50 transition-colors dark:border-emerald-100/10 dark:hover:bg-club-800"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{t.title}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{t.description}</div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-xs text-slate-400 dark:text-slate-500">{count} frågor</div>
                  {result && (
                    <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      Senast: {result.correct}/{result.total}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
          {themes.length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-sm">Inga teman här än – kommer snart.</p>
          )}
        </div>
      </Panel>
    </div>
  )
}
