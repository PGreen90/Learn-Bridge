# Projektstatus — vad som är byggt

> Läs denna fil när du vill veta exakt vad som implementerats.
> Uppdateras i takt med att funktioner landar.
> Detaljerad byggordning framåt finns i `docs/arbetslista.md`.

## Budmotor (`src/lib/engine/`)

- **M1–M3 klara + punkt 10–27** ur arbetslistan.
- Spela-fliken bygger auktioner: öppning → svar → öppnarens återbud → svararens andra bud för öppningarna 1♣/1♦/1♥/1♠/1NT.
- **Stark 2♣** – `responses-2c.ts`
- **Svaga tvåor 2♦/2♥/2♠ med Ogust** – `responses-weak2.ts`
- **Spärröppningar 3X/4X** – `responses-preempt.ts`
- **2NT/3NT-öppningar** – `responses-2nt.ts`
- **Drury** för passad hand – `responses-drury.ts`
- **Försvarsbud §7** (punkt 21–27): inkliv/Michaels/ovanlig 2NT (`overcalls.ts`), dubblingar (`doubles.ts`), Lebensohl (`lebensohl.ts`), DONT (`dont.ts`), försvar mot konventionella öppningar (`defense-conventional.ts`) — störd budgivning inkopplad i `buildAuction` (LHO kliver in på riktigt).

## Stödsystem (FAS 3, klar 2026-07-01)

- **Punkt 11 – gemensam fitklassificering** (`classifyFit` i `evaluation.ts`): EN
  sanningskälla för fitens kvalitet – `none / two / three / good-three / four /
  five-plus` (+ `hasFit`, `hasFourPlus`). "Bra 3-stöd" = 3 trumf med trumfhonnör
  (E/K/D) eller kort sidofärg (singel/renons).
- **Punkt 12 – Bergen aldrig med 3 stöd:** `respondToMajor` (`responses.ts`) fyrar
  Bergen/Jacoby/splinter via grinden `classifyFit(...).hasFourPlus`. Intervall:
  3♣ = 7–9 konstruktiv, 3♦ = 10–12 limit, 3M = 0–6 spärr.
- **Punkt 13 – Jacoby 2NT:** 4+ stöd (`hasFourPlus`), "ingen kortfärg" via
  ordningen (splinter-kollen kommer före → singel/renons splintrar i stället).
- **Punkt 14 – splinter kortfärg:** efter tvetydig splinter + öppnarens relä visar
  svararen singelns färg upp-the-line (billigaste steg = lägsta möjliga kortfärg,
  4♣/4♦/4♥) – `responderRevealSplinterShortness`. Renons via Exclusion. Öppnarens
  slamvärdering på kortfärgen = FAS 4 punkt 18.
- **Punkt 15 – Bergen game try:** trigger 1M–2M–2NT använder TP/Bergenpoäng 15–17.
  Svararen svarar enligt Bergens äkta variant (visa korthet upp-the-line, annars
  platt 3M signoff / 4M accept) – `responderAnswerBergenGameTry`.
- Ägarbeslut 2026-07-01: både splinter-kortfärg och game try-svar visar korthet
  **upp-the-line** (billigaste bud = lägsta möjliga kortfärg).

## Handvärdering

- Bergens Adjust-3 i `evaluation.ts`: startpoäng, stödpoäng och Bergenpoäng.
- Visas som `15 HP (17 TP)` i `HandView`.
- TP styr öppningströskeln (`openings.ts`, färgöppning vid `HP ≥ 12 || TP ≥ 12`:
  12 HP öppnar alltid, bra 11:or uppgraderar) och slamzon (`slam-auction.ts`).
- **TP-steg B:** svararens högfärgshöjningar väljer nivå på stödpoäng =
  `max(HP, dummyPoints)` (`responses.ts`) – korthet lyfter (→ splinter), men
  nedgraderar aldrig under HP.
- **TP-steg C-1:** öppnarens högfärgs-accepter (enkel höjning, Bergen, splinter)
  räknar Bergenpoäng = `max(HP, bergenPoints)` (`rebids.ts`) – form lyfter mot
  game try/utgång/slamintresse, aldrig under HP. Kvar: minorhöjningar + sang-
  accepter (C-2/C-3) + sang-nudge för öppning (D).
- Spec: `docs/handvardering.md`

## Slamverktyg (`slam.ts`, `slam-auction.ts`, `nt-slam.ts`)

