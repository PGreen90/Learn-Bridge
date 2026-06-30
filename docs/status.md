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

## Handvärdering

- Bergens Adjust-3 i `evaluation.ts`: startpoäng, stödpoäng och Bergenpoäng.
- Visas som `15 HP (17 TP)` i `HandView`.
- TP styr öppningströskeln (`openings.ts`, färgöppning vid TP ≥ 12) och slamzon (`slam-auction.ts`).
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

## Nästa steg (ur arbetslistan)

- **Slam-quirk**: slamlinjer (Jacoby 2NT → cue → RKC) kan ge två bud i rad på
  samma plats → ingen laglig medurs-auktion; budlådan stannar där. Fixas i
  `slam-auction.ts` (öppnaren fyller luckan lagligt). Ovanligt (~0,25 %).
- **Off-book Syd**: bjuder Syd utanför systemlinjen passar datorpartnern. Tas
  senare (ägarens beslut).
- "Framkalla slutbud"-väljare (ägarens idé, se `docs/arbetslista.md`).
- Ev. webworker för DDS-facit på utspelet.
