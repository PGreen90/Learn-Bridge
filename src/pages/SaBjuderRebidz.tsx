// "Så bjuder rebidz" — systemet på EN sida (nästa nivå etapp 2, 2026-11-11).
//
// Varför sidan finns: de flesta klubbspelare som provar rebidz spelar inte 2/1
// till vardags. Utan en kort förklaring upplever de korrekta bud som fel — och
// hela systemboken (Budsystem-sidan) är för lång som första möte. Den här sidan
// är deklarationen: skillnaderna mot ett vanligt naturligt system först, sedan
// öppningarna och det viktigaste i svaren.
//
// KÄLLAN är docs/budsystem.md (+ snabbreferensen docs/oversikt.md). Ändras en
// regel där som nämns här ska den här sidan ändras i samma veva.

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'

/** De fem sakerna en van klubbspelare behöver veta FÖRST. */
const SKILLNADER: { rubrik: string; text: string }[] = [
  {
    rubrik: 'Ny färg på tvåläget är utgångskrav',
    text: 'Efter partnerns öppning 1♥ eller 1♠ lovar ett svar som 2♣ eller 2♦ öppningsstyrka, och budgivningen får inte stanna under utgång. Därför kan båda bjuda lugnt efteråt — ingen behöver hoppa för att visa styrka.',
  },
  {
    rubrik: '1NT på en högfärgsöppning är brett: 6–11',
    text: 'Eftersom tvåläget kräver utgångsstyrka går alla svagare händer via 1NT — även inviter med tre trumf. Öppnaren passar bara med en jämn minimihand och bjuder annars vidare.',
  },
  {
    rubrik: 'Höjningarna i högfärg är konventionella',
    text: 'Med fyra trumf: 3♣ = 7–9, 3♦ = 10–12, hopp till 3 i färgen = spärr (Bergen). 2NT = utgångskrav med fyra trumf (Jacoby). Ett dubbelhopp i ny färg visar kortfärg och stöd (splinter).',
  },
  {
    rubrik: 'Lågfärgshöjningarna är omvända',
    text: '1♣–2♣ och 1♦–2♦ är starka (10+, krav) medan hoppet till tre är svagt och spärrande. Tvärtom mot vad många är vana vid.',
  },
  {
    rubrik: 'Markeringarna är omvända',
    text: 'I motspel betyder ett lågt kort "jag gillar färgen" och låg–hög visar jämnt antal (UDCA). Utspelen är tredje/femte högsta från längd.',
  },
]

const OPPNINGAR: [string, string][] = [
  ['1♣ / 1♦', 'minst tre kort, 12+'],
  ['1♥ / 1♠', 'minst fem kort, 12+'],
  ['1NT', '15–17, balanserad'],
  ['2♣', 'stark och konstgjord (krav)'],
  ['2♦ / 2♥ / 2♠', 'svag tvåa: sex kort, 6–11'],
  ['2NT', '20–21, balanserad'],
  ['3NT', 'Gambling: en gående sjukorts lågfärg'],
  ['Tre- och fyraläget', 'spärr'],
]

const OVRIGT: { rubrik: string; rader: string[] }[] = [
  {
    rubrik: 'Efter 1NT',
    rader: [
      '2♣ Stayman · 2♦ och 2♥ överföring till hjärter respektive spader',
      '2♠ frågar efter lågfärgerna · 4♦ och 4♥ är överföring på fyraläget (Texas)',
      '2NT inbjuder (8–9) · 3NT är slutbud',
    ],
  },
  {
    rubrik: 'Efter 2NT och stark 2♣',
    rader: [
      '3♣ över 2NT frågar efter både fyr- och femkorts högfärg (Puppet Stayman)',
      '2♣–2♦ är ett väntebud; ett annat svar lovar 8+ och en egen femkortsfärg',
    ],
  },
  {
    rubrik: 'Slam',
    rader: [
      '4NT frågar efter fem nyckelkort — de fyra essen och trumfkungen (svaren i ordningen 1430)',
      'Kontrollbud (cue-bid) före essfrågan · 4♣ över sang är essfråga (Gerber)',
    ],
  },
  {
    rubrik: 'När motståndarna bjuder',
    rader: [
      'Dubbling av en färgöppning är upplysande · negativa dubblingar efter inkliv',
      'Bud i motståndarnas färg och hopp till 2NT visar tvåfärgshänder (Michaels och ovanlig 2NT)',
      'Mot deras 1NT: DONT — dubbelt visar en enfärgshand, ett färgbud visar den färgen och en högre',
    ],
  },
]

function Rubrik({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-lg font-semibold text-ink">{children}</h2>
}

export function SaBjuderRebidz() {
  return (
    <div className="space-y-6">
      <PageHeader title="Så bjuder rebidz">
        Datorn bjuder 2 över 1 (2/1) — ett naturligt system med femkorts högfärg. Här är det du
        behöver veta för att förstå din partner från första given.
      </PageHeader>

      <Panel>
        <Rubrik>Fem saker som skiljer mot vanlig klubbstandard</Rubrik>
        <ol className="space-y-3">
          {SKILLNADER.map((s, i) => (
            <li key={s.rubrik} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-400/20 text-sm font-semibold text-gold-700 dark:text-gold-200"
              >
                {i + 1}
              </span>
              <div>
                <div className="font-semibold text-ink">{s.rubrik}</div>
                <p className="text-sm leading-relaxed text-ink-soft">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel>
        <Rubrik>Öppningsbuden</Rubrik>
        <dl className="divide-y divide-line text-sm">
          {OPPNINGAR.map(([bud, betyder]) => (
            <div key={bud} className="flex gap-3 py-1.5">
              <dt className="w-32 shrink-0 font-semibold text-ink">{bud}</dt>
              <dd className="text-ink-soft">{betyder}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-ink-muted">
          Talen är honnörspoäng. En bra hand med lång färg kan öppna något lättare.
        </p>
      </Panel>

      <Panel>
        <Rubrik>Det viktigaste i fortsättningen</Rubrik>
        <div className="space-y-4">
          {OVRIGT.map((del) => (
            <section key={del.rubrik}>
              <h3 className="text-sm font-semibold text-ink">{del.rubrik}</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                {del.rader.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Panel>

      <Panel>
        <Rubrik>Du behöver inte kunna allt utantill</Rubrik>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>
            <strong>Tryck på ett bud</strong> vid bordet så förklaras vad det lovar — det gäller
            både partnerns och motståndarnas bud.
          </li>
          <li>
            <strong>Budstödet</strong> (⋮-menyn vid bordet) visar vad datorn själv hade bjudit med
            din hand.
          </li>
          <li>
            Hela systemet, paragraf för paragraf och med sökruta, finns under{' '}
            <Link to="/budsystem" className="text-accent underline">
              Budsystem
            </Link>
            .
          </li>
          <li>
            Tycker du att datorn bjöd fel? Rapportera given direkt från bordet — det tar tio
            sekunder och kräver inget konto.
          </li>
        </ul>
      </Panel>
    </div>
  )
}
