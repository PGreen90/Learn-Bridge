// Klientens väg till den öppna rapportmottagaren (/api/rapport, nästa nivå
// etapp 1, 2026-11-11). Felrapporter, förslag och "Tyck till" skickas hit —
// ingen inloggning och ingen nyckel i webbläsaren. Kastar ett Error med ett
// begripligt svenskt meddelande så dialogen kan visa det rakt av.

export type RapportTyp = 'felrapport' | 'forslag' | 'tycktill'

export interface Rapport {
  typ: RapportTyp
  titel: string
  text: string
  /** Lockfällan: ett fält som är osynligt för människor. Robotar fyller i det
   *  och servern kastar då rapporten tyst. */
  webbplats?: string
}

export async function skickaRapport(rapport: Rapport): Promise<void> {
  let res: Response
  try {
    res = await fetch('/api/rapport', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rapport),
    })
  } catch {
    throw new Error('Kunde inte nå servern – kontrollera din internetanslutning.')
  }
  if (res.ok) return
  if (res.status === 429) {
    throw new Error('Du har skickat många rapporter på kort tid – vänta några minuter och försök igen.')
  }
  if (res.status === 413) throw new Error('Texten är för lång – korta ner den lite.')
  throw new Error(`Rapporten kunde inte tas emot just nu (felkod ${res.status}).`)
}