- 1430 RKC, cue-bid, Sjöbergs 5NT, Gerber, Exclusion — testade motorfunktioner.
- Inkopplade i växande auktioner: Jacoby 2NT-fit (1430 RKC vid slamzon ≥ 33), Sjöbergs 5NT i RKC-grenen, cue-bid-rond före RKC, minor-fit-RKC (inverterad minor), NT-slam med Gerber 4♣ över 1NT, Exclusion efter splinter.

## Kortspel (punkt 29)

- Flik **"Spela kort"** – `src/pages/Play.tsx`
- Spelmotor `play.ts` (följa färg, trumf, stickvinnare), bottar `play-bot.ts` (tumregler), kontrakt `play-contract.ts`.
- Spelaren sitter Syd (avslut + motspel).
- Spec: `docs/kortspel.md`

## Visuell omgång (Synrey-känsla)

- Grönt filtbord med riktiga spelkort (`src/components/PlayingCard.tsx`, burgundy baksida).
- Korten ihoptryckta så bara hörn-indexet syns; träkarlen prydlig (sidoträkarl staplad, Nord i grupper).
- Trumfen alltid på spelförarens högra hand sett från Syd.
- Färgordningen alternerar svart/röd (cykeln ♠ ♦ ♣ ♥ roteras med trumfen – `orderedSuits` i `Play.tsx`).

## Auktionsvyn (`src/components/AuctionView.tsx`)

- Rutnät V N Ö S med zon/sårbarhet, giv-markör, färgkodade bud (Pass/Dbl/Redbl), inramat slutkontrakt.
- Inkopplad i budträningen + Spela-fliken.
- På "Spela kort": kontraktet härleds ur en FÄRDIG auktion (`auction-contract.ts`: `dealForPlay` + `finalContract`).
- Ligger i hopfällbar panel ("Visa hur kontraktet bjöds").
- `turnsToCalls` är delad i `auction-contract.ts`.

## Markeringar & utspel (punkt 30)

- `signals.ts` – honnörsutspel, 3:e/5:e spotutspel, UDCA omvänd attityd/räkning, Lavinthal.
- `leadFromSuit` inkopplat i bottens utspel (`play-bot.ts`).
- Bot-tumreglerna förfinade: andra hand lågt, ruffar aldrig partnerns vinnare.

## DDS-facit (punkt 28)

- Egen double-dummy-solver i ren TS – `dds.ts` (inga npm-beroenden; de två testade paketen var trasiga).
- Bevisad korrekt mot ett orakel.
- "Visa facit"-knapp på Spela kort visar perfekt-spel-stick från nuvarande ställning.
- Avgränsning: JS-DDS klarar inte tunga 13-kortsgivar snabbt → facit har nodbudget, tillförlitligt en bit in i given.

## UI-funktioner i "Spela kort"

- **Två-klicks fan-ut** för att spela kort.
- **Klickbara bud + ALERT-märke** i auktionsvyn – `alerts.ts` (blått A på konstgjorda bud, klick visar betydelsen).
- **Stegbar omspelning** – `PlayReplay.tsx` (händer sorterade i färg, Väst/Öst som Fun Bridge-färgrader, träkarlen i färgkolumner; delad `src/lib/cardLayout.ts`).

## Budlådan – logiklagret (`auction-live.ts`)

Förberedelse för en LEVANDE budgivning i "Spela kort" (i stället för en
förgenererad auktion). Rent, testat (`auction-live.test.ts`, 23 tester):
- `legalCalls(history, seat)` – bridge-reglerna för tillåtna bud (högre bud,
  X mot motståndare, XX mot deras X).
- `auctionComplete(history)` – tre pass efter ett bud / fyra inledande pass.
- `contractFromCalls(history)` – slutkontrakt + spelförare ur en färdig budföljd.
- `decideCall(deal, history, seat)` – **bot-hjärnan**: spelar upp parets
  kanoniska systemlinje (`buildAuction`) bud för bud. Datorn (V/N/Ö) följer
  linjen; Syd bjuder själv. Återanvänder hela den testade budmotorn.
- **Svar på partnerns upplysningsdubbling (fix 2026-06-29):** när en motståndare
  upplysningsdubblar och svararen passar är auktionen INTE utbjuden – advancern
  (dubblarens partner) måste svara. `buildAuction` markerar nu det läget som öppet
  (förut härleddes ett felaktigt "passat ut"-kontrakt), och `decideCall` tvingar
  via `takeoutDoubleToAnswer` fram advancerns svar (`answerTakeoutDouble`: längsta
  objudna färg, 12+ = cue). Historiedriven → robust även när Syd bjuder off-book.
