// NYHETERNA — "Uppdatering vX.Y.Z" (ägarbeslut 2026-11-12).
//
// Rutinen (docs/arbetsrutiner.md "Kommunicera uppdateringen"): före varje
// publicering av något användaren märker FRÅGAR Claude ägaren om det ska
// kommuniceras. Om ja: höj versionen i package.json (sista siffran) och lägg en
// post ÖVERST här. Testet nyheter.test.ts kräver att de två följs åt och att
// texterna är korta — annars hoppar användaren över allt.
//
// Rutan visas en gång per användare och version, bara på lugna sidor (aldrig
// över en pågående giv). Alla poster går att läsa igen via versionsnumret i
// sidfoten.

export interface Nyhetspunkt {
  /** Vad det är — två-tre ord. */
  rubrik: string
  /** Vad det ger användaren — en rad. */
  text: string
}

export interface Nyhet {
  version: string
  /** ISO-datum då versionen släpptes. */
  datum: string
  punkter: Nyhetspunkt[]
}

/** Nyast först. */
export const NYHETER: Nyhet[] = [
  {
    version: '1.0.1',
    datum: '2026-11-12',
    punkter: [
      {
        rubrik: 'Veckans stjärntävling',
        text: 'Tolv utvalda, svåra givar. Öppen hela veckan — och utan budhjälp.',
      },
      {
        rubrik: 'Ny budträning',
        text: 'Välj ett tema, så delar datorn givarna. Du bjuder i den riktiga budlådan.',
      },
      {
        rubrik: 'Tyck till',
        text: 'Säg vad du saknar eller rapportera ett fel med två tryck. Inget konto behövs.',
      },
      {
        rubrik: 'Uppdateras av sig själv',
        text: 'Appen hämtar nya versioner själv när du är på startsidan.',
      },
    ],
  },
]

function delar(version: string): number[] | null {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null
  return version.split('.').map(Number)
}

/** Är version `a` nyare än `b`? Siffra för siffra (1.0.10 > 1.0.9). */
export function nyareAn(a: string, b: string): boolean {
  const x = delar(a)
  const y = delar(b)
  if (!x || !y) return false
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i]
  }
  return false
}

/** Nyheten användaren inte sett än, eller null.
 *  `seddVersion` = senaste version vars nyhet användaren stängt (råvärde ur
 *  lagringen). `befintligAnvandare` = har använt appen förut: en helt ny
 *  besökare får ingen "nyhets"-ruta, för dem är allt nytt. */
export function olastNyhet(seddVersion: unknown, befintligAnvandare: boolean): Nyhet | null {
  const senaste = NYHETER[0]
  if (!senaste) return null
  if (typeof seddVersion === 'string' && delar(seddVersion)) {
    return nyareAn(senaste.version, seddVersion) ? senaste : null
  }
  return befintligAnvandare ? senaste : null
}
