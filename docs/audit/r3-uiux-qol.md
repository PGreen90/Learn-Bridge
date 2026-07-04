# R3 — UI/UX & Quality of Life

## Så här ligger det till (för ägaren)

Gränssnittet är i **bra** skick. Det är genomtänkt byggt kring EN grön bordskälla
(`Felt`), känns enhetligt över alla skärmar, och har många detaljer som visar
omsorg: mörkt läge med egna färger för symbolerna, respekt för användare som bett
om mindre rörelse, stora tryckytor på stäng-krysset, safe-area-marginal så iPhones
undre list inte täcker korten. **Inget** jag hittade är KRITISK eller HÖG — inga
låsningar, ingen krasch, inga vilseledande knappar.

Det viktigaste fyndet är litet men konkret och mätt: **ruter-symbolen (orange) är
för svag mot det vita kortet** för att vara bekväm att läsa i en lång session
(kontrast 2.80:1 där riktvärdet är 4.5:1 — de andra tre färgerna klarar sig). En
knapp ändring av en enda färgkod löser det utan att bryta fyrfärgsleken. Resten av
fynden är "quality of life": utvecklarnas testverktyg ligger synliga för
slutanvändaren, facit/claim är begravda ett klick för djupt, och det finns ingen
återkoppling på om DITT eget kort var bra (men det är delvis medvetet — Spela-läget
är spel, inte träning). Ta dem en i taget om/när du vill.

## Fynd i korthet

| # | Fynd | Prioritet | Lagat nu? |
|---|------|-----------|-----------|
| 1 | Ruter-orange under kontrastgränsen mot vita kortet (mätt 2.80:1) | MEDIUM | Nej – rör designtoken, kräver ägarens ja |
| 2 | Utvecklarverktyget "Hålfinnare" syns för slutanvändaren i Budvisning | MEDIUM | Nej |
| 3 | Ingen facit-/rätt-återkoppling på DINA egna bud/kort i Spela-läget | MEDIUM | Nej – delvis medvetet designval |
| 4 | "Visa facit" och "Claim" ligger begravda i ⋮-menyn | LÅG | Nej |
| 5 | Blockerande dialoger positioneras i filten, inte mot skärmen (`absolute` ej `fixed`) | LÅG | Nej |
| 6 | Meny-/info-overlays i spelvyn saknar klick-utanför-för-att-stänga | LÅG | Nej |
| 7 | Tre snarlika lägen + route-namn (`/spela` = "Budvisning") lätt att förväxla | LÅG | Nej |
| 8 | Små kort (10 px valör), skalade 75 % i "Förra sticket" → tunn läsbarhet | LÅG | Nej |

Inga fynd klassade KRITISK eller HÖG.

---

## Teknisk genomgång

### Fynd #1 — Ruter-orange under kontrastgränsen (MEDIUM)

