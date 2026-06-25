import { Panel } from '../components/Panel'

export function Learn() {
  return (
    <div className="space-y-6">
      <Panel>
        <h1 className="text-2xl font-bold mb-2">Lär dig 2/1-systemet</h1>
        <p className="text-slate-600">
          Här kommer förklaringar av buden, steg för steg. Innehållet fylls på
          allt eftersom.
        </p>
      </Panel>
      <Panel>
        <h2 className="text-lg font-semibold mb-2">Planerade avsnitt</h2>
        <ul className="list-disc list-inside text-slate-600 space-y-1">
          <li>Honnörspoäng – hur man räknar styrkan i sin hand</li>
          <li>Öppningsbud</li>
          <li>Svar till partnerns öppning</li>
          <li>Vad betyder "2 över 1"?</li>
        </ul>
      </Panel>
    </div>
  )
}
