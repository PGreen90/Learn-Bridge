// Användarvillkor (Beslut B etapp 1, steg 6). Enkel svenska. Speglar besluten i
// docs/beslut-b-plan.md — ändra INTE här utan att uppdatera planen.

import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'

const KONTAKT = 'rebidz.bridge@gmail.com'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

export function Villkor() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Användarvillkor">
        De enkla reglerna för att använda rebidz. Genom att skapa ett konto godkänner du dem.
      </PageHeader>
      <Panel>
        <div className="space-y-6 text-ink-soft">
          <p className="text-sm text-ink-muted">Senast uppdaterad: 2026-08-10</p>

          <Section title="Om tjänsten">
            <p>
              rebidz är en gratis webbapp för att spela och lära sig bridge. Det är ett litet
              hobbyprojekt som tillhandahålls i befintligt skick, efter bästa förmåga.
            </p>
          </Section>

          <Section title="Ditt konto">
            <p>
              Du ansvarar för ditt lösenord och för det som sker på ditt konto. Håll uppgifterna
              för dig själv. Du måste vara minst 13 år för att skapa ett konto.
            </p>
          </Section>

          <Section title="Visningsnamn">
            <p>
              Ditt visningsnamn ska följa reglerna (4–10 tecken, bokstäver, siffror, _ och -) och
              får inte vara stötande, vilseledande eller utge sig för att vara någon annan. Namnet
              är låst när du valt det. Vi förbehåller oss rätten att ändra eller spärra ett
              visningsnamn som bryter mot reglerna.
            </p>
          </Section>

          <Section title="Spela schysst">
            <p>
              Fuska inte, försök inte manipulera resultat eller störa tjänsten eller andra
              spelare. Dina resultat och ditt visningsnamn kan visas på topplistor.
            </p>
          </Section>

          <Section title="Ansvarsbegränsning">
            <p>
              Tjänsten kan ha avbrott, fel eller ändras över tid, och vi kan inte lova att den
              alltid är tillgänglig eller felfri. Så långt lagen tillåter ansvarar vi inte för
              förluster som följer av att du använder tjänsten.
            </p>
          </Section>

          <Section title="Avsluta">
            <p>
              Du kan när som helst radera ditt konto under Mitt konto — då tas allt bort. Vi kan
              stänga av konton som bryter mot dessa villkor.
            </p>
          </Section>

          <Section title="Personuppgifter">
            <p>
              Hur vi hanterar dina uppgifter beskrivs i{' '}
              <Link to="/integritet" className="text-emerald-700 underline underline-offset-2 dark:text-emerald-300">
                integritetspolicyn
              </Link>
              .
            </p>
          </Section>

          <Section title="Ändringar och kontakt">
            <p>
              Villkoren kan uppdateras; datumet högst upp visar när. Frågor? Hör av dig till{' '}
              <a href={`mailto:${KONTAKT}`} className="text-emerald-700 underline underline-offset-2 dark:text-emerald-300">
                {KONTAKT}
              </a>
              .
            </p>
          </Section>
        </div>
      </Panel>
    </div>
  )
}
