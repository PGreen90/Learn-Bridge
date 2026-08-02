# Konkurrensplanen — vägen mot BBO, Funbridge och Synrey

> **Status: BESLUTAD RIKTNING (nedskriven 2026-07-29).** Ägaren vill att rebidz
> på allvar ska börja konkurrera med de stora bridgeapparna. Den här filen är
> två saker: hälsobedömningen som beslutet vilar på, och roadmapen dit.
> **Planen är skriven — men inget backend-bygge startar förrän ägaren
> uttryckligen säger "kör"** (samma regel som alltid gällt Beslut B, se
> `docs/framtid-multiplayer-plattform.md`).

## Ägarens vägval (2026-07-29)

1. **Konkurrensmodell: Funbridge-modellen först.** Alla spelar **samma givar**
   mot bottarna och jämförs på en topplista ("Dagens givar"). Ingen realtid i
   första steget — riktiga realtidsbord (BBO-modellen) är svårast av allt och
   kommer sist, som Fas 6.
2. **Faceliften är VÄCKT** ur parkeringen (parkerad 2026-07-20, väckt
   2026-07-29). Den är Fas 1 i roadmapen — utseendet är en del av
   konkurrenskraften, särskilt mot Synrey.
3. **Två språk: svenska först, engelska senare** (Fas 5). Ingen konkurrent
   finns på svenska — det är en lucka, inte en begränsning.
4. **Beslut B startas inte än.** Denna plan är planering; byggstarten är ett
   eget, senare ägarbeslut.

## Hälsobedömningen (2026-07-29)

### Det som är friskt

- **Testkulturen är i toppklass.** Hela testsviten är deploygrind — GitHub Actions
  (`ci-deploy.yml`) kör `npx tsc && npm test` före varje publicering, så rött
  test betyder att inget trasigt når rebidz.com. Koden är strikt TypeScript
  utan undantag och beroendelistan är minimal (kontrolleras med `npm test`
  respektive en titt i `package.json`).
