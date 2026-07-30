# ⚪ SENARE & 🅿️ PARKERAT — full beskrivning

> **Vad detta är:** idéer och kända luckor som medvetet INTE byggs nu.
> CLAUDE.md listar bara rubrikerna i projektkartan — hela motiveringen bor här
> (flyttat 2026-07-25 för att hålla kartan kort).
>
> **SENARE** = oordnat, hämtas upp till NÄST en i taget när ägaren väljer.
> **PARKERAT** = medvetet avstängt, ska inte vägas in i beslut alls.

## ⚪ SENARE

### Koppla in Lebensohl i den levande budgivningen (2026-07-25)
`lebensohl.ts` är färdigbyggd och enhetstestad, men **ingen produktionsfil
importerar den** — regelsvepet (3 000 bjudna givar) gav 0 Lebensohl-bud, medan
Ogust gav 29 och Drury 12. Boken §7.5 beskriver alltså ett verktyg bordet inte
kan; §7.5 och `docs/bevaka.md` är märkta tills det är löst. Jobbet: koppla in
modulen i `auction-live.ts` (och/eller `auction.ts`) för de två lägena — efter
partnerns upplysningsdubbling av en svag tvåa, och när motståndaren stör vårt
1NT på 2-läget — facit-test först, sedan svep + mätning med samma frö för att se
att konkurrensposterna inte växer. Ta bort raden ur `MEDVETET_EJ_INKOPPLAD` i
`src/docs-vakt.test.ts` när det är gjort (vakten kräver det).

### Felrapport #36 — större kort på mobil (2026-07-07)
Ägaren har stora fingrar och vill ha större tryckytor för korten i Spela kort på
mobilen. Ren UI-justering (kortstorlek/tryckyta i `cardLayout.ts`/`Felt.tsx`) —
hanteras när budgivningsspåret tillåter, eller ihop med faceliften. Issuen hålls
öppen tills fixad.

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

### TP till §7-inkliven (2026-07-05, ägarbeslut vid "låna en kung")
§7-lagret (`overcall`, `advanceOvercall`, DONT, försvar mot svaga tvåor) räknar
fortfarande **rå HP** — TP (form/fördelning) har aldrig nått dit. Att låta
balanserings- OCH direkt-inkliv räkna TP är en riktig förbättring (en formstark 8:a
kliver in), men **additiv** ovanpå "låna en kung" (som är sits-spaken), inte en
ersättare. Eget test-låst steg (som TP-stegen A–F).

### Advancer-rabatt efter balansering (2026-07-05)
Partnern som SVARAR en balansering vet ännu inte att balanseraren kan vara en kung
lättare → kan övervärdera tillbaka och driva för högt. En symmetrisk "räkna en kung
mindre när du svarar en balansering" saknas. (Delvis byggd för svaga tvåor i etapp 3
fix 5a; det generella fallet återstår.) Plockas upp om en giv visar att paret
överbjuder.

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
lanseringen av "Dagens givar"). Materialet som väntar: Claudes
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
