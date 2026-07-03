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

## Värdering (FAS 4 punkt 16–18 + TP-steg A–F, ALLA klara 2026-07-03)

- **Punkt 16 – sanningskarta HP/TP/LTC:** motorn kör HP + TP (start-/stöd-/
  Bergenpoäng); **LTC finns inte**. Beslut: inför INTE LTC (TP täcker det;
  konsistent med den låsta TP-principen). Karta + beslut i `docs/handvardering.md`.
- **Punkt 17 – stödvärdering verifierad:** de tre komponenterna isolerade och
  låsta (`evaluation.test.ts`): fitpoäng (`bergenPoints.extraTrump`),
  distributionsvärde (`sideSuits`), kortfärger (`shortSuit`/`shortness`). Bergens
  asymmetri bekräftad (stödhanden värderar korthet, långtrumf-handen längd).
- **Punkt 18 – slamvärdering:** `wastedHonorsOppositeShortness` (`evaluation.ts`)
  nedvärderar K−2/D−2/kn−1 mot partnerns visade kortfärg (esset behålls).
  Inkopplat i `slamInvestigation`: visar öppnaren singel (Jacoby-kortfärg) dras
  svararens döda honnörer av innan slamzon-porten (bevisat: rått 36 → slam;
  justerat 32 → ingen strandad slam).
- **Steg C-2 – minorhöjningar på TP:** lyfts på längd/sidofärg (`bergenPoints
  {notrump}`), aldrig korthet (minorfit siktar 3NT). `responses.ts respondToMinor`.
- **Steg C-3 – sang-accepter på TP:** 3NT-accepter på startpoäng (5-korts färg/
  löpande honnörer lyfter). `rebids.ts`.
- **Steg D – TP-nudge för sangöppning (komplett):** bra 14 (`p === 14 && ingen
  5-korts färg`) → 1NT (`openings.ts`). 5-korts minor → öppna minorn (bevarar
  1-läges major-svar), 5-korts major → öppna 1M. **Sårbarheten sätter tröskeln:**
  ej sårbar → startpoäng ≥ 15 (aggressiv), sårbar → ≥ 16 (passiv). `isVulnerable`
  (`openings.ts`) trådad genom `buildAuction` + `Spela.tsx` (lokal dubblett borttagen).
  Facit i `openings.test.ts` (startp. 15 nudgas bara ej sårbar; startp. 16 alltid).
- **Steg E – reverse/hoppskift på TP (klar 2026-07-03):** styrkan i
  `max(hp, startpoäng)` (`pointsWithFloor(..., null, 'starting')` – ny kind).
  Reverse ≥ 16, hoppskift ≥ 19 (utgångskrav). **Hoppskift-facket efter
  1-lägessvar byggt** (fanns inte – 19-poängare rebjöd "2♣ minimum") + svararens
  fortsättning (placera kontraktet, aldrig pass) + pass-vakt efter reverse.
  `rebids.ts`, `responder-rebids.ts`, `rules.ts` (`hoppskift` = utgångskrav).
- **Steg F – lättöppning i 3:e/4:e hand (klar 2026-07-03):**
  `classifyOpening(hand, vulnerable, seatOrder)`. 3:e hand: 1M med 10–11 hp
  (sårbar 11) + bra 5+ högfärg (≥2 topphonnörer A/K/Q); aldrig minor/1NT lätt;
  Drury skyddar. 4:e hand: regeln om 15 (hp + spader ≥ 15 → öppna, annars passa
  ut; ingen spärr under golvet). Positionen trådad i `buildAuction` (`auction.ts`).

## NT-systemet (FAS 5 KLAR 2026-07-01, punkt 19–25, testsvit 587)

- **Punkt 19 Stayman** (`responses-nt.ts` + `responder-rebids.ts`): lagad
  inbjudnings-5-4-lucka (2♣–2♦ med 5-4 hf + 8–9 → naturlig 2♥/2♠, ej 2NT) +
  **garbage Stayman** (svag exakt 4-4 hf + kort klöver → 2♣, passar svaret).