- **Budmotorn mäts och förbättras systematiskt.** Från baslinjen till senaste
  mätningen: rätt kontrakt 15,9 % → 18,7 %, genomsnittlig par-avvikelse
  300 → 271,38 poäng per giv (mätspåret #1→#20; kommando: `$env:REVISOR='1';
  npx vitest run src/lib/engine/revisor.probe.test.ts`, frö 20260721; hela
  loggen i `docs/systemrevisorn.md`).
- **Vallgraven: pedagogiken.** Ingen av konkurrenterna förklarar spelet som
  rebidz gör — varje bud förklaras, varje stick i rondgenomgången, varje
  markering, med double-dummy-dom på köpet. Och allt på svenska. Detta är
  appens unika värde och ska synas i all marknadsföring framåt.
- **Infrastrukturen är redo för nästa steg.** Beslut A är klart sedan
  2026-07-05: Vercel, egen domän rebidz.com, PWA (installerbar + offline).

### Svagheterna relativt konkurrenterna

1. **Ingen gemenskap.** Inga konton, inget sparat mellan enheter, inget att
   jämföra sig mot. Det är precis det Beslut B löser — och utan det finns
   ingen konkurrens med någon av de tre.
2. **Bottarnas kortspel har kända hål.** Felrapport #32 (spelföraren
   etablerar inte lång färg) och #34 (slarvigt försvar, tredje-hand-högt) —
   se `docs/senare.md`. Erfarna spelare dömer bottar på fem minuter, och i
   Funbridge-modellen ÄR botspelet produkten: det man tävlar i är att spela
   samma givar mot samma bottar bättre än andra. Mätriggen finns redan:
   `play-quality.probe.test.ts` (gatad, `PLAYQ=1`).
3. **Mobilupplevelsen är tunn.** Få mobilbrytpunkter och ofullständig hantering
   av mobilens "säkra zoner" (urtag/hemindikator). Delvis åtgärdat 2026-07-30:
   handens kortrad ser nu likadan ut i alla vyer (Fas 0 b, se nedan; #36 stängd).
   Kvar: mobilsvep + säkra zoner vid bordet. Konkurrenterna är mobilappar i grunden.
4. **Designen har legat parkerad** medan Synrey konkurrerar på polish.
   (Åtgärdas: faceliften är nu väckt = Fas 1.)
5. **Tekniska småsaker** som märks först med fler besökare: ~~hela appen laddas
   som en enda stor JS-fil, ingen 404-sida~~ → **åtgärdat 2026-07-30 (Fas 0 c):**
   route-baserad kod-uppdelning (entry-JS ~889 → 247 kB) + 404-sida. Kvar i
   spåret: finare bild-/typsnittsoptimering vid behov (kommando för storleken:
   `npm run build`, läs `dist/assets/`).

## Konkurrenterna — och var rebidz slår dem

| App | Deras styrka | Deras svaghet | Vår vinkel |
|---|---|---|---|
| **BBO** | Störst gemenskap, riktiga bord i realtid, gratis | Åldrat gränssnitt, förklarar ingenting, överväldigande för många | Modernt, förklarande, på svenska |
| **Funbridge** | Solo mot bottar + jämförelse med tusentals andra på samma givar | Betalvägg per giv, begränsade förklaringar, ingen svenska | Samma modell — men gratis, med full förklaring av varje bud och stick |
| **Synrey** | Snyggast, stark AI | Litet community i väst, ingen svenska, förklarar inte på djupet | Redan vår visuella förebild — vi matchar uttrycket och slår dem på pedagogik |

Slutsats: vi tävlar inte om att bli störst först. Vi blir **den svenska
bridgeappen som förklarar allt** — och bygger tävlingskänslan med Funbridge-
modellen, som en ensam utvecklare faktiskt kan bygga och drifta.

## Roadmapen — Fas 0 till Fas 6

Ordningen är vald så att varje fas gör appen redo för nästa. Järnregeln gäller
fortfarande: **ett NU i taget** — en fas är inte ett NU, den bryts ner i
NU-stora bitar när den startas. Budmotorns mätspår (etapp 7 osv.) rullar
parallellt genom alltihop, precis som förut.

### Fas 0 — grunden håller för främmande ögon (ingen backend) — ✅ KLAR 2026-07-30
Innan vi bjuder in världen ska det världen möter hålla måttet. Alla tre delarna
(a bottarnas kortspel, b mobilen, c teknisk härdning) är klara & live.
- **a) Bottarnas kortspel:** felrapport #32 (spelplanering: etablera lång färg)
  + #34 (motspelsheuristik). Bor i `play-bot.ts`; mäts med
  `play-quality.probe.test.ts` så förbättringen bevisas, inte antas.
- **b) Mobilen:** **påbörjad.** Konsekvent kortrad KLAR 2026-07-30 (`HandFan` gör
  nu samma färggrupperade kortrad som spelbordets `SouthFan`, delat `REST_OVERLAP`
  — handen ser likadan ut i alla vyer; merge `347d2c3`). Felrapport #36 (större
  kort) STÄNGD "löst på annat sätt": 13 kort får inte plats à 44 px på en 375 px
  rad, ägaren nöjd med storleken vid bordet — inkonsekvensen mellan vyer var den
  verkliga smärtan. **Säkra zoner KLAR 2026-07-30:** topp + botten var redan
  hanterade i `Layout.tsx` (`env(safe-area-inset-top/bottom)`) och `index.html` har
  `viewport-fit=cover` — planens "ingen hantering" var inaktuell; spelbordet ligger
  i den botten-paddade ytan och når inte skärmkanten, så kort göms inte. Kvarvarande
  lucka (vänster/höger i liggande läge / sidourtag) tillagd via
  `max(1rem, env(safe-area-inset-left/right))`. Verifieras slutgiltigt på riktig
  iPhone. **Mobilsvep KLART 2026-07-30:** alla sidor genomgångna i 375 px med
  overflow-detektor — inga trasiga layouter (appen var redan mobil-ren). Enda
  putsen: breda budsystem-tabeller fick en scroll-toningshint (skugga vid
  högerkanten som visas bara när tabellen går att svepa, `ScrollTable` +
  `ResizeObserver`). **→ Fas 0 b KLAR.**
- **c) Tekniska småfixar:** ✅ **KLART & live 2026-07-30.** 404-sida
  (`NotFound.tsx` + catch-all-route i `App.tsx`, facit `not-found.test.tsx`) så
  felskrivna/döda adresser landar mjukt i stället för på tom sida. Route-baserad
  kod-uppdelning (`React.lazy` per sida, Home direkt-laddad, Suspense-gräns i
  `Layout.tsx`): första-laddningens JS gick från en enda ~889 kB-fil till en
  247 kB-entry — den tunga Budsystem-boken (345 kB) och Spela kort laddas först
  när man går dit (siffror från `npm run build`, läs `dist/assets/`).

### Fas 1 — Faceliften (väckt 2026-07-29, PÅBÖRJAD 2026-07-31)
Designspåret återupptas **en yta i taget** (ägarbeslut 2026-07-31: "börja smått &
konkret" — ett skarpt förslag per yta, se först, rulla sedan språket vidare).
Låsta ramar gäller: emerald, svarta spader, guldserifen, Synrey-inspirerat uttryck
(färgerna läses i `src/index.css`). Ligger FÖRE lanseringen av Dagens givar —
första intrycket görs bara en gång.

- **Yta 1 — startsidan: KLAR 2026-07-31 (två pass).** Först: de fyra lägeskortens
  emoji (🃏🎯👁️📖) → **egna guld-linjeikoner** i logotypens språk (inline-SVG i
  `Home.tsx`: spelkort med brandens guldspader, måltavla, öga, bok). Sedan en
  **base44-inspirerad omgörning** (ägarens egna referenser, `BrandMark.tsx` +
  `Home.tsx` + `Layout.tsx` + `index.css`):
    - **Tvåfärgat ordmärke** "re**bid**z" — "re"/"z" i currentColor, "bid" i guld
      med animerat **skimmer** (bridge-ordet *bid* lyft ur namnet). Spader-pricken
      på i:et ersatt av vanlig guldprick (för många spader annars).
    - **Frameless guldspader** — den inramade emerald-rutan borttagen (hero +
      sidhuvud); `BrandMark bare`-läge. Faviconen behåller den inramade.
    - **Samlad hero:** allt i EN grön yta — varumärkesblocket överst + de fyra
      **likvärdiga menyknapparna** (2×2) inne i det gröna. De gamla dubblett-CTA:na
      ("Spela kort →"/"Öva budgivning") och kortsolfjädern borttagna (spretigt).
      Avboxat: borttonande kant (`felt-melt`) + luft + svag spader-vattenstämpel.
    - **Roterande guldram** på menyknapparna (`gold-frame-hover`, conic-gradient +
      `@property --rbz-angle`) som tänds vid hover — "guldet rör sig runt".
    - **Sidhuvudet:** diskret guldmarkering på aktiv flik (mjuk guldton + guldkant)
      i stället för den vita pillen; guldton vid hover; frameless brandmärke.
  "Levande guld" (skimmer + roterande ram) respekterar `prefers-reduced-motion`.
  Verifierat ljust + mörkt, inga konsolfel.

- **Yta 2 — spelbordet: KLAR 2026-07-31 (Synrey-modellen, telefon-först).** Bedömt
  i mobilvyn (375 px) mot ägarens Synrey/Funbridge-referenser. Filer: `Play.tsx`,
  `play/BiddingPhase.tsx`, `play/hands.tsx`, `play/trick-views.tsx`,
  `play/usePlayTable.ts`, `components/PlayingCard.tsx`, `components/BiddingBox.tsx`,
  `components/Layout.tsx`, `lib/cardLayout.ts`.
    - **Full-bleed duk:** spelrutten (`/spela-kort`) går edge-to-edge, hela
      skärmen, inga rundade hörn/ram — appens menyrad (header) är **dold** i
      spelvyn (immersivt). Man tar sig ut via röd **"Avsluta spel"** → startsidan,
      i budfas, spelvy och resultatvy.
    - **Synrey-layout:** din hand nederst (stora `xl`-kort), träkarlen Nord
      upptill när DU spelar, dolda händer visas inte → öppen yta, kompakt
      mittbord. *(Pass 3 ändrade träkarlens plats vid försvar — se nedan;
      ursprungsbeslutet "alltid upptill" visade sig förvirra: handen upptill
      lästes som partnerns fast den var motståndarnas.)*
    - **Tryck-färg-visar-bara-den:** tryck på en färg i handen → bara den färgen
      visas, stor och luftig; "◀ Alla färger" tillbaka.
    - **Mittbordet:** färgpiller (S guld / N grön / V,Ö mörka) med väderstrecken
      UNDER de spelade korten; träkarlen utan transparenta kort.
    - **Guldspråket in på bordet:** guld-bar i stället för blågrå slate, guld-hover
      på chromet; ⋮ + ⓘ staplade uppe till höger (25 % mindre). Större tap-mål
      (budknappar 48 px).
    - **ⓘ-popupen** rymmer auktion + förra sticket + utspel (som Synrey), inte
      flytande på bordet.
  Sticksvepet (etapp 2) lämnades orört (ägarbeslut). Verifierat på telefon, tsc
  grön.

  **Pass 3 (2026-08-02, LIVE):** iterationer efter ägarens speltest mot
  Synrey-referensbilder. Filer: `components/HandFan.tsx`, `components/BiddingBox.tsx`,
  `components/SideStack.tsx`, `pages/Play.tsx`, `play/BiddingPhase.tsx`,
  `play/hands.tsx`, `play/usePlayTable.ts`.
    - **Kortraden i budfasen = budlådans bredd** (`HandFan spread`): färggrupperna
      sprids med `justify-between` inom samma `max-w-md` som budlådan → tydligare.
    - **Två tryck på samma bud = OK** (inget dubbelklick-intervall); annat bud
      byter val, OK-knappen kvar som förr.
    - **Singelton spelas på ETT tryck** — färgvalssteget hoppas över när färgen
      bara har ett kort.
    - **Träkarlen på sin RIKTIGA sida vid försvar** (`SideDummyPiles`): spelförare
      Öst → träkarl Väst till vänster (och tvärtom), som Synrey-högar — en hög
      per färg staplade lodrätt, korten roterade 90°, HÖGSTA kortet underst mot
      bordets utkant (bara valörremsan ute), lägsta överst fullt synligt, trumfen
      "till vänster" ur träkarlens perspektiv (Öst → överst, Väst → nederst).
      Sticket flyttar samtidigt mot spelförarens sida → stor yta, större kort
      (`md`). Motorn hade hela tiden RÄTT hand — felet var placeringen utan
      etikett (såg ut som partnerns).
    - **SideStack spegelfix** (budvisningen/omspelningen): Öst roteras åt motsatt
      håll mot Väst = äkta spegelbild; `mirrorCorners`-tricket ur bruk.

- **Yta 3 — budlådan: KLAR 2026-08-02 (kväll).** Ägarens iterationer i tur och
  ordning under sessionen (detalj: `docs/historik.md` 2026-08-02):
    - **Budfasens kortrad = spelfasens** (`HandFan flat` + delade `FLAT_OVERLAP`
      i `cardLayout.ts`): fasta 64×96-kort, ETT jämnt överlapp utan färgglapp,
      13 kort = 349 px — skulden från pass 4 ("tas med budlådans storlek") inlöst.
    - **Mål-knappen bor i kompassrutan** (Bricka/zon uppflyttade under rosen),
      med korta måletiketter (`describeTargetShort`); fulltext i väljaren.
    - **Hjälpen under knapparna:** betydelse-raden + "Motorn hade valt" på EN
      rad UNDER X/XX/PASS/OK — knapparna flyttar sig aldrig.
    - **Valt bud:** guldring INUTI knappen (`ring-inset`, chipet växer inte)
      + startsidans roterande guldbåge (`gold-frame`, 6 s/varv). OK förblev
      himmelsblå (ägarbeslut efter guldtest). Luft i rutnätet: 4 px.
    - **Raden ovanför låst till max 576 px** (centrerad) på stora skärmar.
    - Ryms på 812 px-mobil även i värsta fallet; breddgolv 352 px.
    - Buggfix på köpet: budvalet nollställs vid ny giv (två-tryck-OK kunde
      annars bjuda ett gammalt val med ETT tryck).
  Nästa yta väljs av ägaren (t.ex. sidhuvudet på övriga sidor).

Detalj/väntande material: `docs/senare.md` (faceliftposten).

### Fas 2 — Konton + sparade framsteg (Beslut B steg 2–3)
Första backend-bygget: Supabase (databasvalet bekräftas med ägaren vid start),
registrering/inloggning inkl. Apple Sign In, och framsteg/resultat sparade per
användare i stället för bara i webbläsaren. Här uppstår GDPR-ansvaret — görs
rätt från början. Tekniken och principerna (utbytbar backend, fuskkontroll på
servern): `docs/framtid-multiplayer-plattform.md`.

### Fas 3 — "Dagens givar" (Funbridge-modellen — konkurrenssteget)
Kärnan i hela planen: varje dag serveras samma seedade givar till alla.
Du spelar dem mot bottarna, lämnar in resultatet och jämförs med alla andra
(MP-räkning, topplista, din historik). Asynkront — ingen realtid behövs.
Kräver Fas 2 (konton) plus: given serveras från servern, facit och
rondgenomgång låses upp först efter inlämning, resultatet valideras på
servern. Detta är den första funktionen som gör rebidz till en *tävlings*-app.

### Fas 4 — Mobilappar (App Store + Google Play)
Capacitor wrappar den befintliga webbappen till riktiga appar. Hårda avgifter:
Apple 99 USD/år, Google 25 USD engångs. PWA:n finns redan som brygga.

### Fas 5 — Engelska (andra språket)
Hela gränssnittet + budsystem-boken på engelska. Stort eget spår (boken är
appens största text). Tas när svenska basen bär — men skriv redan nu ny
UI-text så att den är lätt att lyfta ut (inga hopklistrade meningsfragment).

### Fas 6 — Realtidsbord (BBO-modellen)
Riktiga bord där människor spelar med/mot varandra live — inklusive ägarens
egen "öppet bord"-idé (två kompisar mot två bottar, utan konton). Det svåraste
man kan bygga (realtidssynk, tappade anslutningar, fuskkontroll). Startas
först när Fas 3 har visat att grunden bär.

## Vad som INTE ändras av den här planen

- **Järnregeln.** NU innehåller exakt en sak; faserna bryts ner i NU-bitar.
- **Budmotorns mätspår** fortsätter parallellt — motorn är produkten.
- **Ingen backend byggs** förrän ägaren uttryckligen säger "kör" på Fas 2.
- **Hostingen förblir statisk** till dess (regeln i CLAUDE.md står kvar).
- **Appnamnet:** `rebidz`, alltid gemener; repo/URL förblir `Learn-Bridge`.