**Problem.** Fyrfärgsleken sätter ruter till `text-orange-500` (#f97316) på kortens
vita/ljusgrå framsida (`src/lib/suitColors.ts:12`, `src/components/PlayingCard.tsx`).
Uppmätt WCAG-kontrast mot kortytan:

| Färg | Token | Mot vitt | Mot kortets nederkant (slate-100) |
|------|-------|----------|-----------------------------------|
| Spader | slate-900 | 17.85 | 16.30 |
| Klöver | green-700 | 5.02 | 4.58 |
| Hjärter | red-600 | 4.83 | 4.41 |
| **Ruter** | **orange-500** | **2.80** | **2.56** |

Riktvärdet för normal text är 4.5:1 (3:1 för stor text/UI-grafik). Ruter ligger
klart under båda; de tre andra klarar 4.5.

**Rotorsak.** `orange-500` är vald för att sitta mellan hjärterröd och klövergrön i
kulör, men den är för ljus. Färgen är ägarens uttryckliga fyrfärgsval (beslut
2026-07-02), så den ska inte ändras tyst.

**Konsekvens.** I en lång session, särskilt på de små `sm`-korten (28×40 px,
valör 10 px) i träkarlskolumnerna och i den 75 %-skalade "Förra sticket"-panelen,
blir ruter-korten sämst att läsa av alla fyra — det som ska göra fyrfärgsleken
lättläst blir för ruter tvärtom en belastning.

**Lösning (förslag till ägaren, inte utfört).** Mörka ruter ett steg:
`text-orange-600` (#ea580c → 3.56:1, klarar stor text) eller helst
`text-orange-700` (#c2410c → **5.18:1**, klarar all text och läser fortfarande
tydligt som "orange", väl skild från hjärterröd). Ett enda tokenbyte i
`suitColors.ts` (`SUIT_TEXT.diamonds`) slår igenom överallt. Mörkt-läge-varianten
`SUIT_TEXT_DARK.diamonds` (orange-400 på vita kort, som redan är undantagna) berörs
inte. **Prioritet MEDIUM** — påverkar inte budkorrekthet, men direkt läsbarhet i
just det läge appen är byggd för (långa spelsessioner). Låg insats, hög effekt.

### Fynd #2 — Utvecklarverktyg synligt i produktions-UI (MEDIUM)

**Problem.** Budvisnings-sidan (`src/pages/Spela.tsx:216–251`) exponerar en
"🛠 Hålfinnare – testverktyg för budmotorn" som kör 2 000–5 000 slumphänder genom
motorn och visar träffstatistik per regel.

**Rotorsak.** Bekvämt för utveckling/felsökning, aldrig gömt för slutanvändaren.

**Konsekvens.** För målgruppen (erfaren spelare) är detta obegriplig teknisk röra
mitt i en annars ren titta-läge-skärm. Det signalerar "oavslutad app" och kan
starta tunga körningar av misstag.

**Lösning.** Göm bakom en dev-flagga (t.ex. `import.meta.env.DEV`) eller flytta
till en dold intern route. Ingen funktionalitet tas bort — den blir bara osynlig i
produktion. **Prioritet MEDIUM.**

### Fynd #3 — Ingen rätt-/facit-återkoppling på egna bud och kort (MEDIUM)

**Problem.** I Spela-läget (`src/pages/Play.tsx`) får du efter ett **eget bud** bara
en tolkning ("Eget bud. …"), aldrig ett besked om det avvek från motorns
rekommendation eller varför. Efter ett **eget kortutspel** får du ingen återkoppling
alls — bottarnas kort går att klicka för motivering, men dina egna gör det inte, och
facit (`showFacit`) ger bara spelförarens *totala* stick, inte om just ditt kort var
ett misstag.

**Rotorsak.** Medvetet designval: Spela-läget är "spela på riktigt", Budträning är
"få facit". Gränsen är rimlig men skapar en lärlucka.

**Konsekvens.** Detta är precis R3-promptens Del A punkt 2 ("vet spelaren om det var
rätt, och varför?"). I en app vars namn är att *lära sig* bridge kan en spelare
spela en hel giv fel utan att någonsin få veta det, om hen inte själv gräver fram
facit ur menyn efter varje kort.

**Lösning (förslag).** Litet, additivt: (a) markera i budlådans betydelse-rad när
ditt valda bud skiljer sig från motorns rekommendation ("motorn hade valt X"), och
(b) ett valfritt läge där facit visas automatiskt efter given, eller en diskret
"var det bästa kortet?"-indikator. Ingen befintlig funktion tas bort. **Prioritet
MEDIUM** — behöver ägarens riktning om hur mycket "träning" som ska in i "spel".

### Fynd #4 — Facit och Claim begravda i ⋮-menyn (LÅG)

**Problem.** "Visa facit" och "Claim tricks" nås först efter att man öppnat ⋮-menyn
(`Play.tsx:662–725`). Under aktivt spel är facit den vanligaste återkopplingen man
vill åt.

**Konsekvens.** Två klick + att menyn täcker bordet, varje gång man vill se facit.

**Lösning.** En liten dedikerad facit-knapp på listen (eller intill svarta
kontraktslisten) vore ett klick i stället för två. **Prioritet LÅG.**

### Fynd #5 — Blockerande dialoger positioneras i filten, inte mot skärmen (LÅG)

**Problem.** Resultat-, claim-, bekräfta-kontrakt- och felrapport-dialogerna använder
`absolute inset-0` inuti `<Felt>` (t.ex. `Play.tsx:234, 570, 1074`;
`FelrapportDialog.tsx:40`). De centreras alltså mot **filten**, inte mot
webbläsarfönstret (`fixed`).

**Rotorsak.** Filten är oftast ungefär lika hög som skärmen på mobil, så det ser
rätt ut där.

**Konsekvens.** På en hög bordsvy eller liten skärm (t.ex. resultatdialogen ovanpå
den ganska höga `PlayReplay`) kan dialogen hamna mitt i det scrollbara området och
kräva scroll för att nås — bräckligt när layouten växer.

**Lösning.** Byt de blockerande dialogerna till `fixed inset-0` (viewport-centrerade)
med `z`-lager ovanför allt. **Prioritet LÅG** (fungerar idag på mobil, men latent).

### Fynd #6 — Overlays saknar klick-utanför-för-att-stänga (LÅG)

**Problem.** ⋮-menyn, ⓘ-budgivningsoverlayen (`Play.tsx:662, 743`), TableMenu i
budfasen och AuctionGrids förklarings-popup stängs bara genom att man trycker samma
knapp igen (eller väljer krysset). Ingen genomskinlig backdrop fångar klick utanför.

**Konsekvens.** Vanligt webbmönster ("klicka bredvid för att stänga") saknas; man kan
bli sittande med en öppen meny som skymmer bordet.

**Lösning.** Lägg en osynlig heltäckande stäng-yta bakom varje öppen overlay (samma
som de vita dialogerna redan har via `bg-black/30`). **Prioritet LÅG.**

### Fynd #7 — Tre snarlika lägen + förväxlingsbara route-namn (LÅG)

**Problem.** Appen har tre bud-relaterade lägen: **Budträning** (`/budtraning`),
**Budvisning** (`/spela`) och **Spela kort** (`/spela-kort`). Route-namnet `/spela`
pekar på "Budvisning" (titta-läge), medan det fulla spelet ligger på `/spela-kort` —
en latent förväxling. Startsidan lyfter dessutom "Budvisning" som eget lägeskort men
INTE "Spela kort" (som bara finns som hero-knapp) och inte Inställningar.

**Konsekvens.** En ny användare kan gå in på "Budvisning" i tron att det är att
spela. Inte fel, men onödig friktion i onboarding.

**Lösning.** Överväg att döpa om routen `/spela` → t.ex. `/budvisning` (HashRouter,
riskfritt), och ge "Spela kort" ett eget lägeskort på startsidan så de tre lägena
presenteras jämbördigt. **Prioritet LÅG.**

### Fynd #8 — Små kort och 75 %-skalning tunnar ut läsbarheten (LÅG)

**Problem.** `sm`-kort har 10 px valör (`PlayingCard.tsx:17`). I "Förra
sticket"-panelen skalas hela sticket dessutom `scale-75` (`Play.tsx:770`) → ~7.5 px
effektiv valörtext, och träkarlskolumnernas kort överlappar tätt (`-mt-7`).

**Konsekvens.** Kombinerat med fynd #1 (svag orange) blir de minsta korten sämst att
snabbläsa i en lång session.

**Lösning.** Efter att #1 är åtgärdat, utvärdera om "Förra sticket" behöver `scale-75`
eller kan visas något större. **Prioritet LÅG** (bäst att bedöma efter #1).

---

## Vad som är bra (noteras uttryckligen — inte allt behöver åtgärdas)

- **EN bordskälla** (`Felt`) → konsekvent utseende över spel, träning, visning och
  omspelning. Precis den sunda arkitektur R2 lyfte.
- **Tillgänglighet:** `aria-label` på alla ikonknappar, `aria-expanded` på
  mobilmenyn, ~44 px tryckyta på stäng-krysset, `sr-only`-legend i felrapporten,
  fokus-ring på `Button`.
- **Långa sessioner:** respekterar `prefers-reduced-motion` (all rörelse av),
  safe-area-inset i botten, mjuk 1 s temaövergång bara under själva växlingen.
- **Mörkt läge** har egna, ljusare symbolfärger i löptext (`SUIT_TEXT_DARK`) medan
  korten (alltid vita) behåller de mörka — genomtänkt.
- **Återkoppling finns där det räknas i träningen:** grön/röd ram + förklaring på
  varje budval (`BidOptions`), klickbara lagda bud med kravnivå + ALERT.

## Sammanfattande bedömning

Kan gränssnittet växa utan att dra på sig skuld? **Ja.** Grunden (en Felt-källa,
återanvända byggblock, färgtokens på ett ställe) gör det. Fynd #1 är den enda som
rör faktisk användbarhet nu och är billig att fixa; #2–#3 är de som mest påverkar
hur "färdig" och "lärande" appen känns. Ordna dem i NU/NÄST när ägaren vill —
förslagsvis #1 först (störst nytta per insats).
