// Budträningen — temalistan (nästa nivå etapp 3, 2026-11-11).
//
// Ersätter den gamla tvåstegsväljaren (läge → tema) med handskrivna frågor.
// Nu är varje tema en BUDSITUATION som motorn delar obegränsat med givar för
// (engine/traning.ts). Listan visar formen just nu per tema: träffprocenten på
// de senaste svaren.

import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { SuitText } from '../components/SuitText'
import { loadTraningslogg } from '../lib/backend'
import { TRANINGSTEMAN } from '../lib/engine/traning'

/** Guldspadern delas ut när formen är riktigt bra över ett rimligt antal svar. */
const GULD_MIN_SVAR = 10
const GULD_ANDEL = 0.9

export function Budtraning() {
  return (
    <div className="space-y-6">
      <PageHeader title="Budträning">
        Välj en situation. Du får en ny giv varje gång, bjuder i budlådan — och ser direkt
        vad rebidz bjuder och varför.
      </PageHeader>

      <Panel>
        <div className="space-y-2">
          {TRANINGSTEMAN.map((t) => {
            const logg = loadTraningslogg(t.id)
            const ratt = logg.filter(Boolean).length
            const guld = logg.length >= GULD_MIN_SVAR && ratt / logg.length >= GULD_ANDEL
            return (
              <Link
                key={t.id}
                to={`/budtraning/${t.id}`}
                className="focus-ring flex items-center justify-between gap-3 rounded-xl border border-line p-4 transition-colors hover:bg-control-hover"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-semibold text-ink">
                    <SuitText>{t.titel}</SuitText>
                    {/* Guld = belöning (faceliften 2026-08-02). */}
                    {guld && (
                      <span title="Minst nio av tio rätt på de senaste svaren">
                        <BrandMark bare className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-ink-muted">{t.beskrivning}</div>
                </div>
                <div className="shrink-0 text-right">
                  {logg.length > 0 ? (
                    <>
                      <div className="font-brand text-lg leading-tight text-gold-600 dark:text-gold-300">
                        {Math.round((ratt / logg.length) * 100)} %
                      </div>
                      <div className="text-xs text-ink-faint">senaste {logg.length}</div>
                    </>
                  ) : (
                    <div className="text-xs text-ink-faint">inte provat</div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </Panel>

      <p className="px-1 text-sm text-ink-muted">
        Facit är alltid det bud rebidz själv gör i läget, enligt{' '}
        <Link to="/budsystem" className="text-accent underline">
          systemboken
        </Link>
        . Är du ny på 2 över 1? Börja med{' '}
        <Link to="/sa-bjuder-rebidz" className="text-accent underline">
          Så bjuder rebidz
        </Link>
        .
      </p>
    </div>
  )
}
