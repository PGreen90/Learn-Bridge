// Integritetspolicy (Beslut B etapp 1, steg 6). Enkel svenska. Speglar de beslut
// som tagits i docs/beslut-b-plan.md — ändra INTE här utan att uppdatera planen.

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

export function Integritet() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Integritetspolicy">
        Så här hanterar rebidz dina personuppgifter. Vi samlar in så lite som möjligt
        och säljer aldrig dina uppgifter.
      </PageHeader>
      <Panel>
        <div className="space-y-6 text-ink-soft">
          <p className="text-sm text-ink-muted">Senast uppdaterad: 2026-08-10</p>

          <Section title="Vem ansvarar">
            <p>
              rebidz är ett litet, ideellt bridgeprojekt. Den som ansvarar för dina
              uppgifter (personuppgiftsansvarig) nås på{' '}
              <a href={`mailto:${KONTAKT}`} className="text-emerald-700 underline underline-offset-2 dark:text-emerald-300">
                {KONTAKT}
              </a>
              .
            </p>
          </Section>

          <Section title="Vilka uppgifter vi samlar in">
            <p>Bara det som behövs för att du ska kunna ha ett konto och tävla:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>din e-postadress (för inloggning och viktiga meddelanden),</li>
              <li>ditt visningsnamn (syns för andra spelare — din e-post gör det aldrig),</li>
              <li>att du bekräftat att du är minst 13 år,</li>
              <li>dina spelresultat (givar du spelat, poäng, tävlingsresultat).</li>
            </ul>
            <p>
              Inget annat. Vi frågar aldrig efter födelsedatum, adress eller liknande. Ditt
              lösenord ser vi aldrig i klartext — det sköts krypterat av vår leverantör.
            </p>
          </Section>

          <Section title="Varför vi behandlar uppgifterna">
            <p>
              För att du ska kunna skapa ett konto, logga in, spela de dagliga tävlingarna och
              synas på topplistor. Den lagliga grunden är att uppfylla vårt avtal med dig (att
              tillhandahålla tjänsten) samt ditt samtycke som du ger vid registreringen.
            </p>
          </Section>

          <Section title="Var uppgifterna lagras">
            <p>
              Hos vår databasleverantör Supabase, i EU (region Stockholm). Vi har ett
              personuppgiftsbiträdesavtal (DPA) med dem. Viss teknisk behandling (t.ex. support
              och loggar) kan ske hos underleverantörer utanför EU — då skyddad av EU:s
              standardavtalsklausuler (SCC). Uppgifterna lämnar aldrig den skyddsnivån.
            </p>
          </Section>

          <Section title="Hur länge vi sparar">
            <p>
              Så länge du har ett konto. Raderar du kontot raderas <strong>allt</strong> — dina
              uppgifter och dina resultat tas bort. (Se dina rättigheter nedan.)
            </p>
          </Section>

          <Section title="Dina rättigheter">
            <p>Du har rätt att:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>få veta vilka uppgifter vi har om dig,</li>
              <li>rätta felaktiga uppgifter,</li>
              <li>radera ditt konto och all din data (”rätten att bli glömd”),</li>
              <li>få ut din data i ett vanligt filformat (dataportabilitet).</li>
            </ul>
            <p>
              Du kan själv <strong>radera ditt konto</strong> och <strong>exportera din data</strong>{' '}
              direkt inne i appen, under Mitt konto. Har du andra frågor, hör av dig till{' '}
              <a href={`mailto:${KONTAKT}`} className="text-emerald-700 underline underline-offset-2 dark:text-emerald-300">
                {KONTAKT}
              </a>
              . Du har också rätt att klaga hos Integritetsskyddsmyndigheten (IMY).
            </p>
          </Section>

          <Section title="Cookies och spårning">
            <p>
              Vi använder bara nödvändig lagring i din webbläsare för att hålla dig inloggad.
              Ingen tredjepartsanalys, ingen spårning och inga annonser — därför behöver vi
              heller ingen cookiebanner.
            </p>
          </Section>

          <Section title="Åldersgräns">
            <p>Tjänsten kräver att du är minst 13 år. Vi samlar inte in något födelsedatum.</p>
          </Section>

          <Section title="Om något går fel">
            <p>
              Skulle en säkerhetsincident inträffa som rör dina uppgifter anmäler vi allvarliga
              intrång till Integritetsskyddsmyndigheten (IMY) inom 72 timmar och informerar dig
              när lagen kräver det.
            </p>
          </Section>

          <Section title="Ändringar">
            <p>
              Policyn kan behöva uppdateras. Väsentliga ändringar meddelar vi, och datumet högst
              upp visar när den senast ändrades.
            </p>
          </Section>
        </div>
      </Panel>
    </div>
  )
}
