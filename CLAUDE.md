# CLAUDE.md — Bridge-app
Läs den här filen först varje session.

## 🗺️ Projektkarta — NU / NÄST / SENARE / PARKERAT
> **Detta är överblicken. Läs den först.** `docs/arbetslista.md`, `docs/status.md`
> och felsökningsplanen är detaljnivån — kartan här styr ordningen.
>
> **Järnregel:** 🔵 NU innehåller **exakt en sak**. Inget annat rörs förrän den är
> klar. Kommer ägaren med en ny idé mitt i ett NU-jobb ska Claude **stoppa** och
> säga *"bra idé — men just nu är NU: X, den rör vi inte"*, och lägga idén i
> ⚪ SENARE. NÄST har max 3 saker. När NU blir klar: flytta upp en sak från NÄST,
> visa återstående punkter (regeln i `docs/arbetsrutiner.md`) och låt ägaren välja.

### 🔵 NU — Projektrevision R1 pågår (delen som är klar är MERGAD + LIVE)
> **NÄSTA GÅNG börjar vi med: Fynd #2 delbit 2** — takeout/Lebensohl mot deras
> svaga tvåor/spärrar (ny gren `audit/r1-fynd2-delbit2`; starta med exempelhänder
> + fråga ägaren om trösklarna, precis som DONT-golvet). Full bild:
> **`docs/audit/r1-budsystem.md`**.
>
> **Läget (2026-07-04):** R1-rapporten skriven; fynd #1/#3/#4/#5 lagade (facit
> först); **Fynd #2 (§7-konkurrens) delbit 1/5 klar** — DONT mot deras 1NT
> inkopplad (golv 8 hp direkt / 6 hp balansering; ägarbeslut). Allt detta är
> **mergat till main och deployat live** (2026-07-04, 1635 tester gröna).
> **Kvar av #2:** delbit 2 (takeout/Lebensohl mot svaga/spärr), 3 (Mathe mot
> deras 1♣), 4 (konkurrens efter VÅRA 1NT/2♣/svaga), 5 (fortsättningar bortom en
> rond). Ägaren valde "bygg hela #2, delbit för delbit".
>
> Färdigt & pushat arbete (alla "🎉 KLART"-block + FAS-historiken) bor nu i
> **`docs/historik.md`** — inte här. Detaljerad status: `docs/status.md`.

