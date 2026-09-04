# ⚪ SENARE & 🅿️ PARKERAT — full beskrivning

> **Vad detta är:** idéer och kända luckor som medvetet INTE byggs nu.
> CLAUDE.md listar bara rubrikerna i projektkartan — hela motiveringen bor här
> (flyttat 2026-07-25 för att hålla kartan kort).
>
> **SENARE** = oordnat, hämtas upp till NÄST en i taget när ägaren väljer.
> **PARKERAT** = medvetet avstängt, ska inte vägas in i beslut alls.

## ⚪ SENARE

### Svep: grundläggande partnerskapsplikter i konkurrens (ägarbeslut 2026-09-02) — PAUSAT 2026-09-04
**Läge 2026-09-04:** K1, K3, K2, K5 KLARA & LIVE (mergepunkter `842809b` +
`e7a3931`). Svepet PAUSADES när motorbytet blev NU (`docs/motorbyte-plan.md`,
grind 0): resterna lagas inte i det gamla lagret utan blir facit-fall i
motorbytets etapp 4, familj 4 (fria bud/höjningar/lagen om totala stick):
- frö 20262632 — svararens egen 8-korts färg ska vinna över en 3-korts
  minorfit (`1♦–(1♠)–2♥–P–3♦–P–5♦` → 4♥).
- motståndarnas fortsättning efter våra nya höjningar (ny K-check i proben).
Båda beskrivna i `docs/bevaka.md`. Riggen `pliktsvep.probe.test.ts` körs vidare
som skyddsnät efter varje familj i bytet.

Bakgrund: felrapporterna #55 och #56 visade att två av bridgens mest
grundläggande regler saknades HELT i den störda budgivningen — svararens fria
bud i en 5+ högfärg (motorn dubblade negativt med sju spader) och advancerns
preferens när inklivaren visat två färger (Nord passade 4♦ med fem spader).
Ägarens reaktion: "om det här saknas har vi större problem än jag trodde".
Termen "off-book" är bara motorns ord för att den förberäknade linjen lämnats
(`auction.ts` → detektorkedjan i `auction-live.ts`); den säger inget om
systemet. Hålen var alltså riktiga hål, inte "ovanliga lägen".

