// Om rebidz (Etapp D, granskningen 2026-08-02): appens första förklarande
// sida. Granskningen fann att en helt ny besökare inte fick veta någonstans
// att man alltid sitter Syd, att systemet är 2/1, eller vad de fyra lägena
// är för något — all hjälptext bodde INNE i spelet bakom ⋮. Nås från
// startsidans "Ny här?"-länk och sidfoten.

import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'

/** Ett läge i listan: rubrik som länk + en rad om vad det är. */
function Mode({ to, title, children }: { to: string; title: string; children: string }) {
  return (
    <li>
      <Link to={to} className="font-semibold text-accent underline-offset-2 hover:underline">
        {title}
      </Link>{' '}
      <span className="text-ink-soft">— {children}</span>
    </li>
  )
}

export function Om() {
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
            Budsystemet är <strong>2 över 1</strong> (2/1). Hela systemet finns att
            läsa under <Link to="/budsystem" className="text-accent underline">Budsystem</Link>,
            paragraf för paragraf.
          </li>
          <li>
            Klicka på ett lagt bud i budgivningen så förklaras vad det betyder.
            Tryck på ett spelat kort på bordet så berättar datorn varför den valde det.
          </li>
          <li>
            Ingen inloggning och inget konto — dina framsteg sparas i webbläsaren
            på den här enheten.
          </li>
        </ul>
      </Panel>

      <Panel>
        <h2 className="mb-2 text-lg font-semibold">Lägena</h2>
        <ul className="space-y-2 text-sm">
          <Mode to="/spela-kort/dagens" title="Dagens giv">
            samma giv för alla, varje dag. Spela den och dela ditt resultat —
            spoilerfritt, som i Wordle.
          </Mode>
          <Mode to="/spela-kort" title="Spela kort">
            en hel giv mot datorn, budgivning och kortspel. Efteråt får du
            omspelning och en rondgenomgång som förklarar varje stick.
          </Mode>
          <Mode to="/budtraning" title="Budträning">
            öva på att hitta rätt bud, tema för tema, med förklaringar.
          </Mode>
          <Mode to="/budvisning" title="Budvisning">
            luta dig tillbaka och titta när datorn budar alla fyra händerna öppet.
          </Mode>
          <Mode to="/budsystem" title="Budsystem">
            hela 2/1-systemet som uppslagsbok, med sökruta.
          </Mode>
        </ul>
      </Panel>

      <Panel>
        <h2 className="mb-2 text-lg font-semibold">Bra att veta i spelet</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>
            <strong>⋮-menyn</strong> vid bordet har tempo, ljud, budstöd, Auto
            Claim, ångra och hjälptexter. Samma inställningar finns under{' '}
            <Link to="/installningar" className="text-accent underline">Inställningar</Link>.
          </li>
          <li>
            <strong>Facit-knappen</strong> visar hur många stick spelföraren kan
            säkra med perfekt spel — och rondgenomgången efteråt pekar ut var
            sticken tappades.
          </li>
          <li>
            En pågående giv sparas automatiskt — stängs fliken fortsätter du där
            du var nästa gång.
          </li>
          <li>
            Appen går att lägga på hemskärmen (”Lägg till på hemskärmen” i
            webbläsarens meny) och fungerar även utan nät.
          </li>
        </ul>
      </Panel>
    </div>
  )
}
