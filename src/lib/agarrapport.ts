// ÄGARRAPPORTEN (nästa nivå etapp 2, 2026-11-11) — hur går värvningen?
//
// rebidz har ingen spårning och ska inte ha någon (integritetspolicyn lovar
// det). Men svaren på "kommer det nya spelare?" och "kommer de tillbaka?"
// finns redan i det vi ändå sparar: när ett konto skapades och vilka dagar
// kontot spelade tävlingsgivar. Den här modulen räknar BARA antal ur de två
// tabellerna — inga namn, inga e-postadresser, ingen ny datainsamling.
//
// Ren funktion (rapporten ur rader). Hämtningen bor i proben bredvid, som
// körs för hand eller av veckojobbet i Actions.

import { stockholmDateISO } from './engine/daily'

export interface Kontorad {
  id: string
  created_at: string
  is_bot: boolean
}

export interface Resultatrad {
  user_id: string
  created_at: string
}

export interface Agarrapport {
  /** Dagen rapporten gäller (YYYY-MM-DD, Stockholm). */
  dag: string
  konton: { totalt: number; nya7: number; nya30: number }
  /** Olika människor som spelade minst en tävlingsgiv. */
  aktiva: { senaste7: number; foregaende7: number; senaste30: number }
  /** Av dem som spelade förra veckan: hur många spelade även den här veckan. */
  aterkomst: { av: number; komTillbaka: number }
  /** Av konton skapade för 8–30 dagar sedan: hur många har spelat alls efteråt
   *  under perioden (nya som faktiskt kom igång). */
  nyaSomSpelat: { av: number; spelat: number }
  /** Aktiva människor per dag, äldst först (14 dagar). */
  perDag: { dag: string; aktiva: number }[]
}

const DYGN = 24 * 60 * 60 * 1000

/** Datumet `n` dagar före `dag` (YYYY-MM-DD), räknat mitt på dagen UTC så
 *  sommartidsbyten aldrig flyttar det ett dygn fel. */
function dagarFore(dag: string, n: number): string {
  return new Date(Date.parse(dag + 'T12:00:00Z') - n * DYGN).toISOString().slice(0, 10)
}

export function byggAgarrapport(konton: Kontorad[], resultat: Resultatrad[], nu: Date = new Date()): Agarrapport {
  const dag = stockholmDateISO(nu)
  const manniskor = konton.filter((k) => !k.is_bot)
  const arManniska = new Set(manniskor.map((k) => k.id))

  // Vilka dagar har varje människa spelat?
  const speldagar = new Map<string, Set<string>>()
  for (const r of resultat) {
    if (!arManniska.has(r.user_id)) continue
    const d = stockholmDateISO(new Date(r.created_at))
    if (!speldagar.has(r.user_id)) speldagar.set(r.user_id, new Set())
    speldagar.get(r.user_id)!.add(d)
  }

  // Fönster [från, till] i hela dagar, där 0 = i dag.
  const aktivaI = (franDagarSedan: number, tillDagarSedan: number): Set<string> => {
    const fran = dagarFore(dag, franDagarSedan)
    const till = dagarFore(dag, tillDagarSedan)
    const ut = new Set<string>()
    for (const [id, dagar] of speldagar) {
      for (const d of dagar) {
        if (d >= fran && d <= till) {
          ut.add(id)
          break
        }
      }
    }
    return ut
  }

  const senaste7 = aktivaI(6, 0)
  const foregaende7 = aktivaI(13, 7)
  const skapadDag = (k: Kontorad) => stockholmDateISO(new Date(k.created_at))
  const nyaEfter = (n: number) => manniskor.filter((k) => skapadDag(k) >= dagarFore(dag, n - 1)).length

  const mogna = manniskor.filter((k) => {
    const d = skapadDag(k)
    return d >= dagarFore(dag, 30) && d <= dagarFore(dag, 8)
  })

  return {
    dag,
    konton: { totalt: manniskor.length, nya7: nyaEfter(7), nya30: nyaEfter(30) },
    aktiva: { senaste7: senaste7.size, foregaende7: foregaende7.size, senaste30: aktivaI(29, 0).size },
    aterkomst: { av: foregaende7.size, komTillbaka: [...foregaende7].filter((id) => senaste7.has(id)).length },
    nyaSomSpelat: { av: mogna.length, spelat: mogna.filter((k) => speldagar.has(k.id)).length },
    perDag: Array.from({ length: 14 }, (_, i) => {
      const d = dagarFore(dag, 13 - i)
      let aktiva = 0
      for (const dagar of speldagar.values()) if (dagar.has(d)) aktiva++
      return { dag: d, aktiva }
    }),
  }
}

const andel = (del: number, av: number) => (av === 0 ? '–' : `${Math.round((del / av) * 100)} %`)

/** Rapporten som läsbar text (Markdown — visas som sammanfattning i Actions). */
export function agarrapportText(r: Agarrapport): string {
  const max = Math.max(1, ...r.perDag.map((d) => d.aktiva))
  const rader = [
    `# rebidz – ägarrapport ${r.dag}`,
    '',
    'Bara människor räknas (datorspelarna är borttagna). "Aktiv" = spelade minst en tävlingsgiv.',
    '',
    '## Konton',
    `- Totalt: **${r.konton.totalt}**`,
    `- Nya senaste 7 dagarna: **${r.konton.nya7}** · senaste 30: **${r.konton.nya30}**`,
    '',
    '## Aktiva spelare',
    `- Senaste 7 dagarna: **${r.aktiva.senaste7}** (veckan före: ${r.aktiva.foregaende7})`,
    `- Senaste 30 dagarna: **${r.aktiva.senaste30}**`,
    '',
    '## Kommer de tillbaka?',
    `- Av ${r.aterkomst.av} som spelade förra veckan spelade **${r.aterkomst.komTillbaka}** även den här (${andel(r.aterkomst.komTillbaka, r.aterkomst.av)}).`,
    `- Av ${r.nyaSomSpelat.av} konton skapade för 8–30 dagar sedan har **${r.nyaSomSpelat.spelat}** spelat tävlingen (${andel(r.nyaSomSpelat.spelat, r.nyaSomSpelat.av)}).`,
    '',
    '## Aktiva per dag',
    '```',
    ...r.perDag.map((d) => `${d.dag}  ${String(d.aktiva).padStart(3)}  ${'█'.repeat(Math.round((d.aktiva / max) * 30))}`),
    '```',
  ]
  return rader.join('\n')
}