**Uppdraget:** gå igenom partnerskapsplikterna i störd budgivning SYSTEMATISKT
och lås varje plikt med en egen detektor + facit, i stället för att vänta på
nästa felrapport. Kandidater (mät med `auktionsdump.probe.test.ts` /
systemrevisorns frön före bygge, en regel i taget):
- **Preferens överallt:** öppnaren visade två färger i konkurrens → svararen
  väljer (speglingen av #56 på öppnarsidan); dubblarens två färger.
- **Fritt bud på 2-läget utan fit** (`docs/bevaka.md` 2026-09-02): öppnarens
  fortsättning går genom den generella logiken (probe: 1♦–(1♠)–2♥–P–3♦–P–5♦
  på 26 hp där 3NT/4♥ låg närmare) — bygg öppnarens rebud-stege efter ett
  fritt bud utan fit (sang med stopp, egen 6+, ny färg, preferens).
- **Höjning på visad längd:** varje bud som lovar 5+/6+ ska ge fit på 3/2 kort
  i `fitLengthNeeded` — inventera vilka löften som saknas (hoppinkliv har det,
  fritt högfärgsbud fick det 2026-09-02; kvar: t.ex. inklivarens rebjudna färg,
  svag tvåa + höjning i konkurrens).
- **Spärrhöjning på tio trumf:** advancern med 5-korts stöd + minimum över
  motståndarnas höjning (1♥–1♠–3♥–?: Nord passade med ♠K9873, lagen säger 4♠).
- **Krav som glöms:** svep `competitionForce`/`honorForce` mot en lista över
  rondkrav i konkurrens (§5.5) — och vaktera att en HÖJNING aldrig läses som
  krav (reverse-buggen 2026-09-02 var en sådan).
Facit-mönster: `auction-fritt-bud-svar.test.ts`, `auction-advancer-preferens.test.ts`.

### 2♣-öppningen — bredare översyn (steg 1 KLAR 2026-08-31, resten kvar)
**Ursprung:** Grant Baze "6-5, come alive"-artikeln (11 hp 6-5 tvingades till
2♣-utgångskrav av den platta 8½-spelsticksregeln); ägaren breddade 2026-08-24
fyndet till hela öppningen.

**Steg 1 (spelstick-tröskeln) KLAR & DEPLOYAD 2026-08-31 — ägarbeslut "Regel B":**
distributionell 2♣ (hp<22) kräver **9 spelstick (högfärg)/9½ (lågfärg) OCH ≥3
spelfasta stick**, ELLER valven **8½ stick OCH ≥4 spelfasta stick**. Källor:
K. Walker/bridgebum/Lawrence; mätning 20 000 givar (frekvens 1,6 % → 1,1 % ≈
verklighetens ~1 %) i `tvaklover-oversyn.probe.test.ts` (gate:ad `TVAKLOVER=1`).
Ägarens fixpunkter: frö 20261050 (21 hp, tre ess) = 2♣ · frö 20260220 (13 hp 6-5)
= 1♠. Facit: `openings-2c-substans.test.ts`; regel i budsystem.md §4.4 + §9.

**Kvar när jobbet hämtas upp igen:**
- **Kravnivån efter 2♣ (fråga 2):** vår 2♣ är utgångskrav — rätt även för den
  distributionella varianten, eller ska den vara stark/enrondskrav?
- **Balanserad vs distributionell i fortsättningen (fråga 3):** två handtyper
  under samma öppning — 2♦-relä, svararens steg, 2NT-återbudet. Mätkandidat
  (Lawrence-artikeln 2026-08-27): 25–27→3NT-öppningen kan begrava en 4-4-
  högfärgsfit utan stopp i obudna färgen — mät innan dom.
- **Samspel med 6-5-luckan** i [docs/bevaka.md](bevaka.md): om en formstark 6-5
  varken blir en bra 2♣ *eller* kan visa 6:e kortet efter en 1-öppning, var landar
  den bäst?

**Status:** budstruktur-ändringar → exempelhänder + ägargodkännande per steg
(låst regel). Facit-först. Spellärdom ur Lawrence-artikeln (dummy reversal) hör
till speldiagnosens låda, inte hit.

### Hål D steg 2 — cue-frontend i konkurrenslagret (PARKERAD 2026-08-07)
Steg 1 (kontroll-komplett 4NT, budsystem.md §6.10) landade 2026-08-07: kaptenen
med äkta extra + förstarundskontroll i ALLA sidofärger frågar 4NT direkt.
**Steg 2** skulle täcka de kontroll-OFULLSTÄNDIGA händerna — kaptenen har äkta
extra men saknar kontroll i en sidofärg och behöver en **cue-rond i konkurrens**
för att hitta partnerns kontroll innan 4NT. Bedömdes redan 2026-08-05 som stort
och regressionsbenäget; efter facitstädningen (20260947 → splinterspåret,
20261274 stale) är den kvarvarande ärliga kärnan **~1–2 givar** (exempel:
**20261272** — Nord ♠A752 ♥AKJ65 ♦A2 ♣96, 16 hp + tre ess, spaderfit efter
3♣-hoppinkliv + negativ dubbling, saknar ♣-kontroll och stannar i 4♠ fast 6♠
står). Ägarbeslut 2026-08-07: för liten vinst för risken — parkerad tills
mätspåret pekar hit igen. Återupptas den: facit-först med 20261272, och tänk på
att cue i konkurrens läcker utspelsinfo (samma princip som §6.10).

### Lebensohl — nästa lager (kärnan KLAR 2026-07-30)
**KLART (Lager 1, §7.5):** Lebensohl efter vårt 1NT är inkopplad och live —
skulden "byggd men ej inkopplad" är stängd (regelsvepet gick 0 → hela
konversationen, `lebensohl.ts` bortlyft ur `MEDVETET_EJ_INKOPPLAD`). Steg noll
(motståndarens naturliga inkliv över 1NT) + svararens kärna + öppnarens 3♣-relä.
Facit: `lebensohl.test.ts` + `auction-lebensohl-1nt.test.ts`.

**KVAR (senare lager, avgränsade bort ur Lager 1 — spelas ej än):**
- **Takeout-dubblingen** i läget (ägarbeslut 2026-07-30: X = takeout) — kräver att
  öppnaren svarar dubblingen.
- **"Slow shows"** för stopp i jämna händer (2NT→3NT visar stopp, direkt 3NT
  förnekar) + **cue-bud som Stayman** efter en fyrkorts högfärg — kräver att
  öppnaren svarar cuet.
- **Lebensohl mot konstgjorda inkliv** (vår DONT / Landy / Multi-Landy) —
  bridgebums sista avsnitt; överlappar dagens `answerNTInterference`.
- **Lebensohl efter partnerns takeout av en svag tvåa** (det gamla läge (a)) —
  advancern svarar i dag nivåmedvetet via `answerTakeoutDouble`, inte Lebensohl;
  §7.7 är märkt. Kräver egen omgång (det generiska svaret duger tills vidare).

### Felrapport #36 — större kort på mobil — STÄNGD 2026-07-30 ("löst på annat sätt")
Ägaren har stora fingrar och ville ha större tryckytor. **Utfall:** vi mätte att
13 kort à 48 px fyller en 375 px-rad nästan helt (~336 px) — man får inte plats med
~44 px tryckyta per kort utan två rader (avvisat) eller bredare skärm. Ägaren tyckte
storleken vid bordet känns bra på max; den verkliga smärtan var att kortraden var
mer ihoptryckt i budgivningen och expanderade i spelet. **Åtgärd (merge `347d2c3`):**
`HandFan` ritar nu samma färggrupperade kortrad som spelbordets `SouthFan` (delat
`REST_OVERLAP`) → likadant i alla vyer. Issue #36 stängd. **Säkra zoner KLAR
2026-07-30:** topp/botten fanns redan i `Layout.tsx`, vänster/höger tillagt
(`max(1rem, env(safe-area-inset-left/right))`); verifieras på riktig iPhone.
**Mobilsvep KLART 2026-07-30:** alla sidor mobil-rena; breda budsystem-tabeller
fick en scroll-toningshint. **→ Fas 0 b KLAR, hela Fas 0 klar.**

### Fler budträningsgivar + "Vill du träna något speciellt?"-dropdown (2026-07-06)
Ägarens 4-punktslista punkt 1. Data i `src/data/exercises/*.json` +
`EXERCISES_BY_THEME` i `bidding.ts`; facit bör knytas till motorns egna svar så det
aldrig lär ut fel. (Punkt 2+4 = klara; punkt 3 "sondera budsystemet på djupet" =
gjord 2026-07-07 via budsystem-revisionen + F1.)

### B13 — öppnarens återbud efter inverterad minorhöjning (2026-07-07)
Dagens återbud är grova (stopp-visning kräver 4+ kort i färgen → en 17 hp med
6-korts minor visas som "minimum 3m") → ärliga slam-misser. Se
`docs/budsystem-revision.md` B13.

### Spelmotor-kvalitet: försvar (felrapport #34) — KLART 2026-07-30
**#32 (spelföraren etablerar lång färg) KLART 2026-07-29; #34 (tredje hand högt)
KLART 2026-07-30** – båda byggda, testade & live. Se `docs/historik.md` och
`docs/bot-hjarna.md`.

**#34 – tredje hand högt (KLART):** försvaret duckade billigt i trick 1 (Nord ♥5
under partnerns utspel). Ny gren `thirdHandHonor` i `play-bot.ts`: är jag
försvarare i **sang**, ledde partnern och står bara spelföraren bakom mig, lägger
jag min lägsta honnör och tvingar fram hans. Facit (DDS-låst):
`play-bot-third-hand.test.ts`. Netto neutralt (374→374, 40 seedade givar,
`ESTABLISH=1`) – mönstret sällsynt i slumpgivar men den rapporterade given
DDS-bevisat lagad. **Kvar i spåret (⚪ SENARE):** tredje hand högt även i
**trumfkontrakt** (avgränsades bort efter en uppmätt ruff-regression) samt
tredje-hand-nyanser bortom lägsta honnören (t.ex. ducka med tenass mot bordets
honnör).

