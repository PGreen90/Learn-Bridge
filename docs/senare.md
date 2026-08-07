# ⚪ SENARE & 🅿️ PARKERAT — full beskrivning

> **Vad detta är:** idéer och kända luckor som medvetet INTE byggs nu.
> CLAUDE.md listar bara rubrikerna i projektkartan — hela motiveringen bor här
> (flyttat 2026-07-25 för att hålla kartan kort).
>
> **SENARE** = oordnat, hämtas upp till NÄST en i taget när ägaren väljer.
> **PARKERAT** = medvetet avstängt, ska inte vägas in i beslut alls.

## ⚪ SENARE

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

### 17+ stark enfärgshand EFTER två bjudna färger (takeout, 2026-07-05)
En 17+ enfärgshand som borde upplysningsdubbla när motståndarna redan bjudit två
färger (t.ex. 1♦–P–1♥) gör det INTE — där följer `decideCall` en färdig
buildAuction-linje som passar handen, så live-hanteraren (`maybeTakeoutOfResponse`,
som bara gör 4-4) når aldrig fram. Att tvinga den starka dubblingen där kräver att
den generativa linjen i `auction.ts` (`buildAuction`) modellerar inklivet — ett
grundläggande ingrepp. Öppningsfallet + 4-4-fallet är klara & live (felrapport #23,
§7.3).

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

### Kanoniska linjen passar ut ostörda tvåfärgsinkliv (felrapport #7, 2026-07-03)
`buildAuction` (`auction.ts`) kan stänga en linje som 1♠–2NT–P–P–P — advancern ska
aldrig passa ostört (ägarbeslut FAS 10). Live-budlådan är lagad; luckan finns bara i
förbyggda linjer (Budvisningen m.m.). Trä in `advanceTwoSuiter` i linjens
konkurrensrond.

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

### Engelska som andra språk (2026-07-29, ägarbeslut — Fas 5 i konkurrensplanen)
Ägaren vill ha appen på två språk: svenska först, engelska senare. Stort eget
spår — hela gränssnittet plus budsystem-boken (appens största text) ska
översättas. Tas när den svenska basen bär (`docs/konkurrensplan.md` Fas 5).
Fram till dess: skriv ny UI-text så den är lätt att lyfta ut (hela meningar,
inga hopklistrade fragment).

### `auctionFacts`-lagret (R2 steg 2, noterat 2026-08-07 vid F2-bygget)
F2 gjorde detektorkedjan i `decideCall` datadriven (`FORCED_DETECTORS`/
`CONTESTED_DETECTORS` med maskinvaktade före-krav). R2:s andra steg är kvar
som idé: ett tunt lager som räknar ut de fakta detektorerna delar (öppnare/
svarare, senaste konventionella budet, trumföverenskommelse, "äger vi handen?")
EN gång per beslut, så detektorerna slutar re-skanna `history` var för sig.
Byggs först när en konkret detektor behöver det — inte spekulativt.

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
