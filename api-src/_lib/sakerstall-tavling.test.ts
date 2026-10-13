// FACIT FÖRE FIX — nattkedjans härdning (ägarbeslut 2026-10-13: "mer stabilt
// och pålitligt"). Natten till 2026-10-13 skapade Vercel-cronen ingen tävling:
// genereringens egen rest() gjorde ETT anrop och kastade på första 5xx, inget
// försökte om, och botspelet blev rött kl 05:54 med "Ingen tävling". Dagen fick
// räddas för hand (vercel crons run + omkörning av botspelet).
//
// Den delade funktionen `sakerstallTavling` är nu EN källa för "se till att
// dagens tävling finns": cronen OCH nattbottarna anropar den. Kraven här:
//   1. transient 5xx på set-upserten → omförsök, dagen skapas ändå;
//   2. finns setet redan → `skapad: false`, men set + givar skrivs ändå
//      idempotent (ett set utan givar efter ett halvt haveri läks);
//   3. givarna är exakt de genereraGivar ger ur hemligheten (samma som
//      valideringen spelar om) — aldrig något annat;
//   4. 4xx (äkta fel) kastar direkt utan omförsök; ihållande 5xx kastar efter
//      sista försöket med tabellnamn + status i felet.
import { afterEach, describe, expect, test, vi } from 'vitest'
import { sakerstallTavling } from './sakerstall-tavling'
import { genereraGivar } from './generera'
import { fronyckel } from './seed'

const BAS = 'https://exempel.supabase.co'
const NYCKEL = 'service-nyckel'
const HEMLIS = 'test-hemlighet'
const DAG = '2026-10-13'

type Anrop = { method: string; url: string; prefer: string | null; body: unknown }

/** En fetch-attrapp som spelar upp ett manus per (metod, tabell) och loggar anropen. */
function attrapp(manus: { setPost?: number[]; dealsPost?: number[]; setGet?: unknown }) {
  const anrop: Anrop[] = []
  let setPostNr = 0
  let dealsPostNr = 0
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const headers = (init?.headers ?? {}) as Record<string, string>
    anrop.push({ method, url, prefer: headers.Prefer ?? null, body: init?.body ? JSON.parse(String(init.body)) : null })
    if (method === 'GET' && url.includes('/daily_sets?')) {
      return new Response(JSON.stringify(manus.setGet ?? []), { status: 200 })
    }
    if (method === 'POST' && url.includes('/daily_sets')) {
      const status = manus.setPost?.[setPostNr++] ?? 201
      return new Response(status < 300 ? JSON.stringify([{ id: 'set-1' }]) : 'upstream fel', { status })
    }
    if (method === 'POST' && url.includes('/daily_deals')) {
      const status = manus.dealsPost?.[dealsPostNr++] ?? 201
      return new Response('', { status })
    }
    throw new Error(`oväntat anrop: ${method} ${url}`)
  })
  vi.stubGlobal('fetch', fn)
  return { anrop, fn }
}

afterEach(() => vi.unstubAllGlobals())

