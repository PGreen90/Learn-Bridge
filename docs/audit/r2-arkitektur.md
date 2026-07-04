# R2 — Teknisk arkitektur & skalbarhet

## Så här ligger det till (för ägaren)

Grunden är **sund och förvånansvärt ren**. Motorn är byggd av rena funktioner
utan dolda genvägar eller delat "minne" som kan smitta ner varandra, importerna
bildar en snygg trappa utan rundgång, och gränsen mellan motor och skärm är tydlig
(skärmarna räknar inga bud själva – de frågar motorn). Kortspelet är dessutom
klokt byggt för fart: det räknar i en egen bakgrundstråd med en tidsbudget så
webbläsaren aldrig fryser. Kontraktshärledningen som slogs ihop 2026-07-03 är
verkligen **en** källa nu – det höll.

Det finns **en enda strukturell sak att vara uppmärksam på**, och den är viktig
just för din plan att lägga till fler konventioner: bot-hjärnans beslutsdel
(`decideCall`) är en lång **handskriven lista av 17 specialfall i bestämd ordning**.
Den fungerar och är väl testad (88 tester vaktar den), men varje ny konkurrens-
konvention innebär "lägg till ett specialfall till och tänk om hela ordningen".
Det är inte trasigt – det är den del som blir tung att underhålla **först** när
systemet växer. Ingen KRITISK eller HÖG brist hittades. Rekommendationen är att
göra den listan datadriven *innan* vi staplar fler konventioner (samma varning som
R1 gav), inte att bygga om något nu.

## Fynd i korthet