- **Punkt 20 Smolen**: verifierad oförändrat rätt (5-4 GF → hopp i kortare hf).
- **Punkt 21 Jacoby-transfer**: kärnan verifierad; **5-5-högfärgsschemat** byggt –
  transferriktningen kodar styrkan (svag→2♣ garbage-route, inbj→2♦ sedan 2♠,
  GF→2♥ sedan 3♥). Tvåfärgs-GF via 3♣/3♦ (minor) flaggad SENARE (ej begärt).
- **Punkt 22 Texas**: verifierad (6-korts hf 10–15 → 4♦/4♥, öppnaren fullföljer).
- **Punkt 24 2NT-systemet**: turerna 1–3 verifierade rätt (GF-schema: 3♣ Stayman,
  3♦/3♥ transfer, 3♠ minorfråga, 4♦/4♥ Texas, 3NT/4NT/6NT; öppnarens fullföljande).
  **Svararens turn 4 byggd** (`responderRebidIn2NTAuction`): minorfit→utgång,
  ingen fit→3NT, 5-4 hf efter 3♦→Smolen över 2NT, svag transfer→pass. Inkopplad i
  `responderSecondBid`. 2NT-auktioner löser sig nu helt på systemlinjen som 1NT.
- **Punkt 25 3NT-öppningen**: verifierad (svararen placerar pass/4NT kvant/6NT;
  öppnaren tar ställning till kvantitativ 4NT, max 27).
- Ny hjälpare `suitHcp` (`hand.ts`) för färgstyrka. Systembeslut i §4.3.
- **Punkt 23 Minor Suit Stayman KLAR:** svararens turn 4 byggd i
  `responderRebidIn1NTAuction` (case `Minor Suit Stayman`). Insikt: MSS-handen har
  alltid 4+ i BÅDA minorerna (5-4+), så en fit hittas garanterat när öppnaren visar
  en minor (3♣/3♦). Ägarbeslut 2026-07-01: **3NT som standard**; höj minorn
  (`4♣/4♦`, ny regel `Minor Suit Stayman: höjning` = slamintresse) **bara med ~16+
  hp** (paret ≈ 33). Ingen fit (öppnarens 2NT) → 3NT; öppnarens 3NT (max) → pass.
  Fortsatt cue/RKC på minorfiten + öppnarens 3♥/3♠-stopp/4♣-4♦-max = **FAS 8**.
  Facit i `responder-rebids.test.ts`. **Hela FAS 5 NT-systemet är därmed klart.**

## Minorsystem (FAS 6 KLAR 2026-07-01, testsvit 612)

- **Punkt 26 Minor-regeln** verifierad + facit-låst (`openings.test.ts`): 3-3 → 1♣,
  4-4 → 1♦, 5-5 → 1♦, olika längd → längsta minorn (`openMinor` i `openings.ts`).
- **Punkt 27 Inverterade minorer**: svararens första bud (`respondToMinor`) och
  öppnarens återbud (`openerRebidAfterInvertedMinor`) fanns; **svararens
  fortsättning byggd** (`responderRebidAfterInvertedMinor` i `responder-rebids.ts`) –
  auktionen dog förut vid öppnarens återbud. Svararen placerar nu mot 3NT: efter
  öppnarens 2NT (12–14) → 3NT med 11+, efter stopp-visning → 3NT när övriga
  sidofärger är täckta (annars 5m, flaggad), efter 3m minimum → 3NT bara med 13+
  och båda hf stoppade, efter 3NT → pass. End-to-end `1♦–2♦–2NT–3NT` bygger.
  Slam på minorfit (cue/RKC) = FAS 8.
- **Punkt 28 Svaga hoppskift** verifierade (2♥/2♠ över 1m; 1♥–2♠). **Ägarbeslut
  2026-07-01:** INGET svagt hoppskift i den andra minorn (1♦–3♣) – systembokens
  prosa-exempel gäller inte; en svag 6-korts klöver över 1♦ bjuder 1NT (följer
  detaljtabellen). Facit-låst i `responses.test.ts`.