- **Känd gräns:** ~0,25 % av färdiga auktioner är slamlinjer (Jacoby 2NT → cue
  → 1430 RKC) där `buildAuction` lägger två bud i rad på samma plats (öppnarens
  cue hoppas över utan kontroll) → ingen laglig medurs-auktion. decideCall
  stänger dem lagligt på sista budet. Fixas när slamverktygen kopplas in i
  budlådan (se arbetslistan).

## Budlådan – UI:t (`BiddingBox.tsx` + budfas i `Play.tsx`)

"Spela kort" har nu en **levande budgivning** före kortspelet:
- `BiddingBox.tsx` – klickbar budlåda: 35 kontraktsbud (nivå 1–7 × ♣♦♥♠ NT) +
  Pass/dubbelt/redubbelt. Otillåtna bud gråas ut (`legalCalls`).
- `Play.tsx` är delad i en **fas-styrning** (`Play`: budgivning → spel) och en
  fristående **`PlayTable`** (det gröna bordet, facit, omspelning). I budfasen
  budar datorn V/N/Ö ett i taget (`decideCall`, 700 ms), Syd klickar själv. När
  `auctionComplete` slår till härleds kontraktet ur de **verkliga** buden
  (`contractFromCalls`) och spelet startar – `dealForPlay` används inte längre.
- Budfasen visar din hand öppen, de andra som baksidor, och auktionsrutnätet som
  växer fram. Passas given ut syns det och man tar en ny giv.
- Verifierad i webbläsaren: budlåda → levande auktion → 3NT av Öst → kortspel.

## Regelregister & kravstatus (FAS 1, `rules.ts`)

- **`src/lib/engine/rules.ts`** – en sanningskälla: budets `rule` → kravnivå
  (`forcing`, §2:s sex nivåer + `semi-krav`) och alert. Kravnivå för alla ~150
  regelnamn motorn producerar (facit + fullständighetstest i `rules.test.ts`).
- **`forcing`/`alert` på varje bud** (`AuctionTurn`), ifyllt centralt i
  `buildAuction`s `finish()`-chokepoint. `ruleInfo(rule)` ger {kravnivå, alert}.
- **`alerts.ts`** är nu ett tunt gränssnitt över registret (alert single-sourcad).
- **Negativ dubbling** finns i EN version (`doubles.ts`), nu för inkliv på
  valfri nivå.
- **Laglighet (punkt 3):** två olagliga-bud-buggar fixade – Ogust-placering på
  2♦, och NT mot hoppinkliv. Deterministiskt `legality.test.ts` (4000 givar,
  verifierat mot 60 000) vaktar att budlådan aldrig ger ett olagligt bud.

## Konkurrens – svararens höjningar efter inkliv (FAS 2 punkt 5+6)

- **Cue = limithöjning eller bättre** (`auction.ts` `competitiveResponderAction`):
  efter motståndarens färginkliv bjuder svararen med 3+ stöd och 10+ hp **cue i
  deras färg** (krav, `cue (limithöjning+)`), i stället för en underbjuden enkel
  höjning. Svaga händer (6–9) ger fortfarande `konkurrenshöjning`.
- **Jordan 2NT** (systembok §7.3, rad 193): efter motståndarens upplysningsdubbling
  bjuder svararen med 4+ trumf och 10+ hp **2NT = Jordan** (limithöjning med fit).
  XX används nu bara med 10+ **utan** fyrkortsfit. 2NT efter X tolkas uttryckligen
  som Jordan – **aldrig Jacoby** (vaktat i test).
- Ny regel **"Jordan 2NT"** i `rules.ts` (kravnivå inbjudan, alertas).
- Facit: `auction-competitive-raises.test.ts` (planens testmatris 1♥(X)/1♥(1♠)/
  1♥(2♣)/1♥(2♦)/1♠(2♥)). Hela sviten 440 grön.
- **Avgränsning:** öppnarens fortsättning i konkurrens (acceptera/avböja
  inbjudan) modelleras fortfarande en rond – hör till resten av FAS 2.

### Negativa dubblingar verifierade (FAS 2 punkt 7)

- Hela den vanliga sekvensmatrisen facit-låst i `negative-doubles.test.ts`.
- Alla lägen med en **objuden 4-korts högfärg** (1♣/1♦-öppning + inkliv, samt
  2-lägesinkliv) var redan korrekta → X (`negativ dubbling`).
- **Lucka lagad** (`doubles.ts` `negativeDouble`): när motståndaren klivit in i
  den **andra högfärgen** är båda objudna färgerna minorer (1♥–(1♠), 1♠–(2♥)).
  Svararen ger nu **negativ X med 4-4 i minorerna** – men bara **utan fit** för
  partnern (med 3+ stöd höjs i stället). Förut blev det pass (lucka).
