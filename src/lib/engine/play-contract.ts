// Steg C: välj ett rimligt kontrakt att spela ut (punkt 29). Enkel heuristik –
// inte budgivning. Riktig auktion + DDS-poängsättning (punkt 28) kommer senare.
//
//   • Spelförarsida = den med flest hp tillsammans.
//   • Färg = bästa 8+ högfärgsfit, annars sang. (Minorkontrakt hoppas över –
//     en förenkling; sang är oftast rätt utan högfärgsfit.)
//   • Spelförare = i färg den med flest trumf (lika → mest hp); i sang mest hp.
//   • Nivå = grovt efter samlad styrka: 33+ slam, 25+ utgång, annars delkontrakt.

import type { Deal, Seat, Suit } from '../../types/bridge'
import { hcp, lengths } from './hand'
import type { Contract, Strain } from './play'

export function pickContract(deal: Deal): Contract {
  const nsHcp = hcp(deal.hands.N) + hcp(deal.hands.S)
  const ewHcp = hcp(deal.hands.E) + hcp(deal.hands.W)
  const [p1, p2]: [Seat, Seat] = nsHcp >= ewHcp ? ['N', 'S'] : ['E', 'W']
  const combined = Math.max(nsHcp, ewHcp)
  const len1 = lengths(deal.hands[p1])
  const len2 = lengths(deal.hands[p2])

  // Strain: bästa 8+ högfärgsfit (spader före hjärter), annars sang.
  let strain: Strain = 'NT'
  for (const m of ['spades', 'hearts'] as Suit[]) {
    if (len1[m] + len2[m] >= 8) {
      strain = m
      break
    }
  }

  // Spelförare.
  let declarer: Seat
  if (strain !== 'NT') {
    const t = strain
    declarer =
      len1[t] !== len2[t]
        ? len1[t] > len2[t]
          ? p1
          : p2
        : hcp(deal.hands[p1]) >= hcp(deal.hands[p2])
          ? p1
          : p2
  } else {
    declarer = hcp(deal.hands[p1]) >= hcp(deal.hands[p2]) ? p1 : p2
  }

  // Nivå efter samlad styrka.
  let level: number
  if (combined >= 33) level = 6
  else if (combined >= 25) level = strain === 'NT' ? 3 : 4
  else level = strain === 'NT' ? 1 : 2

  return { declarer, strain, level }
}
