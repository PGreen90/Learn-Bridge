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
bara bordets deltagare) är latenssocker; **hjärtslaget (`HJARTSLAG_MS` i
`useBordSpel.ts`) är auktoritativt** och gör dessutom hela närvarojobbet.
Klientens drag skickas med `basSeq` (senast sedda sekvensnummer) — stämmer det
inte med loggens huvud svarar servern 409 och klienten hämtar ikapp.

**Presentationsköns takt** (fix 2026-08-18, träkarlens eftersläpning): den
passiva stolen (träkarlen, vars kort spelföraren spelar) fick korten uppspelade
i långsam bot-takt, ett i taget, och halkade efter stick för stick när
spelföraren — en människa — spelade snabbare än takten. Boten: andras kort
avtäcks nu i en snabb utjämningstakt (`bordKort` i `tempo.ts`, inte bot-
"tänketid") — tömningen är mycket snabbare än en människa hinner producera kort,
så vyn ligger aldrig efter och det känns nära realtid; stick-pausen (sweepHold)
ger ändå beatet där man ser vem som vann. Beslutet bor i `avtackningsPaus`
(`useBordSpel.ts`). **Ingen "snabbspola ikapp"-logik:** en sådan variant
kollapsade en HEL bot-given (träkarl mot tre bottar → servern spelar hela given
i ett svep) till en blink; den snabba takten räcker och ritar upp given i lugn
takt precis som spelet mot datorn.

**"Hoppa till resultat"** (ägaridé 2026-08-18): för den som inte vill se hela
bot-given ritas upp — är du ENDA anslutna människan och sitter som träkarl (bot
som spelförare → bara bottar spelar, given ligger redan färdig i loggen) visas
en knapp som flyttar din läskursor direkt till resultatet (`hoppaTillResultat`/
`harOspeladLogg` i `useBordSpel.ts`, knapp i `BordSpel.tsx`). Rent vy-hopp —
inget resultat ändras, ingen annan påverkas. Medvetet BARA när du inget har att
spela: är du motspelare vore "hoppa" = ge upp/concede, vilket är en egen
SENARE-fråga (bottarna skulle spela klart ditt försvar).

