// Om rebidz: appens förklarande sida för nya ögon. Nås från startsidans
// "Ny här?"-länk och sidfoten.
//
// Omskriven 2026-11-11 (nästa nivå etapp 2, inför klubbjakten): den förra
// versionen sa "ingen inloggning och inget konto" och nämnde varken
// tävlingarna, MP/IMP eller Spela med vänner — det nya användare faktiskt möter.

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { TyckTillKnapp } from '../components/TyckTill'
import { useInstallera } from '../lib/installera'

/** Ett läge i listan: rubrik som länk + en rad om vad det är. */
function Mode({ to, title, children }: { to: string; title: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="font-semibold text-accent underline-offset-2 hover:underline">
        {title}
      </Link>{' '}
      <span className="text-ink-soft">— {children}</span>
    </li>
  )
}

const LANK = 'text-accent underline'

export function Om() {
  // Installera-knappen visas bara där webbläsaren erbjuder installation.
  const { kan, installera } = useInstallera()
  return (
    <div className="space-y-6">
      <PageHeader title="Om rebidz">
        Träna, spela och tävla i bridge — direkt i webbläsaren, gratis.
      </PageHeader>

      <Panel>
        <h2 className="mb-2 text-lg font-semibold">Det viktigaste först</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>
            <strong>Du sitter alltid Syd.</strong> Datorn spelar Väst, Nord och Öst —
            Nord är din partner.
          </li>
          <li>
            Datorn bjuder <strong>2 över 1</strong> (2/1). Är du van vid ett annat system? Läs{' '}
            <Link to="/sa-bjuder-rebidz" className={LANK}>Så bjuder rebidz</Link> — hela
            systemet på en sida, med skillnaderna först.
          </li>
          <li>
            <strong>Tryck på ett bud</strong> i budgivningen så förklaras vad det lovar.
            Tryck på ett spelat kort så berättar datorn varför den valde det.
          </li>
          <li>
            Det mesta fungerar <strong>utan konto</strong>. Ett konto (gratis) behövs för de
            dagliga tävlingarna och för att spela med vänner.
          </li>
        </ul>
      </Panel>

      <Panel>
        <h2 className="mb-2 text-lg font-semibold">Dagens tävlingar</h2>
        <p className="text-sm text-ink-soft">
          Varje dag finns två tävlingar med tolv givar var. Alla spelar samma givar mot datorn,
          och ditt resultat jämförs med alla andras — även några datorspelare deltar, så det
          finns alltid någon att mäta sig mot. Du kan pausa och fortsätta senare under dagen.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <Mode to="/spela-kort/tavling" title="Dagens MP%">
            matchpoäng. På varje giv får du procent efter hur många du slog: bäst av alla ger
            100 %, mitt i fältet 50 %. Här kan ett enda övertrick avgöra.
          </Mode>
          <Mode to="/spela-kort/tavling?form=imp" title="Dagens IMP">
            skillnaden mot de andra räknas om till IMP. Utgångar och slammar väger tungt,
            övertrick nästan ingenting — spela säkert hem kontraktet.
          </Mode>
        </ul>
        <h3 className="mt-4 text-sm font-semibold text-ink">Veckans guld-tävling</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Varje måndag kommer{' '}
          <Link to="/spela-kort/tavling?form=guld" className={LANK}>
            tolv utvalda, svåra givar
          </Link>{' '}
          som är öppna hela veckan. De är valda för att innehålla riktiga beslut: utgångar och
          slammar som går precis hem, och givar där rätt benämning avgör. Här spelar du som vid
          ett riktigt bord — utan budhjälp. Du kan fortfarande trycka på ett bud
          för att se vad det betyder. Räknas i matchpoäng.
        </p>
        <p className="mt-3 text-sm text-ink-soft">
          När du spelat en giv ser du hur alla andra bjöd och spelade den. Dagen efter är
          resultatet slutligt, och de bästa får medalj i historiken.
        </p>
      </Panel>

      <Panel>
        <h2 className="mb-2 text-lg font-semibold">Mer att göra</h2>
        <ul className="space-y-2 text-sm">
          <Mode to="/spela-kort" title="Spela kort">
            en hel giv mot datorn, när du vill och hur många du vill. Efteråt får du
            omspelning och en genomgång som förklarar varje stick.
          </Mode>
          <Mode to="/spela-med-vanner" title="Spela med vänner">
            öppna ett eget bord, bjud in med en länk och fyll tomma stolar med datorspelare.
          </Mode>
          <Mode to="/budtraning" title="Budträning">
            öva på att hitta rätt bud, tema för tema, med förklaringar.
          </Mode>
          <Mode to="/budvisning" title="Budvisning">
            luta dig tillbaka och titta när datorn bjuder alla fyra händerna öppet.
          </Mode>
          <Mode to="/budsystem" title="Budsystem">
            hela systemet som uppslagsbok, med sökruta.
          </Mode>
        </ul>
      </Panel>

      <Panel>
        <h2 className="mb-2 text-lg font-semibold">Bra att veta i spelet</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>
            <strong>⋮-menyn</strong> vid bordet har tempo, ljud, budstöd, Auto
            Claim, ångra och hjälptexter. Samma inställningar finns under{' '}
            <Link to="/installningar" className={LANK}>Inställningar</Link>.
          </li>
          <li>
            <strong>Genomgången efter given</strong> visar hur många stick som gick att ta
            med perfekt spel och pekar ut var sticken tappades.
          </li>
          <li>
            En pågående giv sparas automatiskt — även i tävlingarna — så
            stängs fliken fortsätter du exakt där du var nästa gång. Ångra tar
            bara tillbaka ditt senaste kort (ett feltryck), aldrig flera steg.
          </li>
          <li>
            Appen går att lägga på hemskärmen (”Lägg till på hemskärmen” i
            webbläsarens meny) och fungerar även utan nät.
            {kan && (
              <>
                {' '}
                <button type="button" onClick={() => void installera()} className={`${LANK} font-semibold`}>
                  Installera rebidz nu →
                </button>
              </>
            )}
          </li>
        </ul>
      </Panel>

      <Panel>
        <h2 className="mb-2 text-lg font-semibold">Hjälp oss göra rebidz bättre</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>
            <strong>Bjöd eller spelade datorn fel?</strong> Välj ”Rapportera fel” i ⋮-menyn
            vid bordet. Hela given följer med automatiskt, och inget konto behövs.
          </li>
          <li>
            <strong>Saknar du något?</strong>{' '}
            <TyckTillKnapp className={LANK}>Tyck till om rebidz</TyckTillKnapp> — två korta
            frågor, och allt som skickas in läses.
          </li>
        </ul>
      </Panel>
    </div>
  )
}
