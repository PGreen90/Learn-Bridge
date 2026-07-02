import { useState } from 'react'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { clearAllProgress } from '../lib/storage'

export function Settings() {
  const [done, setDone] = useState(false)

  function handleReset() {
    clearAllProgress()
    setDone(true)
  }

  return (
    <div className="space-y-6">
      <Panel>
        <h1 className="text-2xl font-bold mb-2">Inställningar</h1>
        <p className="text-slate-600 dark:text-slate-400">Här hanterar du appen och dina framsteg.</p>
      </Panel>
      <Panel>
        <h2 className="text-lg font-semibold mb-2">Nollställ framsteg</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Raderar allt appen sparat i den här webbläsaren (t.ex. vilka frågor du
          klarat). Går inte att ångra.
        </p>
        <Button variant="secondary" onClick={handleReset}>
          Nollställ mina framsteg
        </Button>
        {done && (
          <p className="text-emerald-700 dark:text-emerald-400 mt-3">
            ✓ Klart – framstegen är nollställda.
          </p>
        )}
      </Panel>
    </div>
  )
}