- Inkopplat i levande auktion (`competitiveResponderAction` anropar `negativeDouble`).

### Stöddubbling inkopplad (FAS 2 punkt 8)

- **`supportDouble` (`doubles.ts`)** gjord positions-/nivåmedveten: tar RHO:s
  inkliv som parameter och ger X **bara** över ett färginkliv där `2` i partnerns
  högfärg fortfarande kan bjudas (standard 2/1, t.o.m. 2M). Exakt 3 stöd → X;
  4 stöd = direkt höjning, 2 = naturligt.
- **Inkopplad i `buildAuction`:** ny störningsgren `1 färg–(P)–1♥/1♠–(RHO-inkliv)
  →X`. Återanvänder den testade inklivsmotorn (`overcall` med svararens 1M som
  referens). Grenen slår till **bara** när stöd-X faktiskt gäller (öppnaren har
  exakt 3 stöd) → inga ostörda auktioner trunkeras (icke-regressivt). Öppnarens
  övriga konkurrenssvar (utan exakt 3 stöd) hör till en senare punkt.
- Facit: `doubles.test.ts` (enhet) + `auction-support-double.test.ts` (hela
  sekvensen `1♦–(P)–1♥–(1♠)–X`). Testsvit 499 grön.

### Responsiv dubbling inkopplad (FAS 2 punkt 9)

- **Inkopplad i `buildAuction`:** efter (1M)–X(LHO upplysning)–2M(svararens
  konkurrenshöjning) svarar advancern (dubblarens partner) med en **responsiv X**
  (`responsiveDouble`: 7+ hp, stöd i de objudna färgerna, ingen lång egen).
  Bara efter en enkel höjning av öppnarens färg. Facit:
  `auction-responsive-double.test.ts`. Testsvit 500 grön.

### Advancer-logik inkopplad + fit-jump (FAS 2 punkt 10)

- **`advanceOvercall` (`overcalls.ts`)** inkopplad i `buildAuction` i det ostörda
  advance-läget: öppning 1 i färg – (LHO enkelt 1-läges inkliv) – (svararen
  passar) – **advancern** (inklivarens partner) svarar: höjning, cue =
  limithöjning+, ny färg, NT eller fit-jump. Medvetet smalt (bara 1-läges inkliv +
  svararens pass) så budet garanterat är lagligt; kontesterade advance-lägen tas
  senare.
- **Fit-jump nykodad** (systembok §7.1 rad 714): 4+ stöd för partnerns färg + egen
  5+ sidofärg, inbjudande+ → HOPP i sidofärgen (visar fit + trickkälla). Hoppnivån
  räknas ur partnerns inklivsnivå (ny `overcallLevel`-param, default 1).
- Facit: `overcalls.test.ts` (fit-jump enhet) + `auction-advancer.test.ts`
  (hela sekvensen, fit-jump + cue). Testsvit 503 grön.

## Klickbara bud med betydelse (valideringsstöd)

- **Budlådan** (`BiddingBox.tsx`) är nu tvåstegs: ett klick **väljer** ett bud och
  visar dess betydelse i en infopanel, sedan bekräftar man med "Bjud". Motorns
  rekommenderade bud (för din hand i läget) markeras med en grön prick och får sin
  **äkta** förklaring (+ ALERT om konstgjort); övriga bud märks "utanför
  systemlinjen". Rekommendationen kommer från `decideCall(deal, history, 'S')`.
- **Auktionsrutnätet** (`AuctionView`): Syds egna bud bär nu `rule`/`explanation`
  (sätts i `Play.tsx` `onBid` via `decideCall`) → klickbara precis som datorns bud.
  Stämmer ditt bud med systemlinjen får det den äkta förklaringen, annars märks det
  som ett eget bud utanför systemet.
- **Känd gräns:** motorn är generativ (hand → bud), inte tolkande (bud → betydelse),
  så bara det rekommenderade budet har en äkta förklaring i ett givet läge.
  → **Delvis löst av tolkningslagret nedan** (egna bud får nu alltid en tolkning).

## Tolkande budmotor – steg 1+2 (PIVOT, `auction-interpret.ts`)

Pivot mot en TOLKANDE motor (läser den faktiska auktionen) bredvid den
generativa (hand → kanonisk rad). Mål: budgivningen ska aldrig kännas tom.

