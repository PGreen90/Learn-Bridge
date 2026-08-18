# Realtidsborden — "Spela med vänner" (Beslut B etapp 4)

> **Status: BYGGD & LIVE i fyra delleveranser (4A–4D), 2026-08-17/18.**
> Levande dokument för bordens arkitektur och beslut. Masterplanens ram:
> `docs/beslut-b-plan.md` (etapp 4). Ägarbesluten togs i planeringssessionen
> 2026-08-17; varje delleverans har demolats och godkänts av ägaren.

## Ägarbesluten (2026-08-17)

1. **Serverdomare med dolda händer per stol.** Servern validerar varje bud/kort
   mot händelseloggen, spelar botdragen och skickar bara den egna handen till
   varje klient. Träkarlen avslöjas som händelse efter utspelet; alla händer
   först vid giv-klar. Klienten ser aldrig ospelade dolda kort (= Nivå 2 för
   borden).
2. **Konto krävs alltid** för spelformen (anonym gäst AVFÖRD vid grinden).
   Visningsnamnet syns vid stolen ("Patrik (Syd)").
3. **Öppen bordslista + privat-val** — privata bord nås bara via
   inbjudningskoden/länken (`#/bord/KOD`).
4. **Poäng: totalpoäng NS mot ÖV** över bordets givar. DD-jämförelse ("hur bra
   mot facit") är en beslutad SENARE-påbyggnad — giv-klar-händelsen bär redan
   alla händer + hela spelet, så den kräver ingen schemaändring.
5. **Tre spelformer:** endast budgivning (facit-genomgång mot motorns
   systemlinje) · endast spelföring (motorn bjuder, människorna turas om att
   spelföra) · full bridge.
6. **Paus/lämna:** bot tar stolen; ägaren godkänner begäranden (auto efter
   60 s); frånkoppling ~45 s → bot automatiskt, återtag automatiskt vid nästa
   hjärtslag. En frigjord stol på ett publikt bord kan tas av en ny människa
   mitt i partiet.
7. **Ägarbyte:** ägaren lämnar/borta > 60 s → värdskapet till människan som
   suttit längst; inga människor kvar → bordet avslutas. **Ägaren styr också
   tempot:** bara hen startar spelet och nästa giv.
8. **Bot-reservation:** ägaren kan låsa en ledig stol som bot i väntrummet
   (kan öppnas igen).
9. **Vinröd duk** för hela vänner-ytan (`tone="vanner"` i `Felt.tsx`) — gröna
   klubbduken orörd.
10. **Tak:** max ett aktivt bord per ägare (unikt partial-index) + globalt
    mjukt tak (`MAX_AKTIVA_BORD` i `bord-grund.ts`). Kapacitetskalkylen: gratis-
    nivåerna bär hundratals bordskvällar/månad; taket lyfts när verkligheten
    bevisat lasten.
11. **Minimal härdning inbakad:** anropskvoter på bordens endpoints
    (`api_kvot` + `kvot_okning`-RPC:n i Postgres, felöppen med flit).
12. **Inte i v1** (grindbeslut): klockor, chatt, kibitzers.

## Arkitekturen

**Sanningen** är `table_events` — en append-only händelselogg per bord med
sekvensnummer; primärnyckeln `(table_id, seq)` är kapplöpningsvakten. Servern
(EN Vercel-funktion `api-src/bord.ts` med `?h=`-router — Hobby-planens
funktionstak + tunga motorbuntar) validerar varje mänskligt drag mot en
projektion av loggen och spelar i samma anrop alla botdrag fram till nästa
människas tur (`api-src/_lib/bord-motor.ts`). Ingen klient driver bottar.

**Synken:** Supabase Realtime (Postgres Changes på `table_events`, RLS släpper
bara bordets deltagare) är latenssocker; **hjärtslaget var 5:e sekund är
auktoritativt** och gör dessutom hela närvarojobbet. Klientens drag skickas med
`basSeq` (senast sedda sekvensnummer) — stämmer det inte med loggens huvud
svarar servern 409 och klienten hämtar ikapp.

**Klienten är en projektor** (`src/pages/bord/bord-projektion.ts`): händelser →
läge, med den **visuella vridningen** (du sitter alltid Syd — rotationen är
enbart rendering; motorns värld är de verkliga stolarna). `useBordSpel.ts`
sköter synken och **presentationskön**: serverns batchade botsvar visas i
bordets tempo, egna drag optimistiskt direkt. Spelvyn (`BordSpel.tsx`)
återanvänder spelbordets presentationskomponenter och kortregler (dolda händer
visas inte alls; fasta xl-kort).

**Givarna** härleds ur bordets hemliga frö (HMAC — `bordGiv`/`bordPlaySeed` i
`bord-motor.ts`); fröet når aldrig klienten. Läge 2:s rotation (spelföraren →
människan på tur) bakas in i giv-start-händelsen (`underIndex` + `shift`) så
varje senare anrop återskapar exakt samma deal (`dealUrGivStart`).

**Närvarodomaren** (`api-src/_lib/bord-narvaro.ts`, ren klockinjicerad logik):
frånvaro 45 s → bot · obesvarade begäranden 60 s → auto-godkänn · ägaren borta
60 s → ägarbyte. Hjärtslaget verkställer domsluten och driver bottarna när
loggen stått still (> 2 s).

## Händelsetyperna i loggen

`bord-startat` · `giv-start` (bricka/giv/zon; läge 2: + underIndex/shift) ·
`bud` (`{bid}` — ALDRIG förklaringar, de skulle läcka handen via konsolen;
läge 2:s autobud märks `auto`) · `kort` · `trakarl` (hela träkarlshanden — nu
offentlig) · `facit` (läge 1: reveal + motorns systemlinje) · `giv-klar`
(reveal + omräknad poäng + ställning) · `stol` (satte-sig/bytte/lamnade/
bot-tar-over/aterta/bot-reserverad/stol-oppnad) · `paus-begaran`/`paus-svar` ·
`lamna-begaran`/`lamna-svar` · `agarbyte` · `bord-klar` · `bord-slut`.
**Ingen händelse innehåller ospelade dolda händer.**

## Databasen

Migrationerna `0007_bord.sql` (tables/table_seats/table_events/api_kvot + RLS +
Realtime-publicering) och `0008_bord_botstol.sql` (bot_reserverad). Klienternas
ENDA direktåtkomst är SELECT på det egna bordets `table_events` (Realtime-
prenumerationen); allt annat går via serverfunktionen med service-nyckeln.
Städning: den dagliga cronen (`generera-dagens-givar.ts`) raderar bord utan
aktivitet på ett dygn + gamla kvotfönster; `?h=skapa` stänger opportunistiskt
bord som stått stilla > 2 h innan det globala taket räknas.

## Delleveranserna (alla live)

- **4A** — schema + lobby (`SpelaMedVanner.tsx`) + väntrum (`Bord.tsx`) +
  vinröda duken + kvoterna.
- **4B** — det server-drivna spelet: `bord-motor.ts`, start/drag,
  sekvensvakten, dolda händer, bot-reservationen, den visuella vridningen,
  presentationskön. Demofixar efter ägarens rundor: optimistiskt drag +
  parallelliserad dragväg (latensen) · reveal av alla 52 kort på bordet ·
  ägarens Nästa giv-knapp · HCP-brickan · spelbordets kortregler · ⋮-menyn ·
  ⓘ-overlayn (auktion + förra sticket + utspel) · ljuden · piltangenterna ·
  felrapporten i ALLA faser (även vanliga spelbordets bud-/spelfas fick den).
- **4C** — närvaron: paus/lämna med ägargodkännande, bot-övertag vid
  frånkoppling med auto-återtag, ägarbyte, inhopp på frigjord stol,
  domar-vakten mot drag från pausad stol.
- **4D** — läge 1 (facit-genomgången) + läge 2 (spelförar-rotationen +
  autobuden i snabb takt) + cron-städningen + dokumenten.

## Medvetet utanför v1 (kandidater till SENARE)

- **Claim/concede/ångra vid bordet** — kräver motpartsgodkännande; design­fråga.
- **DD-jämförelsen** ("hur bra spelade vi mot facit") — ägarbeslut: vidare-
  utveckling; datat finns redan i loggen.
- **Rondgenomgång per giv** — datat finns (logg + reveal).
- **Kortförklaringar under spel** ("Varför spelade boten så?") — serverns
  botresonemang skickas inte till klienten.
- **Kortflygningen och klockor/chatt/kibitzers** — polish respektive
  grindbeslut.
- **Lokal JWT-verifiering (JWKS)** på heta dragvägen — auth cachas i varm
  instans i v1; eskalationsväg om latensen mäts besvärande.
- **Supabase Pro-grinden** (25 USD/mån) — ägarbeslut när lasten kräver det
  (kapacitetstaket är ~40 samtidiga bord på gratisnivån).