### ~~TP till §7-inkliven~~ (BYGGD 2026-08-07 via F4)
Kärnan stängd: golven för enkelt inkliv + upplysnings-X läser `max(hp,
startpoäng)` och advancerns fit-trösklar läser stödpoäng — additivt ovanpå
"låna en kung", med kvalitetsvakt (lyft kräver 3+ av topp-5 i färgen) och
spärrvakt (boken §7.1, facit `overcall-tp.test.ts`). Kvar som bevakning, inte
byggpunkt: **DONT och försvaret mot svaga tvåor/spärrar**
(`dont.ts`/`defense-conventional.ts`) samt **X-svararens trösklar**
(`answerTakeoutDouble`) räknar fortfarande rå HP — byggs på om spel visar att
formstarka händer säljs där (`docs/bevaka.md`).

### ~~Advancer-rabatt efter balansering~~ (BYGGD 2026-08-07 via F3)
Det generella fallet stängt: rabatten −3 gäller nu alla balanserade öppningar
(höjningar + X-svar, boken §7.1). Kvar som bevakning, inte byggpunkt:
balanseringens NT-svar och nya färger (`respondWithoutFit`) räknar ännu inte
rabatten — byggs på om spel visar att de driver för högt (`docs/bevaka.md`).

### ~~17+ stark enfärgshand EFTER två bjudna färger~~ (BYGGD 2026-08-08 via F6)
Linjen (`buildAuction`) modellerar nu den starka dubblingen efter två bjudna
1-lägesfärger; handbedömningen delas med budlådan (`takeoutOfResponse`, §7.3).
Kvar som bevakning, inte byggpunkt: **den vanliga 4-4-dubblingen är MEDVETET
fortsatt live-only** — att träda in den i linjen ändrar en stor andel ostörda
linjer (Budvisningen, träningsgivar) och byggs bara på eget ägarbeslut om spel
visar att bottarna säljer sådana givar (`docs/bevaka.md`).

