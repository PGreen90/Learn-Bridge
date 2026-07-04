# R1 — Budsystemets korrekthet & testtäckning

> Revisionssteg R1 (se `AUDIT_PROMPTS.md`). Gren `audit/r1-budsystem`.
> Bygger vidare på `docs/sanningskarta.md` (FAS 0) och `docs/budsystem.md` –
> letar det de **inte** redan fångar. Genomförd 2026-07-04.
> Baslinje: **1626 tester gröna** (92 filer, `npm test`, 20 s).

## Så här ligger det till (för ägaren)

Kärnan är solid. Öppning → svar → återbud → slamverktyg följer systemboken
troget, och 1626 tester går igenom. Men **den störda budgivningen (när
motståndarna är med och bråkar) är fortfarande appens svaga punkt**, precis som
FAS 0 sa – och den har inte krympt trots allt FAS-arbete. Jag hittade dessutom
**en konkret budbugg** som FAS 0 inte fångade: i ett vanligt konkurrensläge
(t.ex. 1♥ av oss, motståndaren säger 1♠, och partnern har en jämn 8–9-poängare)
höjer datorn till **2NT när den borde säga 1NT** – ett rejält överbud, och det
finns inget test som vaktar den rutan. Inget av det här är en krasch, och inget
rör systemboken i sig. Men konkurrensbudgivningen bör vara nästa stora satsning,
och NT-buggen kan lagas i en liten, säker fix (facit först).

## Fynd i korthet

| # | Fynd | Prioritet | Lagat nu? |
|---|------|-----------|-----------|
| 1 | Konkurrens-NT överbjuds: 1♥–(1♠)–**2NT** i stället för naturligt 1NT (fel nivåberäkning) | **HÖG** | **JA** (commit `b17c968`, facit först) |
| 2 | §7-konkurrens fortfarande till stor del EJ inkopplad (Lebensohl/DONT/Mathe/Multi/spärr-försvar når aldrig en levande auktion; ingen konkurrens efter 1NT/2♣/2NT/svaga/spärr) | **HÖG** | Nej – stort bygge, ägarstyrt (se Åtgärdslogg) |
| 3 | Off-book-lagret läser ALLA partnerfärger som naturliga → konstgjorda bud (Jacoby-kortfärg, Bergen, Drury, cue) kan misstolkas när Syd viker av från linjen | **MEDIUM** (→ CONFIRMED) | **JA** (commit `132403d`, Jacoby-2NT-fit) |
| 4 | Blinda testfläckar: konkurrens-NT-grenarna (`NT med stopp`) helt otestade; de "färdiga" §7-konventionerna enhetstestas men har noll integrationstäckning (för att de aldrig nås) | **MEDIUM** | **JA** (commits `b17c968`+`132403d`+`b9a40c4`) |
| 5 | Odefinierade fortsättningar: `answerTakeoutDouble` antar 1-lägesöppning (cue `2♥` blir olagligt mot en dubblad svag tvåa) – nåbart när Syd dubblar en svag tvåa | **LÅG→MEDIUM** | **JA** (commit `eeb0fbf`) |

## Åtgärdslogg (2026-07-04)

Ägaren valde att laga alla fynd, en i taget, facit först. Status:
- **#1 lagat** (`b17c968`): billigaste NT över ett färginkliv = inklivets nivå.
- **#3 lagat** (`132403d`, uppgraderad PLAUSIBEL→CONFIRMED): en Jacoby-2NT-fit
  sätter öppnarens högfärg som trumf inför en off-book essfråga (`jacobyFitTrump`).
- **#4 lagat** (`b9a40c4`): #1/#3 gav aktiva tester för två av tre fläckar; den
  tredje (oanropade §7-konventioner) fick karakteriseringstester som flippar när
  #2 byggs.