- **`src/lib/engine/auction-interpret.ts`** – rent, läsande lager.
  `interpretCall(history, index)` / `interpretLastCall(history)` ger ALLTID en
  `CallInterpretation` `{text, confidence: säker|trolig|gissning, forcing?}` –
  aldrig tom. Säker = motorns egen `rule` (via `ruleInfo`); annars heuristik ur
  buden: Michaels-cue (via position), stöd/höjning i partnerns färg (enkel/
  inbjudande/utgång), äkta cue = stark höjning, rebjuden färg, sang, ny färg/
  svagt hoppskift, samt pass/X/XX. Facit i `auction-interpret.test.ts`.
- **Inkopplat i UI (steg 2):** den gamla *"Eget bud – utanför systemlinjen (ingen
  förklaring)"* är **borttagen**. Egna/off-book-bud tolkas nu både i budlådans
  infopanel (`BiddingBox.tsx`, med säkerhets-badge) och i auktionsrutnätet
  (`Play.tsx` `onBid` → klickbart, "Eget bud. &lt;tolkning&gt;"). `BiddingBox`
  tar nu en `history`-prop. Motorns egna bud (med regel) är oförändrade.
- **Steg 3 klart (pivotens kärna):** `decideCall` (`auction-live.ts`) följer nu
  ideallinjen **bara så länge den verkliga budföljden inte motsagt den**
  (`divergedFromLine`). Bjuder Syd off-book lämnar boten linjen och svarar
  historiedrivet (`offBookResponse`) i stället för att passa:
  - **Stöd med fit** (`raiseWithFit`): 3-korts fit räcker för en **öppnad
    högfärg** (5+ lovad), annars krävs 4+. Höjningen graderas efter stödpoäng
    (`dummyPoints`): 6–10 → enkel höjning, 11–12 → inbjudande hopp, 13+ → utgång
    (4 i hf; minorutgång blåses inte ut).
  - **Utan fit** (`respondWithoutFit`): egen 4+ färg på billigaste läge (1-läget
    från 6 hp, 2-läget från 12), annars balanserad **sang** efter styrka (1NT/
    2NT/3NT), annars pass. Bara när partnern redan bjudit – inga påhittade inkliv.
  - On-book-auktioner är **bevisat oförändrade** (facit i `auction-live.test.ts`).
- **Konkurrens-fortsättning klar:** `buildAuction` modellerar bara EN
  konkurrensrond (`built.open`), så störda auktioner dog förut ut direkt. Nu
  fortsätter `decideCall` att svara historiedrivet (`offBookResponse`) även när
  linjen tagit slut men auktionen är **öppen** – både partnern och
  motståndarnas advancer konkurrerar vidare (höjer m. fit / egen färg / pass).
  Skiljt från en **färdig** linje (`open === false`), där de extra turerna bara
  är avslutande pass. Facit: partnern höjer i konkurrens, advancern höjer
  inklivet, och 200 slumpade öppna auktioner spelas ut lagligt till slut.
- **§7-inkliv i budlådan klart (`maybeOvercall` i `auction-live.ts`):**
  motståndarna *inleder* nu egen konkurrens även i rent off-book-läge. När
  auktionen gått off-book och en motståndare precis öppnat 1 i färg (och vår sida
  inte sagt något) kliver boten in på riktigt via §7-motorn (`overcall`): enkelt
  inkliv, upplysningsdubbling, Michaels, ovanlig 2NT. Medvetet smalt och
  bevisbart korrekt – bara **direkt sits** (RHO öppnade nyss). Facit:
  `auction-live.test.ts` (Väst kliver in 1♠ / X över Syds off-book 1♥; svag hand
  passar; ingen falsk balansering efter en passrunda). On-book bevisat oförändrat.
- **Avgränsning (nästa steg):** balansering (inkliv efter en passrunda) och inkliv
  över andra öppningar (1NT, svaga tvåor, hoppöppningar) återstår.

## Nästa steg (ur arbetslistan)

- **Slam-quirk**: slamlinjer (Jacoby 2NT → cue → RKC) kan ge två bud i rad på
  samma plats → ingen laglig medurs-auktion; budlådan stannar där. Fixas i
  `slam-auction.ts` (öppnaren fyller luckan lagligt). Ovanligt (~0,25 %).
- **Off-book Syd – grunden klar:** datorpartnern hänger nu med och svarar på Syds
  egna bud (stöd m. fit graderat efter styrka, annars egen färg/sang – se
  "Tolkande budmotor – steg 3" ovan). Kvar att bredda: off-book-svar i
  konkurrens och vidare ronder.
- "Framkalla slutbud"-väljare (ägarens idé, se `docs/arbetslista.md`).
- Ev. webworker för DDS-facit på utspelet.