### Den starka dubblaren säljer given i ROND 2 (2026-07-28, funnen i Mätning #19)
"17+ säljer aldrig given" gäller i dag bara **första** ronden (§7.1, felrapport
#40). I rond 2 kräver `ownStrongDoubleRebid` (auction-live.ts) en egen **5+
objuden** färg för det starka återbudet — en jämn 17–19-poängare har ingen, och
då finns ingen väg vidare alls. Frö 20260952: `1♦–X–P–3♣–P–P–P`, Väst dubblar med
19 hp, Öst hoppar 3♣, Väst **passar** — ÖV kunde ta 7NT (par 1520). Kostade
+330 p i M19 och är den enskilda post som gjorde kontrollmätningen minus.
**Vad som saknas:** ett återbud för den starka dubblaren utan egen färg — cue i
deras färg (krav) eller sang med stopp, graderat efter vad partnerns svar visade
(hoppet 3♣ visade ju 9–11, alltså ~28+ ihop). Kräver ägarbeslut om hur högt den
jämna 19-poängaren ska driva. Reproducera med
`$env:DUMP='20260952'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts`.

### Auto-facit på hela given i webworker (R3 fynd #3 del 2)
Visa spelförarens double-dummy-optimum automatiskt i resultatdialogen. Byggdes
synkront men backades — helgivs-DDS från utspelet är för tung (probe: 79/80 kontrakt
gav upp efter ~1,7 s, spränger 2M-nodbudgeten → skulle frysa + nästan alltid "för
tung"). Kräver bakgrundstråd (mc-worker) med möjliga långa väntetider, eller
snabbare lösare. Del 1 (budhint "Motorn hade valt X") är redan gjord + live.

### ~~Kanoniska linjen passar ut ostörda tvåfärgsinkliv~~ (var redan lagad — verifierad 2026-08-08 via F6)
Lagades i roten redan 2026-07-04 (felrapport #14: `advanceTwoSuiter` sitter i
linjens konkurrensrond i `auction.ts`) — den här punkten och revisionens C14
stod kvar som stale. Sedan 2026-08-08 låst med linjebyggstest
(`auction-stark-x-tva-farger.test.ts`).

### Övrigt
- **Svårighetsnivåer på bottarna** (ägarbeslut: SENARE, ej del av FAS 11 MED).
- **Bot-hjärnans B2 (cash-ordning) + Steg C (rätta räkningen)** — villkorade: byggs
  bara om en facit-giv bevisar behovet (`docs/bot-hjarna.md`).
- **Motspelarnas bredare försvarsinferens:** honnörs-blottningsvakten är KLAR
  (2026-07-05, `defenderGuardDiscard`) och **markeringar** (lägg + läs) landade
  2026-07-29 (§8.5). KVAR i signalspåret: **avkoda räkning (längdparitet)** — kräver
  paritetsstöd i Monte-Carlo-samplaren (`monte-carlo.ts`) — och **avkoda uppmuntran**
  (tvetydig: dam+ eller kort färg). Samt bredare: skvis-försvar och längre
  inferens om partnerns hand.

### FACELIFTEN / den visuella omgörningen (VÄCKT 2026-07-29 — Fas 1 i konkurrensplanen)
Parkerad 2026-07-20, **väckt av ägaren 2026-07-29** som del av konkurrensspåret
(`docs/konkurrensplan.md` Fas 1 — första intrycket görs bara en gång, före
lanseringen av "Dagens givar"). **PÅBÖRJAD 2026-07-31, en yta i taget** (ägarbeslut):
**startsidan (yta 1) + spelbordet (yta 2) KLARA** — yta 1: samlad hero, tvåfärgat
skimmer-ordmärke, frameless guldspader, roterande guldram; yta 2: Synrey-modellen
(full-bleed duk, träkarl upptill, tomma sidor, stora kort, tryck-färg-visar-bara-den,
"Avsluta spel"). Full logg för båda i `docs/konkurrensplan.md` Fas 1. Materialet som
väntar (nästa ytor, t.ex. sidhuvudet på övriga sidor): Claudes
"Klubbrummet"-mockup (privat artifact
`claude.ai/code/artifact/5b9f5e2a-fe71-4dbc-aaeb-188a5a2376b9`), ägarens Claude
Design-utforskning med de färdiga promptarna, och ombyggnaden av appen efter
godkänd design. Låsta ramar: emerald, svarta spader, guldserifen. Tokens +
komponentstrukturen (UI-overhaulen) är redo, så bygget är billigt.

### Tävlingsöversikten — mobil-layout (för hög) (2026-08-11, ägaren)
**DELVIS ÅTGÄRDAT 2026-08-11 (ägarstyrt):** ägaren ringade in och bad ta bort
progress-stapeln, 12-rutnätet och "🎉 Alla 12 spelade"-kortet — nu borttagna i
ALLA lägen ur `DagensTavling.tsx` (rutnätet var inte klickbart, så inget tappas;
travellern nås via "Dina givar"-raderna). Sidan går rubrik → knapp (bara om ospelad
giv finns) → DinStällning → Dina givar → Ställningen. Dessutom en **uppdatera-knapp
(⟳)** fast i nederkant höger (`fixed`, säkra zoner) som hämtar om topplistan
(placering/MP%/andras resultat + cross-device-framsteg via `uppdateraNonce` →
`fetchTopplista`-effekten) utan full sidladdning. Facit uppdaterat i
`DagensTavling.test.tsx` + `DagensTavling-flode.test.tsx`. **RUNDA 2 (2026-08-11):**
toppen komprimerad till EN rad (titel `text-xl` vänster + kompakt klock-pill höger;
förklaringstexten borttagen; `Nedrakning` är nu en pill med klockikon + tooltip), och
"N poängsatta givar" i `DinStällning` → **"N/12 givar"** (kortare + visar framsteget;
totalen kommer via ny `total`-prop från `tavling.storlek`). **KVAR (om ägaren vill):**
kort topplista (topp 3 + din rad), ev. "Dina givar" → in i rutnätet med MP%. Låsta
ramar: emerald, svarta spader, guldserifen, MP bara.

*(Ursprunglig notering:)* Efter UI-polishens steg 1–5 staplar `DagensTavling`-översikten mycket vertikalt:
rubrik + nedräkningsklocka + progress + 12-rutnätet + huvudknapp + "Din ställning"-
kort + "Dina givar"-tabell + "Ställningen"-topplista + hemlänk. På telefon (höjd­
budget ~812 px) blir det lång scroll och inget ryms ovanför vecket. Ägaren
(2026-08-11): "vi behöver se över hela UI en gång till" — men som ett **eget,
fokuserat pass**, inte inklämt i data-fixarna. Idéer att väga: flikar
(Spela / Ställning / Dina givar), hopfällbara sektioner, kompaktare kort, flytta
topplistan bakom en knapp. Låsta ramar som vanligt: emerald, svarta spader,
guldserifen, MP bara. Mät höjdbudgeten och svara med uppmätta px (facelift-mönstret
[[facelift-mockup-rejected]]). Hör ihop med FACELIFTEN ovan.

### Spela tävlingsgiv igen — övningsläge (2026-08-11, ägaren) — KLAR & LIVE 2026-08-12
**Byggd, verifierad i dev, live (main a24a369).** Knappen **"🔄 Spela given igen —
övning"** i `GivDetalj` öppnar givens `deal` i `Play` i övningsläge via en `övning`-
flagga på `TavlingSpel`; dess `onResultat` är en no-op → *inget skickas in*
(`submitTavlingGiv`) och *framsteget rörs inte* (`saveTavlingFramsteg`/`framstegRef`),
så MP% står kvar överallt. Facit `DagensTavling-ovning.test.tsx`. Märkning "räknas
inte" i budfas (badge), kortspel (pille) och resultat ("Spela igen" + "← Tillbaka").
Bugg lagad på vägen: `startSameGame` gav en NY dagsgiv åt en fröfri giv (tävlings-
övning utan `dailyNr`) → nu `gameFromDeal(g.deal)`, regressionstest
`useGame-omspel.test.tsx`. Detalj: [[spela-given-igen-ovningslage]].

### Rondgenomgång för tävlingsgiv — botarnas per-kort-motivering (2026-08-11)
Steg 5:s genomgång (`byggGranskning` → `RondRapportView`) återskapar given ur
sparad auktion + kort, men **utan** botarnas "varför la Öst ♥9?"-rader — de finns
bara i stunden boten spelar live. Att återskapa dem = spela om med reason-motorn
(tyngre). Bygg om ägaren vill ha dem även i efterhandsgenomgången.

### Engelska som andra språk (2026-07-29, ägarbeslut — Fas 5 i konkurrensplanen)
Ägaren vill ha appen på två språk: svenska först, engelska senare. Stort eget
spår — hela gränssnittet plus budsystem-boken (appens största text) ska
översättas. Tas när den svenska basen bär (`docs/konkurrensplan.md` Fas 5).
Fram till dess: skriv ny UI-text så den är lätt att lyfta ut (hela meningar,
inga hopklistrade fragment).

### ~~`auctionFacts`-lagret~~ (R2 steg 2) — UPPTAGET i motorbytet 2026-09-04
Idén från F2-bygget (ett tunt lager som räknar auktionsfakta EN gång per beslut)
är nu **etapp 2 i `docs/motorbyte-plan.md`** och byggs inte längre separat.

## 🅿️ PARKERAT

### Övrigt parkerat
- **DDS-facit på tunga fulla givar:** känd gräns (nodbudget). Ej fel.
- **Off-book §7 bredd** (inkliv över 1NT/svaga tvåor/spärrar; balansering BYGGD
  2026-07-03 — kvar här: "låna en kung"-lättnaden i generell mening).
- **"Framkalla slutbud"-väljaren** (ägaridé) + **webworker för DDS-facit**.

### Mathe mot stark konstgjord 1♣ (ägarbeslut 2026-07-04)
Funktionen `defendStrongClub` (`defense-conventional.ts`) är färdig + enhetstestad
men medvetet EJ inkopplad: i vårt 2/1-system är 1♣ en NATURLIG öppning (den starka
handen öppnar 2♣) → en stark konstgjord 1♣ kan aldrig dyka upp, så Mathe har inget
läge att utlösas i. Mot naturlig 1♣ räcker vanliga inkliv/upplysningsdubbling
(redan inkopplat via `maybeOvercall`). **Plockas upp först den dag vi lägger till
FLER budsystem** (t.ex. stark klöver/Precision) — då kopplas den in på samma sätt
som DONT/svaga-två-försvaret (detektor i `buildAuction`). Se
`docs/audit/r1-budsystem.md` (Fynd #2, delbit 3).