- **#5 lagat** (`eeb0fbf`): `answerTakeoutDouble` är nivåmedveten.
- **#2 pågår** – det stora konkurrensbygget, ägarstyrt (ägaren valde "bygg hela
  #2 nu, delbit för delbit"), en delbit i taget med exempelhänder + ja.
  - **Delbit 1 KLAR** (`+ DONT`): DONT mot deras 1NT inkopplad (direkt golv
    8 hp / balansering 6 hp; advancer-relä + X-rättelse). 1635 gröna.
  - **Delbit 2 KLAR** (`+ takeout/Lebensohl mot svaga/spärr`): `defendWeakTwo`/
    `defendPreempt` inkopplade i `buildAuction` på samma två ställen som DONT
    (direkt + balansering). Ägargolv: takeout-X mot svag tvåa 12 hp ej sårbar /
    13 sårbar direkt, 10 hp balansering; spärr-X kvar på 14 (medvetet stramare,
    bevakas). Svaret på partnerns takeout-X rider på Fynd #5:s level-medvetna
    `answerTakeoutDouble`. Mathe/Multi träddes INTE in (bottarna öppnar aldrig
    stark 1♣/Multi 2♦ → utanför omfånget). 1639 gröna.
  - **Delbit 3 (Mathe mot stark 1♣) PARKERAD som framtidsidé** (ägarbeslut
    2026-07-04). Skälet: i vårt 2/1-system är 1♣ en NATURLIG öppning och den
    starka handen öppnar 2♣ (`openings.ts`: `stark 2♣, konstgjord`), så en stark
    konstgjord 1♣ finns aldrig på bordet → `defendStrongClub` har inget läge att
    utlösas i, och mot naturlig 1♣ räcker de redan inkopplade vanliga inkliven
    (`maybeOvercall`). Funktionen är färdig + enhetstestad och plockas upp först
    den dag appen får FLER budsystem (t.ex. stark klöver/Precision). Se PARKERAT
    i `CLAUDE.md`.
  - **Delbit 4 KLAR (väg A)** (`+ contested-openings`): svararen svarar nu när
    MOTSTÅNDAREN stör VÅR icke-1-färgs-öppning, i stället för att passa. Ny modul
    `contested-openings.ts` (`answerNTInterference` + `answerPreemptInterference`)
    inkopplad i `decideCall` via två detektorer (`ntInterferenceToAnswer`,
    `ownPreemptInterferenceToAnswer`). **Reachability-fynd (avgörande för scope):**
    appen modellerar bara DONT-störning över vårt 1NT (deras X-relä / 2-lägesbud)
    och takeout-X/inkliv över vår svaga tvåa/spärr; NATURLIGT 1NT-inkliv och
    störning av vårt 2♣ skapas aldrig. Ägaren valde väg A: bygg bara det som
    faktiskt nås → Lebensohl/negativ-X-över-naturligt-1NT-inkliv och 2♣-störning
    byggdes MEDVETET inte (skulle bli död kod – exakt Fynd #4:s antimönster).
    Schema (ägarbeslut 2026-07-04): över DONT-störning av 1NT = X/XX straff/värden
    (golv 8), egen 5+ färg naturligt, annars pass; över takeout-X av svag tvåa/spärr
    = XX värden (golv 10), fit = fortsatt spärrhöjning, annars pass. Facit: 12
    enhetstester (`contested-openings.test.ts`) + 2 integrationstester i
    `auction-live.test.ts` som bevisar att verktygen NÅS live. 1653 gröna.
  - **Delbit 5 KLAR (Case A)** (`+ runoutAfterOurRedouble`): FORTSÄTTNING bortom
    en konkurrensrond. Efter vårt 1NT + partnerns värde-XX (delbit 4) äger vår
    sida handen (15–17 + 8+ = 23+, majoriteten). Flyr motståndarna undan XX:et
    till en färg STRAFFDUBBLAR vi dem nu – varje steg, tills de får spela dubblat
    – i stället för att öppnaren passar flykten (auktionen dog förut efter att
    XX-detektorn svarat en gång). Ny detektor `runoutAfterOurRedouble`
    (`auction-live.ts`) inkopplad i `decideCall` FÖRE delbit 4:s svarsdetektor
    (så både öppnaren OCH XX-svararen doblar, med enhetlig "vi äger handen"-
    motivering). Ingen handkvalitetsgrind: mönstret garanterar majoriteten.
    **Medveten avgränsning (Case A only):** bara flykt efter vårt 1NT+XX byggdes.
    Flykt efter vår svaga tvåa/spärr+XX är INTE en straffsits (öppnaren är svag →
    vi äger inte handen), och den GENERELLA flerronds-konkurrensen (den öppna,
    svåra delen) sköts MEDVETET till efter R2:s arkitekturbeslut – R1-rapporten
    varnar för att stapla fler detektorer innan dess (se "Kan nya konventioner
    läggas till…" nedan). Facit: 4 integrationstester i `auction-live.test.ts`
    (reachability + öppnaren doblar + vi jagar dem vidare + säkerhet utan XX).
    **1657 gröna.**
Baslinje efter fixarna + delbit 1 + delbit 2: 1639 tester gröna. Efter delbit 4:
1653 tester gröna. Efter delbit 5 (Case A): **1657 tester gröna**. Därmed är
Fynd #2:s DEFINIERADE omfång klart (delbit 1/2/4/5; delbit 3 parkerad); bredare
flerronds-konkurrens väntar på R2.

---

## Teknisk genomgång

### Fynd 1 — Konkurrens-NT-svaret överbjuds till 2NT (HÖG)

**Problem.** I `src/lib/engine/auction.ts`, `competitiveResponderAction`
(NT-grenen), räknas nivån på svararens naturliga NT-bud fel. Efter vår
1-lägesöppning och ett 1-läges inkliv bjuder en jämn hand med stopp och 8+ hp
**2NT** i stället för naturligt **1NT**.

```ts
// auction.ts, competitiveResponderAction (mot ett färginkliv):
if (ovLevel <= 2 && isBalanced(hand) && hasStopper(hand, ovSuit) && p >= 8) {
  const L = cheapestLevelAbove('clubs', ovLevel, ovSuit) <= 1 ? 1 : 2
  return { call: `${L}NT`, rule: 'NT med stopp', ... }
}
```

**Rotorsak.** `cheapestLevelAbove('clubs', ovLevel, ovSuit)` beräknar lägsta
nivå där **klöver** ligger över inklivet – inte där **sang** gör det. Men NT
rankar över *alla* färger på samma nivå, så billigaste NT över ett bud på
`ovLevel` är alltid exakt `ovLevel`. Genom att använda klöver (lägst rankad) som
proxy blir svaret systematiskt **en nivå för högt** så snart inklivsfärgen rankar
över klöver (dvs. nästan alltid). För ett 1-läges inkliv ger formeln `L = 2`
fastän 1NT är lagligt och korrekt.

**Konsekvens (budexempel).** Syd öppnar **1♥**, Väst kliver in **1♠**. Nord har
`S:Kxxx H:xx D:Kxxx C:Qx` (≈8 hp, jämn, spaderstopp, < 3 hjärter → ingen negativ
dubbling, ingen höjning). Motorn bjuder **2NT** (`1♥–(1♠)–2NT`). 2NT i konkurrens
lovar inbjudningsstyrka (~11–12); 8 hp där är ett grovt överbud som kan driva
paret en nivå för högt. Rätt bud är naturligt **1NT** (6–10, stopp). Buggen når
den levande budlådan eftersom `buildAuction` är ryggraden i `decideCall`
(`auction-live.ts`).

**Lösning.** Byt nivåberäkningen till `L = ovLevel` (billigaste NT över ett
färginkliv på `ovLevel`). Isolerat och testbart → passar fix-protokollets
"facit-först"-spår, men eftersom det ändrar ett budval lämnar jag det till
ägarens ja (rör konkurrens-svarslogik, inte kosmetik).

**Prioritet: HÖG** (korrekt i vanliga fall men trasigt i ett definierat
konkurrensläge; otestat).

---

### Fynd 2 — §7-konkurrensen är fortfarande i stort sett inte inkopplad (HÖG)

**Problem.** FAS 0 (sanningskartan §7) slog fast att ~10 av 13 försvarsmoment är
skrivna och testade men aldrig nås i en levande auktion. Jag **verifierade att
detta fortfarande gäller** efter allt FAS 2/10-arbete:

- Sökning i hela kodbasen: `Lebensohl`, `DONT`/`dont`, `defense-conventional`
  (Mathe/Multi/svaga tvåor/spärr-försvar) förekommer **inte i någon `auction*.ts`-
  fil**. De importeras aldrig av `buildAuction` eller `decideCall` → de kan aldrig
  bjudas av datorn i en riktig budgivning.
- Konkurrens modelleras **bara efter motståndarnas 1-läges FÄRGöppning**:
  `maybeOvercall` (`auction-live.ts`) och överkliv-grenen i `buildAuction` kräver
  båda `openingSuit(open.bid)` (regex `^1(C|D|H|S)$`). Ingen konkurrens efter
  deras **1NT, 2♣, 2NT, svaga tvåor eller spärröppningar**.
- Det som ÄR inkopplat sedan FAS 0 (bra att bekräfta): Jordan 2NT, negativ/
  responsiv/stöddubbling, advancerns preferens på tvåfärgsinkliv, essfrågan/
  kungfrågan och straffdubbling i budlådan. Dessa fungerar och är testade.

**Rotorsak.** Konkurrenslagret är byggt inkrementellt runt det vanligaste läget
(vår 1-färgsöppning) via punktvisa "detektorer" i `auction-live.ts`
(`negativeDoubleToAnswer`, `partnerTwoSuiterToAnswer`, `rkcToAnswer` …). Varje nytt
konkurrensläge kräver en ny detektor; de återstående (deras 1NT/svaga/spärr) har
ingen.

**Konsekvens.** Öppnar en bot **1NT** och Syd (människan) stör, eller öppnar en
bot en **svag tvåa/spärr**, saknar datorpartnern verktyg (DONT/Lebensohl/Mathe
finns bara som oanropade funktioner). I praktiken passar boten där en riktig
2/1-partner hade agerat. Ingen krasch, men en påtaglig spel­lucka.

**Lösning.** Detta är planarbete, inte en punktfix: koppla in de återstående §7-
detektorerna (deras 1NT → DONT; deras svaga/spärr → takeout + Lebensohl) samt
konkurrens efter våra icke-1-färgs-öppningar. R2 (arkitektur) bör väga om det ska
göras som fler detektorer eller ett enhetligt konkurrenslager (se motsägelse-
noten till R6). Verktygen finns redan och är facit-granskade.

**Prioritet: HÖG** (definierade, vanliga konkurrenslägen är otäckta). Redan känt
i FAS 0 – här bekräftat som fortfarande öppet + preciserat.

---

### Fynd 3 — Off-book-lagret läser alla partnerfärger som naturliga (MEDIUM, PLAUSIBEL)

**Problem.** När Syd bjuder utanför systemlinjen svarar datorpartnern via
`offBookResponse` → `partnerLastSuit` / `raiseWithFit` / `slamAskTrump`
(`auction-live.ts`). Alla dessa behandlar **varje färgbud partnern gjort som en
naturlig färg**. Konstgjorda bud (Jacoby-kortfärg, Bergen 3♣/3♦, Drury 2♣/2♦,
splinter, cue-bud) kan då misstolkas så fort linjen inte längre styr.

**Rotorsak.** `partnerLastSuit` filtrerar bara bort sang och cue i motståndarnas
färg – inte konstgjorda bud i en objuden färg. Att risken är verklig bevisas av
att **felrapport #13** krävde en särskild vakt (`transferGameChoiceToAnswer`) just
för att transferns relä lästes som en naturlig hjärter. Vakterna byggs case-by-
case; det underliggande mönstret finns kvar för övriga konstgjorda bud.

**Konsekvens (budexempel, PLAUSIBEL – ej körd).** `1♥`(N) – `2NT`(S, Jacoby) –
`3♣`(N, Jacoby-kortfärg = singelklöver). Syd bjuder sedan off-book `4NT`.
`decideCall` för Nord: ingen överenskommen trumf (Syd har inte bjudit hjärter),
så `slamAskTrump` letar Nords "senaste naturliga färg" och hittar **3♣** – som är
konstgjord korthet, inte en klöverfärg. Nord svarar RKC som om **klöver** vore
trumf. Utfall: fel essredovisning i en slamauktion. Kräver att människan bjuder
off-book, därför MEDIUM snarare än HÖG, och markerad PLAUSIBEL (jag har läst
kodvägen men inte kört given).

**Lösning.** Ge off-book-lagret en gemensam "är detta budet naturligt?"-vakt
(återanvänd regelregistret `rules.ts`: konstgjorda regelnamn ≈ `isAlertRule`) i
stället för punktvakter per konvention. Rör kärnlogik → rapport, ingen fix nu.

**Prioritet: MEDIUM** (trasigt i definierade off-book-sekvenser; kräver mänskligt
avsteg för att triggas).

---

### Fynd 4 — Blinda testfläckar (MEDIUM)

Tester finns (~1626), så frågan är **vad** som inte täcks:

- **Konkurrens-NT-grenen är helt otestad.** Regelnamnet `NT med stopp`
  (`competitiveResponderAction`, där Fynd 1 bor) förekommer i **inget**
  konkurrenstest – bara i regelregistrets `rules.test.ts`. Överbudet i Fynd 1 har
  alltså inget facit som hade fångat det. (Till jämförelse: Jordan 2NT i samma
  funktion ÄR testat – `auction-competitive-raises.test.ts`.)
- **"Färdiga men oanropade" §7-konventioner** (`dont.ts`, `lebensohl.ts`,
  `defense-conventional.ts`) har egna enhetstester – men **noll integrationstest**
  som bevisar att de nås i en auktion. Det är exakt den "grunda testning"-fällan
  R1 letar efter: enhetstestet är grönt, men konventionen körs aldrig live. Ett
  fåtal `buildAuction`/`decideCall`-integrationstester per konvention skulle
  avslöja inkopplings-luckorna i Fynd 2 automatiskt.
- **Off-book-misstolkningen (Fynd 3)** har bara transfer-vakten testad; övriga
  konstgjorda bud in i ett off-book-4NT/-höjning saknar regressionstest.

**Prioritet: MEDIUM** (teknisk skuld/blind fläck som döljer Fynd 1–3).

---

### Fynd 5 — Latent: `answerTakeoutDouble` antar 1-lägesöppning (LÅG)

`answerTakeoutDouble` (`doubles.ts`) cue-budar alltid `2${their}` och räknar
hoppnivåer som om deras öppning låg på 1-läget. Mot en upplysningsdubbling av en
**svag tvåa** (t.ex. de öppnar 2♥, partnern dubblar) blir cue-budet `2♥` – olagligt
(inte över deras 2♥). Anroparens laglighetsvakt i `auction-live.ts`
(`legalCalls(...).includes(ans.call)`) släpper då budet och advancern faller
igenom → auktionen kan dö. **Ofarligt idag** (bottarna dubblar inte svaga tvåor i
live-flödet – kopplat till Fynd 2), men det är en odefinierad fortsättning värd
att laga i samma veva som §7-inkopplingen. **Prioritet: LÅG (latent).**

---

## Kan nya konventioner läggas till utan ökad teknisk skuld?

**Delvis.** Den **ostörda** kärnan (öppning/svar/återbud/slam) är välstrukturerad,
test-låst och facit-granskad – där kan en ny konvention läggas till tryggt, en i
taget, som hittills.

**Men konkurrenslagret ökar skulden för varje tillägg.** Störd budgivning hanteras
av ~10 punktvisa detektorfunktioner i `auction-live.ts` som var och en re-parsar
budhistoriken med egna specialvillkor. Varje ny konkurrenskonvention kräver en ny
detektor, och de delar subtila antaganden (max ett kontraktsbud från vår sida,
"senaste icke-pass", färg-rankning). Fynd 1 och 3 är symtom: budnivå- och
naturlig/konstgjord-logik återuppfinns lokalt i stället för att läsas ur EN källa
(`rules.ts` finns redan för kravnivå/alert – off-book-lagret använder den inte).
Slutsats: **lägg inte fler konkurrenskonventioner ovanpå detektor-mönstret utan
att först ta R2:s arkitekturbeslut** om ett enhetligt konkurrens-/tolkningslager.

---

## Matning till R6
- KRITISK: inga (ingen olaglig/kraschande väg hittad; Fynd 1 är ett lagligt
  överbud, inte ett olagligt bud).
- HÖG: **Fynd 1** (liten fix, hög effekt – bra kandidat för "denna vecka"),
  **Fynd 2** (stort, planarbete – "detta kvartal").
- MEDIUM: **Fynd 3, 4**. LÅG: **Fynd 5**.
- Motsägelse att bevaka i R6: Fynd 2:s lösning ("koppla in mer") kan dra åt fler
  detektorer, medan denna rapports slutsats + R2 kan vilja ersätta detektor-
  mönstret. Besluta arkitekturen (R2) före inkopplingen (Fynd 2).