**Bottarna = tävlingens bottar (ägarbeslut 2026-09-24, "Spela med vänner ska
spela bridge exakt likadant som Dagens tävling").** Servern bjuder med samma
funktion som tävlingen och nattgranskningen (`botBud`: beslutstabellen, och
resonemangslagret i standardläget där tabellen saknar regel — DD-oraklet
`budOrakel()` i `claim-dd.ts` ovanpå den redan buntade `bridge-dds`), i
`drivFram`, facit-linjen (läge 1) och läge 2:s autobud/givval. Kortspelet kör
KLIENTENS Monte-Carlo-profil (`SERVER_SMART = {}` → botCardSmarts standard:
8-kortsfönster, mcBudget) — den strypta serverprofilen är borta. Serverless-
taket sköts av tidsbudgeten per anrop (`budgetMs`, 5 s): är den slut STANNAR
`drivFram` före nästa botbeslut (aldrig billigare tumregeldrag) och nästa
hjärtslag (> 2 s stiltje) fortsätter — ett påbörjat tänkande bud körs alltid
klart, därför `maxDuration: 60` för `api/bord.js` i `vercel.json` (genrepet
mätte tänketid per läge: median 3,7 s, 90 % 11 s, längsta 24,6 s — `GENREP=1`,
`revisor-output/tavling-genrep.txt`). Klienten visar "[Stol] tänker …" i
budfasen och pulserande ljuskägla i spelet när en bot är i tur och loggen står
still. Facit: `bord-motor.test.ts` ("tidsbudgeten" + "tänkande bottar vid
bordet": samma kort som klientvägen beslut för beslut, samma bud som `botBud`,
styckade anrop = ett svep). Kvar att bevaka: väntetiden vid bordet när två
lambdor (draget + hjärtslaget) råkar tänka samma läge samtidigt — förloraren
får 409 på skrivningen, korrekt men dubbelt CPU.

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
- **SENARE-listan etapp 1 (2026-09-14) — rondgenomgången per giv:** knappen
  "Genomgång av given →" i giv-klar-vyn (alla vid bordet, medan ägaren väntar
  med nästa giv) öppnar samma stegvisa vy som tävlingens "Så spelade X given"
  (`PlayReplay`, vinröd duk): auktionen med systemiska förklaringar ur buden
  (aldrig ur någons hand) och sedan stick för stick, i bordets verkliga stolar
  med namnen från stolarna. Allt ur loggen — `byggBordGenomgang`
  (`bord-genomgang.ts`: `klar.hands` = hela given, `verkligaStick` ur
  korthändelserna, `annoteraSystemiskt`); ingen serverändring. Stängs själv
  när given byts. Inga botmotiveringar (serverns resonemang lämnar aldrig
  servern). Facit `bord-genomgang.test.ts` + röktest `BordSpel.test.tsx`.
- **SENARE-listan etapp 2 (2026-09-14) — DD-jämförelsen ("hur bra mot
  facit"):** servern räknar hela DD-tabellen (spelförare × strain) + par med
  `bridge-dds` när given blir klar och bakar in `dd` i giv-klar-händelsens data
  (`api-src/_lib/dd-facit.ts`, anropad vid alla tre bokföringsvägarna i
  `bord.ts`: giv-start med bara bottar, hjärtslagets framdrivning, draget).
  Ingen schemaändring. WASM:en ligger inbäddad i paketets JS så esbuild buntar
  den rakt in i api/bord.js (spike 2026-09-14: +569 kB, laddning ~12 ms per
  varm instans, tabell 5–150 ms). Lösarfel stoppar aldrig given — giv-klar
  bokförs då utan `dd` och klienten döljer raden. Klienten: den delade rena
  läsaren `src/lib/engine/dd-facit.ts` (uppslag i lösarens tabell, jämförelsen,
  par-texten) och `DdFacitRad` i giv-klar-vyn + genomgången: "Facit (perfekt
  spel): X stick · spelföraren tog Y (±diff)" och "Par: 4♠ NS (NS +420)".
  Facit `api-src/_lib/dd-facit.test.ts`, `src/lib/engine/dd-facit.test.ts`,
  röktest `BordSpel.test.tsx`. Kandidat till senare: per-kort-DD i
  genomgången (AnalysePlayPBN — 52 lösningar per giv, dyrare).
- **SENARE-listan etapp 3 (2026-09-14) — claimen vid bordet.** Ägarbeslut:
  "när DD vill claima ska den göra det, men människan ska få möjlighet att
  spela klart handen". Ingen manuell claim och inget "ge upp" (medvetet
  utanför — DD-claimen täcker behovet; kan läggas till senare). Flödet:
  vid varje STICKSTART frågar servern lösaren om spelförarsidan tar alla
  återstående stick mot bästa motspel från exakt den ställningen
  (`api-src/_lib/claim-dd.ts`: SolveBoardPBN på de återstående korten, ms;
  injiceras synkront i `drivFram` som `claimKontroll`). Ja → händelsen
  `claim-forslag` {total, stol} och spelet står. Alla AKTIVA MÄNNISKOR UTOM
  TRÄKARLEN svarar med draget `claim-svar` {ok} (dialogen "OK, bokför given" /
  "Spela klart" i BordSpel; de andra ser en väntanrad). Alla OK → `giv-klar`
  med claimens total som spelförarstick och `claim` i datat (notis i giv-klar-
  vyn; genomgången visar bara de spelade sticken). Ett nej → spelet fortsätter
  och ingen ny claim föreslås i given. Ingen som behöver svara (bara bottar,
  eller människan är träkarl) → bokförs i samma anrop. Obesvarad claim efter
  AUTO_GODKANN_MS (60 s) → hjärtslaget skriver auto-OK för de som inte svarat
  (bordet får inte fastna — samma regel som paus/lämna). Under en väntande
  claim avvisar servern kortdrag ("Claimen väntar på svar"). Lösarfel → inga
  claims, spelet opåverkat. Facit `claim-dd.test.ts` (riktiga lösaren),
  claim-blocket i `bord-motor.test.ts` (stubbad dom: förslag, paus, svar,
  bokföring, nej-vägen, direktbokföring), röktest i `BordSpel.test.tsx`.
  **Claim-ombygget 2026-09-19 (`docs/claim-plan.md`):** dialogen är nu en
  icke-modal ruta på filten ("[Väderstreck] gör anspråk på resten (N stick)" ·
  OK / Spela klart) som kommer efter sticksvepet + `claimBeat`; kortklick är
  spärrade medan den väntar, och ett enda stick kvar claimas aldrig
  (`remainingTricks(st) > 1` i `drivFram`). Servermodellen i övrigt orörd.
