# Claim-ombygget — frågan i stället för klippet (ägarbeslut 2026-09-19)

**Varför:** användarna upplevde att datorn claimar för hastigt — "det bara
blinkar till". Roten var inte botens tempo utan ett hårt klipp: auto-claimen
löste ut i samma bildruta som fjärde kortet landade, släckte sticksvepet och
vände upp alla fyra händer på en gång.

## Ägarens beslut

- **Frågan:** när boten eller auto-claimen vill claima visas
  "[Väderstreck] gör anspråk på resten (N stick)" med **OK** / **Spela klart**.
  Är det din egen sida som spelför: "Du tar resten (N stick) — claima?".
- **Endast frågeläge.** Inget "Direkt"-läge (struket av ägaren; byggs bara om
  ägaren ber om det). Av/på-knappen "Auto Claim" i ⋮-menyn är kvar som förut.
- **Ingen timer svarar åt spelaren** (samma princip som claim-revealen,
  ägarbeslut 2026-07-28).

## Flödet (Spela kort + tävlingen — `usePlayTable.ts`)

1. Claimen blir **aktuell** (`claimDue`): nytt stick ska börja och spelförar-
   sidan kan omöjligt förlora fler stick (`autoClaimAvailable` — kriteriet är
   oförändrat strängt). Bottarna står stilla från och med nu.
2. Sista sticket får sitt **svep**. Är claimen aktuell väntar sticket aldrig på
   ett tryck (ingen stickväntan) — bot-pausen med ringen, sedan svep.
3. **Andetaget** `claimBeat` (tempo.ts), sedan **frågan** (`claimOffer`) — en
   icke-modal ruta på filten, korten synliga, OK har fokus (Enter/mellanslag).
   Kortklick spelar inget medan frågan väntar.
4. **OK** → claim-revealen: de dolda händerna läggs upp **en i taget**
   (`revealStep`; spelföraren först, sedan medsols) → "Visa resultatet →" på
   samma plats som OK-knappen.
5. **Spela klart** → `claimDeclined`: spelet går vidare, ingen ny fråga i given.
   Kriteriet är "omöjligt att förlora", så resultatet blir detsamma — tävlingens
   validering påverkas inte.
6. **Ett enda stick kvar claimas aldrig** — korten är tvingade, sticket spelas ut
   (`claim.ts` + serverns `bord-motor.ts`).

Manuell claim ("Claim tricks") och "Ge upp" är oförändrade, men deras reveal
lägger också upp händerna en i taget.

## Vänner-bordet (`BordSpel.tsx` / `useBordSpel.ts`)

Samma icke-modala ruta och ordval i stället för den modala dialogen (som täckte
korten man skulle bedöma). Frågan kommer efter sticksvepet + `claimBeat`
(presentationskön); ett stick som väntar på mitt tryck släpps till bot-pausen när
nästa händelse är `claim-forslag`. Kortklick är spärrade medan frågan väntar.
Serverns modell (DD-dom, svar per stol, ett nej stänger claimen) är orörd —
detaljerna står i `docs/bord-plan.md`.

## Facit

`src/pages/play/claimfraga.test.tsx` (flödet) · `claimreveal.test.tsx` ·
`syd-trakarl.test.tsx` (texten "Du tar resten") · `claim.test.ts` och
`bord-motor.test.ts` (ett stick kvar) · `BordSpel.test.tsx` (bordets text).

## Medvetet utanför (SENARE — `docs/senare.md`)

- **Delclaim "X stick"** — kräver en regel för NÄR en delclaim får lösa ut
  (DD-värdet är känt i varje läge) och en text som säger vilka stick som skänks.
- **Visa varför** — de vinnande korten glöder / en rad "bara höga trumf kvar".
- **Snabbläge ("Direkt")** — struket av ägaren 2026-09-19; byggs på begäran.
