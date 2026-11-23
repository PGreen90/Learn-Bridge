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
    version: '1.0.13',
    datum: '2026-11-23',
    punkter: [
      {
        rubrik: 'Markeringarna vidareutvecklade',
        text: 'Högt kort uppmuntrar, lågt avskräcker. Högt-lågt visar jämnt antal.',
      },
      {
        rubrik: 'Uppmuntran i sang',
        text: 'Mot partnerns honnörsutspel uppmuntrar även längd: fyra kort eller fler.',
      },
      {
        rubrik: 'Utspel från 10-9',
        text: 'Tian spelas ut från 10-9-8 och 10-9-x.',
      },
    ],
  },
  {
    version: '1.0.12',
    datum: '2026-11-23',
    punkter: [
      {
        rubrik: 'Bottarnas markeringar',
        text: 'Genomgångna och rättade: det bottarna lägger och det de läser betyder nu samma sak.',
      },
      {
        rubrik: 'Lavinthal-saken',
        text: 'Högt kort (sjua eller högre) ber om den högre av de två andra färgerna, lågt om den lägre.',
      },
    ],
  },
  {
    version: '1.0.11',
    datum: '2026-11-22',
    punkter: [
      {
        rubrik: 'Ny startsida',
        text: 'Tävlingarna, träningen och veckans stjärna samlade på en skärm. Du ser direkt var du står.',
      },
    ],
  },
  {
    version: '1.0.10',
    datum: '2026-11-21',
    punkter: [
      {
        rubrik: 'Övning mot fältet',
        text: 'Spela om en tävlingsgiv och se vad resultatet hade gett mot de andra, och mot ditt eget.',
      },
    ],
  },
  {
    version: '1.0.9',
    datum: '2026-11-17',
    punkter: [
      {
        rubrik: 'Givens historia',
        text: 'Stjärngivens historia visas nu direkt efter given, i en bubbla du kan kryssa bort.',
      },
    ],
  },
  {
    version: '1.0.8',
    datum: '2026-11-16',
    punkter: [
      {
        rubrik: 'Kortare stickväntan',
        text: 'Sticket ligger kvar kortare tid innan nästa spelas ut.',
      },
    ],
  },
  {
    version: '1.0.7',
    datum: '2026-11-16',
    punkter: [
      {
        rubrik: 'Jämnare tempo',
        text: 'Bottarna spelar ut direkt efter stickväntan och lägger tvingade kort snabbare.',
      },
    ],
  },
  {
    version: '1.0.6',
    datum: '2026-11-16',
    punkter: [
      {
        rubrik: 'Snabbare bottar',
        text: 'Bottarna lägger sina kort direkt – ingen lång betänketid mitt i given.',
      },
    ],
  },
  {
    version: '1.0.5',
    datum: '2026-11-15',
    punkter: [
      {
        rubrik: 'Mer känsla vid bordet',
        text: 'Korten landar mjukt och sticket dras hem till vinnaren.',
      },
      {
        rubrik: 'Nya ljud',
        text: 'Diskreta toner för din tur, sticket och resultatet.',
      },
      {
        rubrik: 'Tydligt avslut',
        text: 'Hemgång eller bet visas på bordet innan resultatet.',
      },
    ],
  },
  {
    version: '1.0.4',
    datum: '2026-11-15',
    punkter: [
      {
        rubrik: 'Stadigare bord',
        text: 'Bordet står still när du väljer färg. Tryck på duken för att ångra.',
      },
      {
        rubrik: 'Tydligare val',
        text: 'Kortet du tryckt på får guldkant. Nästa tryck spelar det.',
      },
    ],
  },
  {
    version: '1.0.3',
    datum: '2026-11-15',
    punkter: [
      {
        rubrik: 'Kortet stannar kvar',
        text: 'Vald färg fälls ut runt kortet du trycker på.',
      },
    ],
  },
  {
    version: '1.0.2',
    datum: '2026-11-13',
    punkter: [
      {
        rubrik: 'Lättare öppningar',
        text: 'Elva poäng med femkorts högfärg öppnar nu alltid.',
      },
      {
        rubrik: 'Vassare motspel',
        text: 'Bottarna ger inte längre stöld och sak i samma stick.',
      },
      {
        rubrik: 'Dina felrapporter',
        text: 'Sju rapporterade bud- och spelfel är lagade. Tack!',
      },
    ],
  },
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