### 👀 Bevaka i spel (aktiva noteringar från nyligen byggt — säg till om det känns fel)
- **DONT mot deras 1NT (R1 Fynd #2 delbit 1, NYTT):** bottarna stör nu deras
  1NT-öppning med DONT (X/2-läget) — golv 8 hp direkt, 6 hp balansering. Säg till
  om det känns för aggressivt/passivt.
- **Straffdubbling mot ägaren:** bottarna kan nu straffdubbla ÄGAREN vid
  offringar på 3-läget+ (poängsystemet). Säg till om det känns för aggressivt.
- **Essfrågor utan formell trumf / toppsekvenser andra hand / 4M-pass efter
  transfer-3NT** (felrapport #10–#13) — nya bot-beteenden att hålla ögonen på.
- **Michaels & essfrågor i fria auktioner; motspelarna sparar torra ess**
  (felrapport #6/#7/#9).
- **Balansering mot ägaren:** bottarna balanserar nu även MOT ägaren
  (symmetriskt — korrekt bridge, men säg till om det känns fel; felrapport #5).
- **Öst över spärrhöjning** (1♣–2♥–X–3♥ → konkurrera 3♠ eller passa?): NYTT
  frivilligt läge, boten passar — ägarbeslut om det känns fel (felrapport #1–4).

### 🟢 NÄST (max 3, i ordning)
1. **Mer UI-förfining** — ägaren pekar ut vad när det blir aktuellt.

### ⚪ SENARE (oordnat — hämtas upp till NÄST en i taget)
- **Kanoniska linjen passar ut ostörda tvåfärgsinkliv** (fynd felrapport #7,
  2026-07-03): `buildAuction` (`auction.ts`) kan stänga en linje som
  1♠–2NT–P–P–P — advancern ska aldrig passa ostört (ägarbeslut FAS 10).
  Live-budlådan är lagad; luckan finns bara i förbyggda linjer (Budvisningen
  m.m.). Trä in `advanceTwoSuiter` i linjens konkurrensrond.
- ~~**Dubblingar (X/XX) in i slutkontraktet**~~ **KLAR 2026-07-04** (commit
  `0864224`, parallellsession): X/XX följer med genom `contractFromCalls` och
  poängräkningen (`scoring.ts` enligt ägarens poängguide) är byggd.
- **Felrapportering: PAT-i-localStorage-varianten** (skicka issuen direkt från
  appen utan att öppna GitHub) — grundvarianten (förifylld issue-länk) = 🔵 NU.
- **Svårighetsnivåer på bottarna** (ägarbeslut: SENARE, ej del av FAS 11 MED).
- **Bot-hjärnans B2 (cash-ordning) + Steg C (rätta räkningen)** — villkorade:
  byggs bara om en facit-giv bevisar behovet (`docs/bot-hjarna.md`).
- **Motspelarnas kast-vakt** — B1 gäller bara spelförarsidan; försvarets
  sakningar kräver inferens om partnerns hand (eget arbete).
- FAS 9 Passad hand, FAS 10 Försvarsbud, FAS 11 Kortspel = **KLARA & pushade**
  (bara kvar här som historik — behandla dem inte som återstående arbete).

### 🅿️ PARKERAT (medvetet INTE nu — sluta väga in i beslut)
- **Slam-quirken** (~0,25 %, Jacoby 2NT→cue→RKC): känd gräns, stängs lagligt.
  Bekräfta bara att den fortfarande stängs — jaga den aldrig som bugg.
- **DDS-facit på tunga fulla givar:** känd gräns (nodbudget). Ej fel.
- **Off-book §7 bredd** (inkliv över 1NT/svaga tvåor/spärrar; balansering
  BYGGD 2026-07-03 via felrapport #5 — kvar här: "låna en kung"-lättnaden,
  dvs. lättare krav i balanseringssits än direkt sits).
- **"Framkalla slutbud"-väljaren** (ägaridé) + **webworker för DDS-facit**.

## Arbetsrutiner (följ varje gång)
- **Vid sessionsstart:** följ 🟢-checklistan i `docs/arbetsrutiner.md`.
- **Vid sessionsslut:** följ 🔴-checklistan i `docs/arbetsrutiner.md`.

## Vad det här är
Interaktiv webbapp för att lära sig och spela bridge (kortspelet).
Användaren ska kunna spela olika händer och lära sig olika budsystem.
Allt körs i webbläsaren, gratis-hostat på GitHub Pages.
## Vem jag bygger för
Ägaren är nybörjare utan programmeringsbakgrund.
- Förklara på enkel svenska. Inga tekniska termer utan förklaring.
- Ett steg i taget. Vänta på bekräftelse innan du går vidare.
- När ägaren måste göra något själv (klicka, logga in, godkänna):
  säg exakt var och vad.
- Du skriver ALL kod. Ägaren läser den inte. Optimera för korrekthet
  och för att DU lätt ska kunna underhålla den över tid.
## Teknisk stack
- React + Vite + TypeScript
- Tailwind CSS för styling
- Ingen backend. Allt client-side.
## Hosting & deploy (viktiga låsningar)
- GitHub Pages = ENDAST statiska filer. Ingen server, databas eller
  backend-kod är möjlig.
- Auto-deploy: en GitHub Actions-workflow bygger sidan vid varje push
  till main. Ägaren kör ALDRIG bygg-kommandon själv – push räcker.
- Vite `base` MÅSTE sättas till "/<repo-namn>/", annars blir sidan
  blank på Pages. Det är det vanligaste deploy-felet – kontrollera det.
- Användarens framsteg sparas i localStorage (ingen databas).
## Bridge-specifikt
- "Rätt svar"-feedback via en double-dummy solver i WebAssembly
  (Bo Haglunds DDS, open source, kör i webbläsaren). Verifiera vilket
  npm-paket som är bäst underhållet innan du kopplar in det.
- Givar och budsystem ligger som JSON-filer i repot – aldrig
  hårdkodade inne i komponenterna.
- Budsystem: börja med ETT system, gör det ordentligt, lägg till fler
  senare. Bygg inte alla på en gång.
## Beslut
- Budsystem: **2 över 1 (2/1)**. Endast detta (lägg till fler senare).
- **TP i budvalet (beslut 2026-06-30, byggs i steg).** Boten ska tänka i
  totalpoäng (TP/fördelning), inte rå HP. **Låst regel:** en **12 HP-hand öppnar
  alltid** – TP får aldrig *nedgradera* en öppningshand (människor gör det extremt
  sällan). TP får däremot *uppgradera* (bra 11:a öppnar) och *nudga sang*. Omfång:
  brett (öppning → svar → återbud), men implementeras **i test-låsta steg** så
  on-book aldrig rubbas. **Steg A klart:** öppningsgolvet (`openings.ts`:
  `HP ≥ 12 || TP ≥ 12`). **Steg B klart:** svararens högfärgshöjningar räknar
  **stödpoäng = `max(HP, dummyPoints)`** (`responses.ts` `respondToMajor`) – Bergen
  fullt (singel +3 m. 4 trumf) men aldrig under HP, så korthet *lyfter* en höjning
  (11 HP + singel + 4 trumf → splinter) men platta händer nedgraderas aldrig.
  **Steg C-1 klart:** öppnarens **högfärgs-accepter** räknar **Bergenpoäng =
  `max(HP, bergenPoints)`** (`rebids.ts`: `openerRebidAfterSimpleRaise`,
  `openerRebidAfterBergen`, `openerRebidAfterSplinter`) – form lyfter mot game
  try/utgång/slamintresse, aldrig under HP (en formstark 11:a accepterar utgång
  mot en limithöjning). **Kvar:** C-2 = svararens/öppnarens **minorhöjningar** på
  TP, C-3 = **sang-accepter**, D = TP-nudge för **sangöppning**. Ägaren vill ge
  **mänsklig input i konkreta budsituationer** löpande – fråga hellre än gissa.
- **Spelstick i öppningen (beslut 2026-07-01).** Nytt värderingsmått `playingTricks`
  (`evaluation.ts`): honnörer + långa kort (+1/kort över 3 i en färg med ess/kung).
  En hand med **≥ 8½ spelstick öppnar 2♣** (stark) även med HP < 22 – starka
  fördelningshänder (lång stark färg, få hp) tas nu om hand i stället för att öppna
  1 i färg och tolkas som minimum. Balanserade 22+ oförändrat. Visas i `HandView`.
  **Kvar (ägarens prio):** starkare 1-lägesåterbud/hoppskift när en stark hand ändå
  öppnar på 1-läget; sedan ärligt giv-facit + DDS-optimal spelföring (uppskjutet).
- Första funktion: **budträning** – visa hand, välj bud, appen ger facit.
- Nästa stora riktning: **Spela mot datorn** (offline mot bottar; kvalitet före tempo).
- **Målgrupp (beslut 2026-06-30): erfaren spelare** – en pålitlig, robust 2/1-
  partner/motståndare (inte nybörjarträning först).
- **PIVOT (beslut 2026-06-30): tolkande budmotor.** Roten till "stel/inkomplett/
  felaktig" var att motorn är **generativ** (hand → en kanonisk rad). Vi bygger ett
  **tolkande** lager (`src/lib/engine/auction-interpret.ts`) som läser den faktiska
  auktionen. **Steg 1+2 klara & live:** egna/off-book-bud får ALLTID en förklaring.
  **Steg 3 klart (kärnan):** `decideCall` lämnar ideallinjen när Syd bjuder
  off-book (`divergedFromLine`) och datorpartnern svarar historiedrivet
  (`offBookResponse`): stöd m. fit graderat efter stödpoäng (3-korts fit för
  öppnad högfärg, annars 4+; enkel/inbjudan/utgång), annars egen färg/sang.
  On-book bevisat oförändrat. **Konkurrens-fortsättning klar:** `decideCall`
  svarar historiedrivet även när linjen tagit slut men auktionen är öppen
  (`built.open`) – störda auktioner dör inte längre efter en rond; partner +
  advancer konkurrerar vidare. **§7-inkliv i budlådan klart:** när auktionen gått
  off-book kliver motståndarna in på RIKTIGT via `overcall` (`maybeOvercall` i
  `auction-live.ts`) i stället för att tystna – men bara DIREKT sits (motståndaren
  öppnade nyss 1 i färg, vår sida har inte sagt något). Inkliv/X/Michaels/ovanlig
  2NT ur §7-motorn. **NÄSTA GÅNG STARTAR VI MED:** balansering (inkliv efter en
  passrunda) + inkliv över andra öppningar (1NT/svaga tvåor) – sedan slam-quirken.
- Budmotor byggs i `src/lib/engine/`, test-drivet (`npm test`).
- Detaljerad implementationsstatus: **`docs/status.md`**
- Byggordning framåt: **`docs/arbetslista.md`** (NB: pivoten ovan går före den gamla
  FAS-ordningen i felsökningsplanen).

## Konkreta fakta om detta projekt (för deploy)
- GitHub-repo: **PGreen90/Learn-Bridge** (publikt).
- Live-URL: **https://pgreen90.github.io/Learn-Bridge/**
- Vite `base` = **"/Learn-Bridge/"** (måste matcha repo-namnet exakt).
- Auth: gh CLI är inloggad som PGreen90 (device-flow) och är git
  credential helper. Pusha via `git push`. Scopes inkl. `workflow`.
- Node.js ligger i `C:\Program Files\nodejs\` (lägg den först i PATH
  i nya shells: npm/node finns inte alltid på PATH automatiskt).
- Pages-källa = "GitHub Actions" (build_type=workflow), redan aktiverat.

## Projektstruktur
- `index.html` – sidans skal, laddar src/main.tsx
- `src/main.tsx` – startpunkt, monterar React-appen
- `src/App.tsx` – router (HashRouter) som kopplar adresser till sidor
- `src/index.css` – `@import "tailwindcss";` (Tailwind v4)
- `src/types/bridge.ts` – TypeScript-typer (Card, Hand, Deal, BiddingQuestion)
- `src/lib/storage.ts` – läs/skriv framsteg i localStorage
- `src/components/` – återanvändbara byggblock:
  - `Layout.tsx` (topbar + meny), `Panel.tsx`, `Button.tsx`,
    `SuitSymbol.tsx`, `HandView.tsx`
- `src/pages/` – en fil per skärm: `Home`, `BiddingPractice`,
  `Learn`, `Settings`
- `vite.config.ts` – base-path + react- och tailwind-plugin
- `.github/workflows/deploy.yml` – auto-bygge & publicering vid push
- (kommer) `src/data/*.json` – givar och budsystem som data

## Navigering (router)
- HashRouter används (adresser med #, t.ex. .../#/budtraning) eftersom
  det fungerar på GitHub Pages utan serverinställningar. Byt INTE till
  BrowserRouter utan att lägga till en 404-fallback för Pages.
- Lägg till ny skärm: skapa `src/pages/Xxx.tsx`, lägg till en
  `<Route>` i `App.tsx` och en länk i `NAV`-listan i `Layout.tsx`.

## Hur man lägger till innehåll
- Bridge-typerna bor i `src/types/bridge.ts` – utgå alltid från dem.
- Övningar ligger som JSON i `src/data/exercises/<tema>.json`, aldrig
  hårdkodade i komponenterna. Teman listas i `src/data/themes.json`.
- Inläsning sker i `src/lib/bidding.ts` (registret `EXERCISES_BY_THEME`).
  Ny temafil måste importeras och läggas till där.
- Handen skrivs som kort text, t.ex. `"S:AK974 H:K83 D:Q6 C:J52"`.
  Tian skrivs som `T`. Tom färg: `-`. Parsas av `parseHand`.
- En övning = `auction`: en lista med steg. Ett steg är antingen ett
  manus-bud `{ "bid": "1H" }` (partner/motståndare) eller ditt beslut
  `{ "decision": { "options": [...], "answer": "1S", "explanation": "..." } }`.
  Vem som bjuder räknas ut från `dealer` + ordningen (medurs N→E→S→W).
- Bud skrivs som `"1C"/"1D"/"1H"/"1S"/"1NT"`, samt `"P"`, `"X"`, `"XX"`.
- Lägena (Scope): `opening`, `opening-response`, `full-auction`.
  Ett tema hör till ett läge via fältet `scope` i themes.json.
## Kommandon
- `npm run dev` – lokal förhandsvisning under utveckling
- `npm run build` – byggs automatiskt av GitHub Actions, sällan manuellt
## Vad man INTE gör
- Lägg aldrig till backend/server/databas – Pages kan inte köra det.
- Glöm aldrig Vite `base`-pathen vid deploy.
- Bygg inte alla budsystem på en gång – ett i taget.
- Lämna aldrig ägaren med ett tekniskt fel utan förklaring + nästa steg.
