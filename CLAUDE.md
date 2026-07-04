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

### 🔵 NU — inget aktivt bygge. Ägaren väljer nästa delbit av R1 #2 (eller annat spår).
> **NÄSTA GÅNG börjar vi med:** ägaren pekar ut nästa NU (en sak, järnregeln). Bra
> kandidater: **nästa delbit av R1 #2** (se "Kvar" nedan) eller en punkt ur R6:s
> handlingsplan (`docs/audit/SLUTRAPPORT.md`) / NÄST-listan.
>
> **Läget (2026-07-04, audit session 9 avslutad):** Hela revisionen R1–R6 KLAR +
> live (0 KRITISK, 2 HÖG båda i R1, 27/32 fynd lagade; slutrapport
> `docs/audit/SLUTRAPPORT.md`). Därefter startade R1 Fynd #2 (bredda störd
> budgivning) och **delbit 6 är byggd, mergad (`ce7f1cd`) och LIVE.**
>
> **Delbit 6 (LIVE):** öppnarens rond-2 i det INKLÄMDA konkurrensläget efter
> partnerns enkla högfärgshöjning (`1M–(inkliv)–2M–(deras inklämda bud)`): pass
> (minimum) · 3M (6:e trumf, lagen om totala stick) · **X = MAXIMAL DUBBLING (game
> try, 15–17)** · 4M (utgång, 18+); partnern svarar X:et 4M (accept, 8+ stöd) /
> 3M (avböj). Två detektorer i `decideCall`, FÖRE `maybePenaltyDouble` (X reserverat
> för game try där — konventionens kända avvägning). Facit:
> `auction-opener-competition.test.ts` (7 integrationstester). Se 👀 Bevaka nedan.
>
> **Sidospår klart & live (2026-07-04, mergepunkt `213d90e`):** felrapportering
> inkopplad i **Budvisningen** (`Spela.tsx`) — knappen "Rapportera fel →" dyker upp
> så snart auktionen budats färdigt (korten spelas aldrig där, så inga stick följer
> med; kontraktet härleds ur buden). Samma `FelrapportDialog` som i Spela kort, men
> med valfri bud-specifik text ("Rapportera fel i budgivningen" +
> `BIDDING_REPORT_CATEGORIES`). Detaljer: `docs/status.md`.
>
> **Kvar av R1 #2 (kommande delbitar, ägarstyrt):** öppnarens rond-2 när partnern
> bjöd NY färg / 1NT (ej höjning); balanseringens "låna en kung"-lättnad; bredare
> flerronds-konkurrens. Delbit 3 (Mathe mot stark 1♣) förblir PARKERAD.
>
> **Öppna SENARE-poster ur revisionen:** R3 #3 del 2 (auto-facit på hela given —
> kräver webworker), R3 #8 ("Förra sticket" 85 % — 375px-koll utestående). Se
> ⚪ SENARE nedan.
>
> Färdigt & pushat arbete (alla "🎉 KLART"-block + FAS-historiken) bor nu i
> **`docs/historik.md`** — inte här. Detaljerad status: `docs/status.md`.