| # | Fynd | Prioritet | Lagat nu? |
|---|------|-----------|-----------|
| 1 | `decideCall` är en ordningsberoende kedja av 17 handskrivna detektorer – skalbarhetsflaskhalsen | MEDIUM | Nej (rapporteras – kärnlogik, rörs ej tyst) |
| 2 | Två läsare av budens betydelse: motorns regel + `interpretCall`-heuristiken kan glida isär | MEDIUM | Nej (rapporteras) |
| 3 | `buildAuction` körs om från grunden vid varje `decideCall` och varje render i Play.tsx | LÅG–MEDIUM | Nej (rapporteras) |
| 4 | 17× kopierad `legalCalls(...).includes`-boilerplate i `decideCall` | LÅG | Nej (ingår i fix för #1) |
| 5 | `responses.ts` är en bred nav (13 importörer, delad `ResponseResult`-typ) | LÅG | Nej (notering) |
| ✓ | **Verifierat GOTT:** kontraktshärledningen är EN källa (`auction-contract.ts`) | — | Inget att göra |

**Ingen KRITISK. Ingen HÖG.** Arkitekturen är i grunden frisk; fynden är teknisk
skuld och skalbarhet, inte fel i budgivningen.

---

## Vad som är bra (och varför det ska bevaras)

Detta är inte fyllnad – det är arkitekturbeslut som R6 bör skydda mot framtida
"förbättringar" som skulle rasera dem:

- **Rena funktioner, ingen dold state.** Genomsökning av alla motorfiler: *noll*
  modul-nivå `let`/`var`, inga globala cacher/`Map`/`WeakMap` (utom ett läskonstant
  `RESPONDABLE`-set). Det betyder att **ingen konvention kan smitta ner en annan
  via delat föränderligt minne** – den vanligaste källan till "jag ändrade RKC och
  försvaret gick sönder" finns helt enkelt inte här. Bevara detta.
- **Ren importtrappa, ingen rundgång.** Bas (`hand`, `deal`, `play`, `rules`) →
  värdering (`evaluation`) → svar/återbud → orkestrering (`auction`) → live
  (`auction-live`). Inga cirkulära beroenden.
- **Motor ↔ UI-gränsen är tät.** `Play.tsx` anropar bara `decideCall`,
  `contractFromCalls` och `interpretCall`; den enda motorfunktion som används för
  annat än beslut är `hcp()` – och bara för att *visa* poäng. Ingen budregel bor i
  en komponent.
- **EN kontraktskälla (svar på R2:s fråga 5).** `contractFromCalls` bor i
  `auction-contract.ts`; `auction-live.ts` re-exporterar den (rad 115) och
  `finalContract` bygger på den. Sammanslagningen 2026-07-03 höll – det finns inte
  två vägar att räkna fram slutkontraktet längre. ✓
- **Kortspelet är byggt för skala.** `play-bot.ts` har adaptiv Monte-Carlo-budget
  (`mcBudget`: färre sampel/noder när ställningen är tyngre), `dds.ts` har hård
  nodbudget med *graceful fallback* till tumregler i stället för att frysa, och
  `mc-worker.ts` kör i en **web worker** (kopplad i `Play.tsx:374`). Den tyngsta
  beräkningen i appen är alltså redan flyttad ur UI-tråden och tidsbudgeterad.

---

## Teknisk genomgång

### Fynd #1 — `decideCall` är en ordningsberoende detektorkedja (MEDIUM, störst nytta att åtgärda)

**Problem.** `decideCall` (`auction-live.ts:1058–1286`) är bot-hjärnans beslutsdel.
Efter att den kanoniska linjen tagit slut eller Syd bjudit off-book är den en
**linjär lista av 17 `if (detektor) { svara }`-block** i en bestämd, betydelsefull
ordning. Fem av dem bär explicit kommentaren **"Måste ligga FÖRE …"** – dvs.
ordningen är korrekthetskritisk, inte bara stilistisk. Varje block följer samma
mönster:

```ts
const x = xToAnswer(history, seat)      // re-skanna rå history efter ett mönster
if (x) {
  const ans = answerX(deal.hands[seat], ...)
  if (legalCalls(history, seat).includes(ans.call as Bid)) {
    return { seat, bid: ans.call as Bid, rule: ans.rule, explanation: ans.explanation }
  }
}
```

Det finns **15 `…ToAnswer/…ToCorrect/…Rescue`-detektorer** och mönstret upprepas
17 gånger (`legalCalls(history, seat).includes` × 17).

**Rotorsak.** Det finns **ingen abstraktion för "auktionsläge/roll"**. Varje
detektor läser om den råa `history`-arrayen och letar sitt eget mönster ("öppnade
vi 1NT och redubblade partnern? flydde de sedan till en färg?"). Betydelsen av
auktionen räknas alltså ut på nytt, ad hoc, i varje detektor. När en ny konvention
läggs till blir lösningen alltid "skriv en detektor till och pussla in den på rätt
plats i kedjan".

**Konsekvens (konkret).** Svar på R2:s huvudfråga – *"lägg till 5 konventioner om
ett år, vad går sönder först?"*: **den här kedjan, först av allt.** Exempel: om vi
inför "svararen svarar på partnerns Lebensohl-2NT i konkurrens" måste den nya
detektorn placeras rätt *relativt* det generella `offBookResponse` (rad 1281) –
annars läser off-book-svaret 2NT-reläet som en naturlig sang och "stöder" fel, precis
som redan hänt med transfer-3NT (felrapport #13, rad 1172–1176) och cue-höjningar
(felrapport #16, rad 1229–1234). Varje ny konvention ökar antalet ordningspar man
måste hålla i huvudet (17 → 18 → 19 …).

**Förmildrande:** 88 tester i `auction-live.test.ts` vaktar kedjan, så en felaktig
omordning skulle *sannolikt* fångas av ett rött test. Detta är därför en
**underhålls- och begriplighetsrisk (teknisk skuld)**, inte akut buggrisk – därav
MEDIUM, inte HÖG. Men det är den *högst prioriterade* MEDIUM-punkten, eftersom den
är själva tillväxtflaskhalsen.

**Rekommenderad lösning (två steg, inget nu – kärnlogik kräver ägarens ja):**
1. **Datadriven kedja.** Gör kedjan till en ordnad lista av
   `{ name, detect, answer }` som en liten hjälpfunktion `tryDetector` itererar
   över (fångar även #4:s boilerplate). Ordningen blir då *synlig data* i stället
   för implicit i kodflödet, och "måste ligga FÖRE"-relationerna kan dokumenteras
   på ett ställe.
2. **På sikt: ett tunt `auctionFacts(history)`-lager** som räknar ut de fakta
   detektorerna delar (öppnare/svarare, senaste konventionella budet, "äger vi
   handen?", trumföverenskommelse) *en gång*, så detektorerna slutar re-skanna
   `history` var för sig.

Detta är samma slutsats som R1 drog ("stapla inte fler §7-detektorer före
arkitekturbeslutet"). R2 bekräftar: arkitekturbeslutet är att **konvertera kedjan
till data innan fler konventioner läggs till.**

---

### Fynd #2 — Två läsare av budens betydelse kan glida isär (MEDIUM)

**Problem.** Betydelsen av ett bud härleds på två oberoende ställen:
- **Motorn** fäster `rule` + `explanation` på varje bud den själv väljer
  (öppningar, svar, alla detektorsvar i `decideCall`).
- **`interpretCall`** (`auction-interpret.ts:224`) förklarar bud för användaren.

`interpretCall` är byggd smart: den använder motorns `rule`/`explanation` om budet
har en (rad 229–233, `confidence: 'säker'`). **Men** för bud *utan* regel – dvs.
Syds egna bud från budlådan – faller den till en **egen heuristik**
(`interpretContractBid`, `interpretPass`, `interpretDouble`, …) som *re-implementerar
en delmängd av budbetydelselogiken* fristående från motorn.

**Rotorsak.** Det finns ingen delad "vad betyder detta bud"-funktion; motorns
regelspråk och tolkningsheuristiken är två separata implementationer av samma
domänkunskap.

**Konsekvens.** Begränsad men reell: när en ny konvention läggs till lär sig motorn
den automatiskt (den fäster sin regel på bot-buden), men **`interpretCall` måste
läras samma konvention separat** för att kunna förklara den när *människan* bjuder
den off-book. Glider de isär ser spelaren en felaktig eller vag förklaring av sitt
eget bud, medan bottarna bjuder korrekt. Skadan är inhägnad till förklaringstexten
(inte till buden), därav MEDIUM.

**Rekommenderad lösning.** Håll heuristiken medvetet tunn och dokumentera att den
bara gäller un-ruled människobud; på sikt låt den anropa samma
`interpret`-hjälpfunktioner som motorns regel-beskrivningar bygger på, så det finns
en källa. Inget brådskande.

---

### Fynd #3 — `buildAuction` körs om vid varje beslut och varje render (LÅG–MEDIUM)

**Problem.** `decideCall` börjar med `const built = buildAuction(deal)`
(`auction-live.ts:1060`) – hela den kanoniska linjen byggs om från grunden vid
**varje** bot-tur. `Play.tsx` gör dessutom `decideCall(game.deal, game.history, 'S')`
för rekommendationen (`Play.tsx:189`) som körs om vid **varje render** medan det är
Syds tur.

**Rotorsak.** Den rena-funktioner-stilen (en styrka, se ovan) betalar med
omräkning: inget resultat sparas mellan anrop eftersom inget får cachas i modulen.

**Konsekvens.** I dag försumbar – en budgivning är kort och `buildAuction` är
billig. Men det är onödigt allokerande, och render-loopen i `Play.tsx` bygger om
linjen flera gånger per sekund utan att given ändrats. Skalar dåligt om budlogiken
växer.

**Rekommenderad lösning.** Memoisera `buildAuction` per giv med en
`WeakMap<Deal, BuiltAuction | null>` (säkert eftersom funktionen är ren och `Deal`
är oföränderlig under en giv). I `Play.tsx`, `useMemo` på rekommendationen med
`[game.deal, game.history.length]`. Isolerat och lågrisk – men rör en kärnfil, så
rapporteras hellre än lagas tyst.

---

### Fynd #4 — Kopierad boilerplate i `decideCall` (LÅG)

`if (legalCalls(history, seat).includes(ans.call as Bid)) return { seat, bid: … }`
förekommer 17 gånger nästan ordagrant. Ren kosmetik/underhåll. **Åtgärdas
automatiskt** av `tryDetector`-helpern i fynd #1:s lösning – ingen egen insats.

---

### Fynd #5 — `responses.ts` är en bred nav (LÅG, notering)

`responses.ts` importeras av 13 moduler (alla `responses-*`, `overcalls`,
`doubles`, `rebids`, `responder-rebids`, `slam`, `defense-conventional`,
`lebensohl`, `contested-openings`, `dont`) och exporterar den delade typen
`ResponseResult`. Det är inte en bugg – det är en naturlig gemensam kärna – men det
är den fil där en signaturändring (t.ex. nytt fält i `ResponseResult`) ripplar
bredast. **Notering, ingen åtgärd:** om `respondToMajor`/`respondToMinor` eller
`ResponseResult` ändras, kör hela svitens tester; behandla filen som ett publikt
kontrakt.

---

## Arkitekturseam värt att dokumentera (bakgrund till #1)

Systemet har medvetet **tre auktionslager** med olika ansvar – detta är en styrka
när det är förstått, en fälla när det inte är det:

- `auction.ts` (`buildAuction`, generativt) — bygger parets kanoniska systemlinje
  och modellerar **en rond** konkurrens, sätter sedan flaggan `open: true` och
  lämnar över. Handoff-kontraktet är just `BuiltAuction.open`.
- `auction-live.ts` (`decideCall`, levande) — följer linjen tills den tar slut/off-book,
  tar sedan över live via detektorkedjan (fynd #1).
- `auction-interpret.ts` (`interpretCall`, förklarande) — översätter bud till text
  (fynd #2).

Seamen `open`-flaggan (`auction.ts:239–267`) är den viktigaste och minst
dokumenterade kopplingen i hela motorn. **R4-rekommendation:** skriv upp detta
tre-lager-kontrakt explicit i `docs/status.md` eller `bot-hjarna.md`, så en
parallell session inte råkar bygga budlogik i fel lager.

---

## Sammanfattande bedömning

Om vi lägger till 5 nya konventioner om ett år går sakerna sönder i denna ordning:

1. **`decideCall`-kedjan (fynd #1)** — först och tydligast. Varje konkurrens-
   konvention = en detektor till + omprövad ordning.
2. **`interpretCall`-heuristiken (fynd #2)** — måste läras varje konvention separat
   för människans off-book-bud, annars glider förklaringarna isär.
3. **`auction.ts` generativa förgrening** (525 rader redan) — on-book-fortsättningar
   för nya konventioner växer förgreningen; hanterbart men värt att bevaka.

Ingenting av detta är trasigt i dag och grunden (rena funktioner, en kontraktskälla,
tät UI-gräns, budgeterat kortspel) är stark. **Den enda strukturåtgärd som bör
göras före breddbyggande är att konvertera `decideCall`-kedjan till data (fynd #1)** –
allt annat är LÅG eller notering.

*Fix-protokollet följt: inga fixar gjorda på plats. `decideCall`, `buildAuction`
och `interpretCall` är budsystem-kärnlogik och rörs aldrig tyst – alla fynd är
rapporterade, inte lagade, för ägarens beslut.*