## Svaga öppningar (FAS 7 KLAR 2026-07-01, testsvit 612)

- **Punkt 29 Svaga tvåor + Punkt 30 Ogust** verifierade (redan väl täckta):
  `respondToWeakTwo`, `openerRebidAfterOgust`, `openerRebidAfterNewSuit`,
  `responderPlaceAfterOgust` (`responses-weak2.ts`).
- **Punkt 31 Spärröppningar**: `respondToPreempt` + `openerRebidAfterPreemptNewSuit`
  (`responses-preempt.ts`). **Öppnarens feature-visning byggd** (saknades): maximum
  (~9+ hp) utan stöd visar en yttre A/K i en sidofärg upp-the-line (ny regel
  `rebid: feature`, systembok §4.6). **Ägarbeslut 2026-07-01:** svag stödhand
  PRESSAR inte till utgång över en spärr – höjer bara med utgångsvärden (nuvarande
  beteende bekräftat + facit-låst).
- **Punkt 32 Regel 2-3-4 (ägarbeslut 2026-07-01, öppningsstruktur):** kvalitetsgrind
  på spärröppningen i `openings.ts` (`topHonorCount`), modulerad av sårbarhet
  (`isVulnerable` tråas redan in via `buildAuction`). Topphonnörer = A/K/Q i den
  långa färgen. **3-läget** (7-korts): ej sårbar ≥ 1, sårbar ≥ 2. **4-läget**
  (8-korts): ej sårbar valfri, sårbar ≥ 1. Skräpfärg spärrar aldrig. Faller handen
  igenom grinden → ingen spärr (pass). **12 HP-golvet är orört** – detta rör bara
  svaga spärrhänder. Facit i `openings.test.ts`.

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
- Inkopplade i växande auktioner: Jacoby 2NT-fit (1430 RKC vid slamzon ≥ 33), Sjöbergs 5NT i RKC-grenen, cue-bid-rond före RKC, minor-fit-RKC (inverterad minor), NT-slam med Gerber 4♣ över **1NT och 2NT** (`gerberInvestigation`/`gerber2NTInvestigation` i `nt-slam.ts`), Exclusion efter splinter.
- **Gerber över 2NT (FAS 8, 2026-07-01):** en balanserad slamsäker svarare (13+ hp mittemot 20–21 ≈ 33+) frågar ess med 4♣ i stället för att blint blåsa 6NT (kan nu stanna i 4NT om två ess saknas, driva storslam via 5♣-kungfrågan ≈37+). Delad sekvensbyggare med 1NT-Gerber. Facit i `nt-slam.test.ts`.
- **Exclusion när renons rankar över trumf (FAS 8, 2026-07-01):** `exclusionInvestigation` (`slam-auction.ts`) hanterar nu även hjärter trumf + spaderrenons (5♠ Exclusion, lagligt över 3NT-relät). Öppnarens högsta stegsvar (steg 4) landar på exakt 6♥; vill svararen bara ha lillslam passar hon (i stället för att olagligt bjuda om 6♥). Nivåbailen borttagen. Facit i `slam-auction.test.ts`. **FAS 8 (Slamsystem) därmed helt klar (testsvit 630).**

## Bot-hjärnan – Monte-Carlo-DDS (FAS 11 Steg 1–3 KLAR, testsvit 697)

Färdplan i `docs/bot-hjarna.md`. Bottarna spelar nu "läsa bordet"-spel utan
tjuvkik: de resonerar över *troliga* händer, aldrig de verkliga dolda korten.

- **Steg 1 (`play-bot.ts`, `card-counting.ts`):** ärlig stickföring – cash:a säkra
  vinnare (inget högre kort ospelat), kryp aldrig under; sidofärgsvinnare först när
  trumfen är räknad (`unseenTrumpCount`). Kända renonser via `shownVoids`.
- **Steg 2 (`hand-model.ts`):** `buildHandModel(calls, {voids})` tolkar auktionen
  till HP-spann + färglängd-spann + renonser per plats (konservativa golv).