### 👀 Bevaka i spel (aktiva noteringar från nyligen byggt — säg till om det känns fel)
- **Takeout-doublingar (felrapport #23 + tvåfärgs-X, 2026-07-05, NYTT):** (1) en
  **17+ enfärgs-monster** upplysningsdubblar nu en öppning och visar sedan sin färg
  via ett **monster-återbud** som hoppar till utgång (t.ex. (1♣)–X–…–4♠) — säg till
  om det känns för aggressivt att jumpa hela vägen till game. (2) När motståndarna
  bjudit **två färger** (1♦–P–1♥) dubblar en **4-4-hand (10+)** de objudna
  färgerna; advancern svarar aldrig längre i deras egen färg. Regler i
  `docs/budsystem.md` §7.3.
- **Öppnarens rond-2 i inklämt konkurrensläge (R1 Fynd #2 delbit 6, NYTT):** efter
  `1M–(inkliv)–2M–(deras inklämda bud)` passar öppnaren inte längre blint. Med
  minimum + 6:e trumf konkurrerar den 3M; med utgångsintresse (~15–17) dubblar den
  (**X = maximal dubbling = game try**, INTE straff i det läget); med 18+ bjuder den
  4M. Partnern svarar X:et 4M (max) / 3M (min). Golv: 15+ = game try, 18+ = utgång
  (speglar den ostörda openerRebidAfterSimpleRaise). Säg till om X-som-game-try
  känns fel, eller om golven bör justeras.
- **DONT mot deras 1NT (R1 Fynd #2 delbit 1):** bottarna stör nu deras
  1NT-öppning med DONT (X/2-läget) — golv 8 hp direkt, 6 hp balansering. Säg till
  om det känns för aggressivt/passivt.
- **Försvar mot deras svaga tvåor/spärrar (R1 Fynd #2 delbit 2, NYTT):** bottarna
  kliver nu in mot motståndarnas svaga 2♦/2♥/2♠ och spärrar (3-läget+) — takeout-X,
  2NT (15–18), cue, naturligt, 3NT. Golv för takeout-X: 12 hp ej sårbar / 13 sårbar
  direkt, 10 hp balansering; mot spärr 14 hp (medvetet stramare — säg till om du
  vill lätta även spärr-balanseringen).
- **Svar när motståndaren stör VÅR öppning (R1 Fynd #2 delbit 4, NYTT):** när du
  öppnar 1NT och en motståndare stör med DONT svarar din bot-partner nu (X/XX =
  straff/värden från 8 hp, egen 5+ färg = naturligt, annars pass) i stället för att
  passa. När du öppnar en svag tvåa/spärr och de takeout-dubblar redubblar partnern
  med 10+ (värden) eller höjer spärrartat med fit. Säg till om golven (8 / 10)
  känns fel.
- **Straffdubbla flykten efter vår XX (R1 Fynd #2 delbit 5, NYTT):** öppnar du
  1NT, de stör med DONT och din bot-partner redubblar (XX = vi äger handen), så
  flyr motståndarna undan till en färg STRAFFDUBBLAR din sida dem nu — varje steg,
  tills de får spela dubblat — i stället för att passa flykten. Utlöses bara efter
  vårt 1NT + XX (inte efter svaga tvåor/spärrar — där äger vi inte handen). Säg
  till om det känns för aggressivt att dubbla varje flyktbud.
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
- **17+ enfärgs-monster EFTER två bjudna färger (takeout, 2026-07-05):** en 17+
  enfärgshand som borde upplysningsdubbla när motståndarna redan bjudit två färger
  (t.ex. 1♦–P–1♥) gör det INTE — där följer `decideCall` en färdig buildAuction-
  linje som passar handen, så live-hanteraren (`maybeTakeoutOfResponse`, som bara
  gör 4-4) når aldrig fram. Att tvinga monster-dubbling där kräver att den
  generativa linjen i `auction.ts` (`buildAuction`) modellerar inklivet — ett
  grundläggande ingrepp. Öppningsfallet + 4-4-fallet är klara & live (felrapport
  #23, §7.3). Plockas upp om en giv bevisar att luckan svider.
- **Auto-facit på hela given i webworker (R3 fynd #3 del 2):** visa spelförarens
  double-dummy-optimum automatiskt i resultatdialogen. Byggdes synkront men
  backades — helgivs-DDS från utspelet är för tung (probe: 79/80 kontrakt gav upp
  efter ~1,7 s, spränger 2M-nodbudgeten → skulle frysa + nästan alltid "för tung").
  Kräver bakgrundstråd (mc-worker) med möjliga långa väntetider, eller snabbare
  lösare. Del 1 (budhint "Motorn hade valt X") är redan gjord + live.
- **"Förra sticket"-panelen 75 %→85 % (R3 fynd #8):** liten läsbarhets-bump ägaren
  ville ha. Backad tills 375px-överlappet mot pågående sticket kan ögonkollas
  (mobil-preview var blockerad). Ändra `scale-75`→`scale-[0.85]` i `Play.tsx` och
  verifiera på 375 px; krockar den → åter till 75 % eller justera ankringen.
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
- **Mathe mot stark konstgjord 1♣ (R1 Fynd #2 delbit 3) — FRAMTIDSIDÉ, ägarbeslut
  2026-07-04.** Funktionen `defendStrongClub` (`defense-conventional.ts`) är
  färdig + enhetstestad men medvetet EJ inkopplad, för i vårt 2/1-system är 1♣
  en NATURLIG öppning (den starka handen öppnar 2♣) → en stark konstgjord 1♣ kan
  aldrig dyka upp, så Mathe har inget läge att utlösas i. Mot naturlig 1♣ räcker
  vanliga inkliv/upplysningsdubbling (redan inkopplat via `maybeOvercall`).
  **Plockas upp först den dag vi lägger till FLER budsystem** (t.ex. stark klöver/
  Precision) — då blir den relevant, antingen för att bottarna spelar systemet
  själva eller möter en motståndare som gör det. Kopplas då in på samma sätt som
  DONT/svaga-två-försvaret (detektor i `buildAuction`). Se
  `docs/audit/r1-budsystem.md` (Fynd #2, delbit 3).

## Arbetsrutiner (följ varje gång)
- **Vid sessionsstart:** följ 🟢-checklistan i `docs/arbetsrutiner.md`.
- **Vid sessionsslut:** följ 🔴-checklistan i `docs/arbetsrutiner.md`.

## Vad det här är
Interaktiv webbapp för att lära sig och spela bridge (kortspelet).
Användaren ska kunna spela olika händer och lära sig olika budsystem.
Allt körs i webbläsaren, gratis-hostat på GitHub Pages.
- **Appen heter `RebidZ`** i gränssnittet (ägarens eget namn, beslut 2026-07-02).
  **Repo och URL förblir `Learn-Bridge`** (medvetet – byt inte). Ser du "RebidZ" i
  koden och "Bridge-app" i äldre text är RebidZ det rätta produktnamnet.
- **Designriktning (låst):** Synrey-inspirerat uttryck, **emerald-palett**, egen
  stil tillåten bortom Synrey. **Spader är SVARTA (ägaröverride – ändra INTE
  tillbaka till konventionell färg).** Läs de verkliga färgerna i `src/index.css`,
  anta dem inte. Framtida plattform-ambition (konton/multiplayer): `docs/framtid-
  multiplayer-plattform.md` = PARKERAT tills ägaren säger "kör".
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
- Auto-deploy: en GitHub Actions-workflow (`deploy.yml`) publicerar sidan vid
  varje push till main. Ägaren kör ALDRIG bygg-kommandon själv – push räcker.
- **Test-/typgrind före live (R5-fynd #1):** workflowen kör ett `test`-jobb
  (`npx tsc` + `npm test`) som `build`/`deploy` BEROR på. Rött test eller typfel
  → ingen publicering. Ändra aldrig bort den grinden – den är enda automatiska
  skyddet mellan koden och det som blir live.
- Vite `base` MÅSTE sättas till "/<repo-namn>/" (= `/Learn-Bridge/`), annars blir
  sidan blank på Pages. Det är det vanligaste deploy-felet. **Låst av ett vaktest**
  (`src/deploy-config.test.ts`, R5-fynd #2) – bryter du base failar testsviten.
- **Rollback & "senast gröna live" (R5-fynd #4):** varje funktion mergas med en
  egen `--no-ff`-mergepunkt → backa en hel funktion med
  `git revert -m 1 <merge-sha>`. Vilken commit som just nu ligger publicerad =
  den senaste **gröna** körningen i Actions (`gh run list`). Det finns ingen
  separat tag/markör i repot; Actions-historiken är facit.
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
  2NT ur §7-motorn. *(Balansering + inkliv över 1NT/svaga tvåor/spärrar byggdes
  senare – R1 Fynd #2 delbit 1–2, live. Slam-quirken är en känd, laglig gräns, se
  🅿️ PARKERAT. Vad som är NÄST styrs av projektkartan högst upp, inte av denna rad.)*
- Budmotor byggs i `src/lib/engine/`, test-drivet (`npm test`).
- **Innan du rör budlogik:** läs "Budmotorns tre auktionslager + `open`-handoff"
  i `docs/status.md` — det avgör om ny logik hör hemma i `auction.ts` (on-book),
  `auction-live.ts` (konkurrens/off-book) eller `auction-interpret.ts` (förklaring).
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