- **"Borden = tävlingen" (2026-09-24, ägarbeslut: "lämna poängräkningen,
  åtgärda allt annat").** (1) Bottarna: se "Bottarna = tävlingens bottar" under
  Arkitekturen. (2) Grafiken: spelfasen ritas genom den DELADE ramen
  `src/pages/play/SpelbordRam.tsx` (zoner, marginaler, hörnknappar, svarta
  listen, Syd-listen — en sanningskälla för spelbordet OCH vänner-bordet; tonen
  'vanner' styr bara färgerna på chromet). Bordets topprad, "Din tur"-raden och
  namnraden på duken är borta: ⋮ och ⓘ i hörnet som spelbordet, kontrakt/stick/
  giv/ställning i listen, "Hoppa till resultat" där Facit-knappen sitter, vem
  som sitter var i ⋮-menyn (budfasen) och ⓘ-overlayen (spelfasen). Budfasen
  fick budstödet (motorns rekommendation ur EGEN hand + full/minimal
  förklaring, samma sparade val som spelbordet), "[Stol] tänker …"-brickan
  (`TankerBricka`, delad), "◀ Alla färger" och kortflygningen (`useCardFlight`
  + `FlightLayer`; kroken `onKort` i `useBordSpel` mäter källkortet synkront
  före avtäckningen). Röktest `BordSpel.test.tsx`. **Lämnat med flit:**
  poängräkningen (ägarbeslut), kortförklaringen och Facit-under-spel (båda
  skulle avslöja dolda händer för en mänsklig motståndare vid bordet) samt
  Ångra / manuell claim / Ge upp (kräver regler för samtycke vid ett bord med
  flera människor — ägarfrågor, se Medvetet utanför nedan).

## Medvetet utanför v1 (kandidater till SENARE)

- ~~**Claim vid bordet**~~ — BYGGD 2026-09-14 som DD-claim med mänskligt
  veto (SENARE-listan etapp 3, se delleveranserna). Kvar som kandidater:
  manuell claim, "ge upp" (concede) och ångra.
- ~~**DD-jämförelsen**~~ — BYGGD 2026-09-14 (SENARE-listan etapp 2, se
  delleveranserna ovan).
- ~~**Rondgenomgång per giv**~~ — BYGGD 2026-09-14 (SENARE-listan etapp 1,
  se delleveranserna ovan).
- **Kortförklaringar under spel** ("Varför spelade boten så?") — serverns
  botresonemang skickas inte till klienten; en bots motivering ("höll upp kungen")
  skulle avslöja dess hand för människorna vid bordet. Samma skäl stoppar
  spelbordets Facit-knapp under spel (DD på alla fyra händer).
- **Ångra / manuell claim / Ge upp** (spelbordets ⋮-meny, 2026-09-24): vid ett
  bord med flera människor kräver de samtyckesregler — vem får ångra när
  motståndaren sett kortet, vilka svarar på en människas claim (DD för bottarna,
  OK/spela klart för människorna — infrastrukturen från DD-claimen finns),
  behöver partnern godkänna "ge upp"? Ägarfrågor innan bygge.
- **Kortflygningen och klockor/chatt/kibitzers** — polish respektive
  grindbeslut.
- **Lokal JWT-verifiering (JWKS)** på heta dragvägen — auth cachas i varm
  instans i v1; eskalationsväg om latensen mäts besvärande.
- **Supabase Pro-grinden** (25 USD/mån) — ägarbeslut när lasten kräver det
  (kapacitetstaket är ~40 samtidiga bord på gratisnivån).