describe('sakerstallTavling — dagens tävling finns efteråt, vad som än hände på vägen', () => {
  test('1. en 503 på set-upserten → omförsök, setet och alla tolv givar skapas', async () => {
    const { anrop } = attrapp({ setPost: [503, 201] })
    const set = await sakerstallTavling(BAS, NYCKEL, HEMLIS, DAG, 73, 'mp', { forsok: 4, pausMs: 0 })
    expect(set).toMatchObject({ id: 'set-1', size: 12, skapad: true })
    expect(set.brickor).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

    const setPosts = anrop.filter((a) => a.method === 'POST' && a.url.includes('/daily_sets'))
    expect(setPosts).toHaveLength(2) // 503 + lyckat
    // Idempotent upsert på tävlingsdagen: (comp_date, form) och merge-duplicates.
    expect(decodeURIComponent(setPosts[1].url)).toContain('on_conflict=comp_date,form')
    expect(setPosts[1].prefer).toBe('resolution=merge-duplicates,return=representation')
    expect(setPosts[1].body).toEqual([{ comp_date: DAG, form: 'mp', size: 12, daily_number: 73 }])

    const dealsPosts = anrop.filter((a) => a.method === 'POST' && a.url.includes('/daily_deals'))
    expect(dealsPosts).toHaveLength(1)
    expect(decodeURIComponent(dealsPosts[0].url)).toContain('on_conflict=set_id,board')
    expect(dealsPosts[0].prefer).toBe('resolution=ignore-duplicates,return=minimal')
    const rader = dealsPosts[0].body as Array<{ set_id: string; board: number; hands: unknown }>
    expect(rader).toHaveLength(12)
    expect(rader.every((r) => r.set_id === 'set-1')).toBe(true)
    expect(rader.map((r) => r.board)).toEqual(set.brickor)
  })

  test('3. givarna är exakt genereraGivar ur hemligheten och formens frönyckel', async () => {
    const { anrop } = attrapp({})
    await sakerstallTavling(BAS, NYCKEL, HEMLIS, DAG, 73, 'imp', { forsok: 2, pausMs: 0 })
    const rader = anrop.find((a) => a.method === 'POST' && a.url.includes('/daily_deals'))!.body as Array<{
      board: number
      dealer: string
      vulnerability: string
      hands: unknown
    }>
    const facit = genereraGivar(HEMLIS, fronyckel(DAG, 'imp'), 12)
    expect(rader.map((r) => ({ board: r.board, dealer: r.dealer, vulnerability: r.vulnerability, hands: r.hands }))).toEqual(
      facit.map((d) => ({ board: d.board, dealer: d.dealer, vulnerability: d.vulnerability, hands: d.hands })),
    )
    // IMP-setet har sin egen rad: form 'imp', aldrig MP:s.
    const setPost = anrop.find((a) => a.method === 'POST' && a.url.includes('/daily_sets'))!
    expect(setPost.body).toEqual([{ comp_date: DAG, form: 'imp', size: 12, daily_number: 73 }])
  })

  test('2. finns setet redan → skapad: false, men set + givar skrivs ändå (läker ett set utan givar)', async () => {
    const { anrop } = attrapp({ setGet: [{ id: 'set-1', size: 12 }] })
    const set = await sakerstallTavling(BAS, NYCKEL, HEMLIS, DAG, 73, 'mp', { forsok: 2, pausMs: 0 })
    expect(set).toMatchObject({ id: 'set-1', size: 12, skapad: false })
    expect(anrop.filter((a) => a.method === 'POST' && a.url.includes('/daily_sets'))).toHaveLength(1)
    expect(anrop.filter((a) => a.method === 'POST' && a.url.includes('/daily_deals'))).toHaveLength(1)
  })

  test('4a. ihållande 5xx → kastar efter sista försöket, med tabell + status', async () => {
    const { anrop } = attrapp({ setPost: [503, 503, 503] })
    await expect(sakerstallTavling(BAS, NYCKEL, HEMLIS, DAG, 73, 'mp', { forsok: 3, pausMs: 0 })).rejects.toThrow(/daily_sets: 503/)
    expect(anrop.filter((a) => a.method === 'POST' && a.url.includes('/daily_sets'))).toHaveLength(3)
    expect(anrop.some((a) => a.url.includes('/daily_deals'))).toBe(false)
  })

  test('4b. 4xx är ett äkta fel → kastar direkt, inget omförsök', async () => {
    const { anrop } = attrapp({ setPost: [401] })
    await expect(sakerstallTavling(BAS, NYCKEL, HEMLIS, DAG, 73, 'mp', { forsok: 4, pausMs: 0 })).rejects.toThrow(/daily_sets: 401/)
    expect(anrop.filter((a) => a.method === 'POST' && a.url.includes('/daily_sets'))).toHaveLength(1)
  })

  test('4c. 5xx på givarna → omförsök där också; setet skrivs inte om i onödan', async () => {
    const { anrop } = attrapp({ dealsPost: [502, 201] })
    const set = await sakerstallTavling(BAS, NYCKEL, HEMLIS, DAG, 73, 'mp', { forsok: 3, pausMs: 0 })
    expect(set.skapad).toBe(true)
    expect(anrop.filter((a) => a.method === 'POST' && a.url.includes('/daily_sets'))).toHaveLength(1)
    expect(anrop.filter((a) => a.method === 'POST' && a.url.includes('/daily_deals'))).toHaveLength(2)
  })
})
