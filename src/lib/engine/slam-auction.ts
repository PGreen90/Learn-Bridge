// Kopplar in slamverktygen (slam.ts) i en VÄXANDE auktion. Slamverktygen är
// ask/svar-funktioner som lever djupt i budgivningen (efter att trumf är
// överenskommen). Här tas det första, entydiga fallet: en högfärgsfit via
// Jacoby 2NT (utgångskrav) där parets samlade poäng når slamzon → kaptenen
// (svararen) frågar 1430 RKC och placerar sedan kontraktet.
//
// Slamzon enligt Bergen: Bergenpoäng (öppnaren, omvärderad vid fit) +
// stödpoäng (svararen som blir träkarl) ≥ 33. Storslam ≥ 37.

import type { Hand, Suit } from '../../types/bridge'
import { bergenPoints, dummyPoints } from './evaluation'
import { cheapestCueBid, hasTrumpQueen, keycards, respondToKingAsk, respondToRKC } from './slam'

const LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const SUIT_OF_LETTER: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }

/** Ett extra steg i slamutredningen, med roll i stället för plats (sätts i buildAuction). */
export interface SlamTurn {
  role: 'öppnare' | 'svarare'
  call: string
  rule: string
  explanation: string
}

/**
 * Slamutredning efter en högfärgsfit (kaptenen = svararen frågar). Returnerar
 * de extra buden (4NT → RKC-svar → slamavslut), eller null om paret inte når
 * slamzon (då fortsätter den vanliga auktionen).
 */
export function slamInvestigation(openerHand: Hand, responderHand: Hand, trump: Suit): SlamTurn[] | null {
  const combined = bergenPoints(openerHand, trump).bergenPoints + dummyPoints(responderHand, trump).dummyPoints
  if (combined < 33) return null

  const turns: SlamTurn[] = []

  // Cue-bid-rond före RKC (§6.2): med trumf överenskommen visar man kontroller
  // (ess/renons) billigast uppåt INNAN 4NT, så ett läckande hål syns. Kaptenen
  // (svararen) cue-buddar billigaste första-rondskontroll; öppnaren cue-buddar
  // billigaste kontroll ovanför. Saknas kontroll hoppas ronden över.
  const respCue = cheapestCueBid(responderHand, trump)
  if (respCue) {
    turns.push({ role: 'svarare', call: respCue.call, rule: respCue.rule, explanation: respCue.explanation })
    const openCue = cheapestCueBid(openerHand, trump, SUIT_OF_LETTER[respCue.call[1]])
    if (openCue) {
      turns.push({ role: 'öppnare', call: openCue.call, rule: openCue.rule, explanation: openCue.explanation })
    }
  }

  // Kaptenen (svararen) frågar nyckelkort med 1430 RKC.
  turns.push({
    role: 'svarare',
    call: '4NT',
    rule: '1430 RKC',
    explanation: `slamzon (~${combined} poäng ihop) → 4NT (frågar nyckelkort).`,
  })

  // Öppnaren svarar på frågan.
  const answer = respondToRKC(openerHand, trump)
  turns.push({ role: 'öppnare', call: answer.call, rule: answer.rule, explanation: answer.explanation })

  // Kaptenen räknar parets nyckelkort (4 ess + trumfkung) och placerar kontraktet.
  const total = keycards(openerHand, trump) + keycards(responderHand, trump)
  const queen = hasTrumpQueen(openerHand, trump) || hasTrumpQueen(responderHand, trump)

  // Storslamszon med alla fem nyckelkort + trumfdam → fråga kungar (Sjöbergs 5NT)
  // innan vi tar ställning till storslam. En visad sidokung (6 i sidofärg) ger det
  // 13:e sticket → kaptenen lyfter till 7; ingen kung (öppnaren bjuder 6 i trumf)
  // → stanna i 6; två+ kungar (öppnaren bjuder 7 i trumf) → storslam är redan satt.
  if (total === 5 && queen && combined >= 37) {
    turns.push({
      role: 'svarare',
      call: '5NT',
      rule: 'Sjöberg 5NT',
      explanation: `alla fem nyckelkort + trumfdam, storslamszon (~${combined} poäng) → 5NT (frågar kungar).`,
    })
    const kingAnswer = respondToKingAsk(openerHand, trump)
    turns.push({ role: 'öppnare', call: kingAnswer.call, rule: kingAnswer.rule, explanation: kingAnswer.explanation })

    if (kingAnswer.call !== `6${LETTER[trump]}` && kingAnswer.call !== `7${LETTER[trump]}`) {
      turns.push({
        role: 'svarare',
        call: `7${LETTER[trump]}`,
        rule: 'slamavslut',
        explanation: `kung visad → storslam (7${SYM[trump]}).`,
      })
    }
    return turns
  }

  let call: string
  let why: string
  if (total <= 3) {
    call = `5${LETTER[trump]}`
    why = `två nyckelkort saknas → stanna i 5${SYM[trump]}.`
  } else if (total === 4) {
    call = `6${LETTER[trump]}`
    why = `ett nyckelkort saknas → 6${SYM[trump]} (lillslam).`
  } else {
    call = `6${LETTER[trump]}`
    why = `alla fem nyckelkort men ingen storslamszon → 6${SYM[trump]} (lillslam).`
  }
  turns.push({ role: 'svarare', call, rule: 'slamavslut', explanation: why })

  return turns
}
