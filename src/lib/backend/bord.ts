// Beslut B etapp 4 (4A) — klientens enda väg till borden ("Spela med vänner").
//
// Samma princip som tavling.ts: sidorna känner aldrig till nätverket direkt —
// tunna fetch-omslag mot /api/bord?h=... plus realtidsprenumerationen på
// bordets händelselogg (Supabase Realtime, Postgres Changes på table_events;
// RLS släpper bara igenom bordets deltagare).
//
// Realtime är LATENSSOCKER, inte sanningen: hjärtslaget (var 5:e sekund) är
// den auktoritativa synkvägen — svarar det med ett högre sekvensnummer än
// klienten sett hämtas läget om. Bordet fungerar alltså även om realtidskanalen
// är nere, bara långsammare.

import type { Seat } from '../../types/bridge'
import { getCurrentSession } from './auth'
import { getSupabase, hasSupabaseConfig } from './supabase'

// ---------------------------------------------------------------------------
// Former (speglar serverns svar i api-src/bord.ts).

export type BordSpelform = 'budgivning' | 'spelforing' | 'full'
export type BordTempo = 'lugn' | 'normal' | 'snabb'
export type BordStatus = 'lobby' | 'spelar' | 'klar' | 'avslutat'

export interface BordStol {
  stol: Seat
  typ: 'manniska' | 'bot' | 'ledig'
  namn: string | null
  status: string
}

export interface BordIListan {
  kod: string
  status: BordStatus
  spelform: BordSpelform
  givar: number
  tempo: BordTempo
  privat: boolean
  stolar: BordStol[]
  dittBord: boolean
}

export interface BordMeta {
  id: string
  kod: string
  status: BordStatus
  spelform: BordSpelform
  givar: number
  tempo: BordTempo
  privat: boolean
  aktuellGiv: number
  duArAgare: boolean
  dinStol: Seat | null
}

/** En rad ur bordets händelselogg. `data` innehåller aldrig dolda händer. */
export interface BordHandelse {
  seq: number
  giv: number
  typ: string
  seat: Seat | null
  data: Record<string, unknown>
}

export interface BordLage {
  meta: BordMeta
  stolar: BordStol[]
  events: BordHandelse[]
  senasteSeq: number
}

/** Alla anrop svarar i den här formen — kallaren grenkar på `ok` utan try/catch. */
export type BordSvar<T> = ({ ok: true } & T) | { ok: false; fel: string; status?: number }

// ---------------------------------------------------------------------------
// Anropen.

async function anrop<T>(
  metod: 'GET' | 'POST',
  handling: string,
  { query = '', body }: { query?: string; body?: unknown } = {},
): Promise<BordSvar<T>> {
  const session = await getCurrentSession()
  const token = session?.access_token
  if (!token) return { ok: false, fel: 'Inte inloggad' }
  let res: Response
  try {
    res = await fetch(`/api/bord?h=${handling}${query}`, {
      method: metod,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    return { ok: false, fel: 'Kunde inte nå servern. Kontrollera nätet och försök igen.' }
  }
  const data = (await res.json().catch(() => null)) as
    | ({ ok?: boolean; fel?: string } & T)
    | null
  if (!res.ok || !data || data.ok !== true) {
    return {
      ok: false,
      fel: data?.fel ?? `Servern svarade ${res.status}.`,
      status: res.status,
    }
  }
  return { ...(data as { ok: true } & T) }
}

export interface SkapaBordInstallningar {
  spelform: BordSpelform
  givar: number
  tempo: BordTempo
  privat: boolean
  stol?: Seat
}

export function skapaBord(
  installningar: SkapaBordInstallningar,
): Promise<BordSvar<{ bord: { kod: string } }>> {
  return anrop('POST', 'skapa', { body: installningar })
}

export function hamtaBordslista(): Promise<
  BordSvar<{ bord: BordIListan[]; mitt: { kod: string; stol: Seat } | null }>
> {
  return anrop('GET', 'lista')
}

export function gaMedBord(
  kod: string,
  stol?: Seat,
): Promise<BordSvar<{ kod: string; stol: Seat }>> {
  return anrop('POST', 'ga-med', { body: { kod, stol } })
}

export function hamtaBordLage(kod: string, fran = 0): Promise<BordSvar<BordLage>> {
  return anrop('GET', 'lage', { query: `&bord=${encodeURIComponent(kod)}&fran=${fran}` })
}

export function bordHjartslag(
  kod: string,
  seq: number,
): Promise<BordSvar<{ senasteSeq: number; events: BordHandelse[] }>> {
  return anrop('POST', 'hjartslag', { body: { kod, seq } })
}

export type StolHandling = 'byt-stol' | 'lamna' | 'avsluta'

export function stolHandling(
  kod: string,
  handling: StolHandling,
  stol?: Seat,
): Promise<BordSvar<{ stol?: Seat; avslutat?: boolean }>> {
  return anrop('POST', 'stol', { body: { kod, handling, stol } })
}

// ---------------------------------------------------------------------------
// Realtidsprenumerationen.

/** Prenumerera på nya händelser för ett bord (via dess tabell-id ur BordMeta).
 *  Returnerar en avregistreringsfunktion. Kräver inloggad session — RLS på
 *  table_events auktoriserar prenumerationen mot deltagarlistan. */
export function prenumereraBordHandelser(
  bordId: string,
  onHandelse: (h: BordHandelse) => void,
): () => void {
  if (!hasSupabaseConfig()) return () => {}
  const supabase = getSupabase()
  const kanal = supabase
    .channel(`bord-${bordId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'table_events',
        filter: `table_id=eq.${bordId}`,
      },
      (payload) => {
        const rad = payload.new as {
          seq?: number
          giv?: number
          typ?: string
          seat?: Seat | null
          data?: Record<string, unknown>
        }
        if (typeof rad.seq !== 'number' || typeof rad.typ !== 'string') return
        onHandelse({
          seq: rad.seq,
          giv: rad.giv ?? 0,
          typ: rad.typ,
          seat: rad.seat ?? null,
          data: rad.data ?? {},
        })
      },
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(kanal)
  }
}