- **Steg 3a (`monte-carlo.ts` `sampleLayouts`):** delar ut de osedda korten till de
  två dolda händerna så varje giv stämmer med modellen; ursprungslängd/HP räknas som
  redan spelade + tilldelade kort. Renons-tvingad utdelning skär bort kasserade
  försök; omöjliga krav → tom lista (fallback).
- **Steg 3b (`monte-carlo.ts` `chooseCardMonteCarlo`):** DDS ärligt på sampeln →
  röstar fram kortet med bäst genomsnitt (max stick åt spelföraren, min som
  motspelare). Nodbudget → `null` = fallback.
- **Steg 3c (`play-bot.ts` `botCardSmart`, inkopplad i `Play.tsx`):** MC i slutspelet
  (≤7 kort kvar), annars tumregler (öppningsutspel / tung giv / ett-lagligt-kort).
  Bevisat i test: 6-korts-slutspel där tumregeln tar 2 stick, MC tar facit 3.
- **Steg 3d – signalavkodning (pt 50, `signal-decode.ts`):** motspelaren läser
  botens ÖPPNINGSUTSPEL och skärper hand-modellen. Längd (leder ur längsta → ≥4)
  + honnör (bara när utspelaren bevisligen är högst i färgen → touchérande honnör).
  Hand-modellen fick per-färg-HP-spann (`suitHcp`) som samplaren upprätthåller.
  Bara bottars utspel avkodas (ingen tjuvkik på människan). Inkopplat i `botCardSmart`.
- **"Varför?"-knapp (klar):** `botCardReasoned`/`botCardSmartReasoned` (`play-bot.ts`)
  ger samma kort + en klartextsmotivering per drag. Inkopplat i `Play.tsx` – efter
  varje botdrag visas "Öst spelade 3♣. Varför?" som fälls ut. Verifierad i webbläsaren.
- **Tänj MC-fönstret + webworker (klar):** MC flyttad till `mc-worker.ts` (av
  huvudtråden → ingen frys, "räknar …"-indikator, timeout-fallback). Adaptiv
  `mcBudget` (färre kort = fler sampel; 8 kort = bantad ~3,7 s). Fönstret tänjt
  7 → 8 kort. `usesMonteCarlo` väljer worker vs inline. Verifierad i webbläsaren.
- **FAS 11-eposet därmed helt klart** (Steg 1–3 + pt 47–50 + "Varför?" + webworker).

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

## Felrapportering i Spela kort (2026-07-02, testsvit 1481)

- **Rapportdialogen** (`src/components/FelrapportDialog.tsx`): "Kändes något
  fel? Rapportera given" nås från resultatdialogen, omspelningsvyn och
  utpassad giv i `Play.tsx`. Kategori (5 val) + fritext → knappen öppnar en
  **förifylld GitHub-issue** (etiketten `felrapport`, skapad i repot) med HELA
  given: händerna, budgivningen, kontraktet och alla spelade stick. Webbläsaren
  kan inte pusha till git — Issues är kanalen hem.
- **Rapportformatet** (`src/lib/felrapport.ts`, test-låst i
  `felrapport.test.ts`): läsbar sammanfattning + maskinläsbart
  ```felrapport```-block. Händerna i `parseHand`-format (`formatHand` med
  garanterad rundresa), stick-rader med utspelare + vinnare → given kan alltid
  återskapas EXAKT som test.
- **Kommandot `/felrapporter`** (`.claude/commands/felrapporter.md`): läser
  öppna felrapport-issues via `gh`, återskapar given som test (FACIT FÖRE
  FIX), lagar felet, stänger issuen med förklaring. Formatdokumentationen bor
  i kommandofilen och ändras ihop med `felrapport.test.ts`.
- Verifierat i webbläsaren: båda flödena (färdigspelad + utpassad giv) ger
  korrekt URL till `PGreen90/Learn-Bridge/issues/new` med alla 13 stick.
- **Kvar (SENARE):** PAT-i-localStorage-varianten (skicka utan att öppna GitHub).

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
