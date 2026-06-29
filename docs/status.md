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
förgenererad auktion). Rent, testat (`auction-live.test.ts`, 20 tester):
- `legalCalls(history, seat)` – bridge-reglerna för tillåtna bud (högre bud,
  X mot motståndare, XX mot deras X).
- `auctionComplete(history)` – tre pass efter ett bud / fyra inledande pass.
- `contractFromCalls(history)` – slutkontrakt + spelförare ur en färdig budföljd.
- `decideCall(deal, history, seat)` – **bot-hjärnan**: spelar upp parets
  kanoniska systemlinje (`buildAuction`) bud för bud. Datorn (V/N/Ö) följer
  linjen; Syd bjuder själv. Återanvänder hela den testade budmotorn.
- **Känd gräns:** ~0,25 % av färdiga auktioner är slamlinjer (Jacoby 2NT → cue
  → 1430 RKC) där `buildAuction` lägger två bud i rad på samma plats (öppnarens
  cue hoppas över utan kontroll) → ingen laglig medurs-auktion. decideCall
  stänger dem lagligt på sista budet. Fixas när slamverktygen kopplas in i
  budlådan (se arbetslistan).

## Nästa steg (ur arbetslistan)

- **Budlådans budknappar – UI-steget** (Syd klickar egna bud, turordning runt
  bordet, spelet startar ur de verkliga buden). Logiklagret ovan är klart.
- "Framkalla slutbud"-väljare (ägarens idé, se `docs/arbetslista.md`).
- Ev. webworker för DDS-facit på utspelet.
