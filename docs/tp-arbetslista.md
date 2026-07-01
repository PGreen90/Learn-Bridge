# TP i budvalet — arbetslista

> 🔺 **NÄSTA GÅNG:** hela A–D klara (öppningsgolv, höjningar, accepter, sang-nudge
> inkl. sårbarhet). Kvar i "brett" TP: Steg E (reverse/hoppskift), Steg F (3:e/4:e-
> hands lättöppning) + sekundära TP-lägen nedan – hämtas när ägaren vill.

> Boten ska tänka i **totalpoäng (TP/fördelning)**, inte rå HP (ägarens beslut
> 2026-06-30). Byggs i **test-låsta steg** så on-book aldrig rubbas.
>
> **Låst princip (gäller överallt):** *nedgradera aldrig.* En hand värderas till
> `max(HP, TP-mått)` – form/korthet får **lyfta** ett bud, men aldrig sänka det
> under HP (en människa nedgraderar i princip aldrig en bra hand).
>
> Mått efter läge: **startpoäng** (ingen fit), **stödpoäng** = `dummyPoints`
> (svararen, fit i färg), **Bergenpoäng** = `bergenPoints` (öppnaren, fit i färg).
> Spec: `docs/handvardering.md`. Ägaren vill ge **mänsklig input i konkreta
> budsituationer** – fråga med exempelhänder, gissa inte.

## ✅ Klart (pushat + live)
- **Steg A — öppningsgolvet.** `openings.ts`: färgöppning vid `HP ≥ 12 || TP ≥ 12`.
  12 HP öppnar alltid, bra 11:or (TP≥12) uppgraderar, platta 11:or avstår.
- **Steg B — svararens högfärgshöjningar.** `responses.ts` `respondToMajor`:
  fit-grenarna väljer nivå på **stödpoäng = `max(HP, dummyPoints)`**. Korthet
  lyfter (11 HP + singel + 4 trumf → splinter); platt övervärderad hand stannar.
- **Steg C-1 — öppnarens högfärgs-accepter.** `rebids.ts`:
  `openerRebidAfterSimpleRaise`, `openerRebidAfterBergen`,
  `openerRebidAfterSplinter` räknar **Bergenpoäng = `max(HP, bergenPoints)`**.
- **Steg C-2 — minorhöjningar på TP (klar 2026-07-01, FAS 4).** Beslut (autonomt,
  för granskning): minorfit siktar oftast 3NT där singel är en NACKDEL → minor-
  höjningar lyfts på **`max(HP, bergenPoints{notrump})`** (längd + sidofärg,
  ALDRIG korthet). Inkopplat i `responses.ts respondToMinor` (inverterad stark +
  gap-hand). **Öppnarens `openerRebidAfterInvertedMinor` lämnades medvetet på
  HP/stopp** – det är en 3NT-jakt där form/korthet inte ska väga (minorslam sköts
  av slammaskineriet). Facit i `responses.test.ts`.
- **Steg C-3 — sang-accepter på TP (klar 2026-07-01, FAS 4).** Spelinbjudans-
  accepter (3NT) räknar nu **startpoäng** (`max(HP, startingPoints)` – 5-korts
  färg/löpande honnörer lyfter, ingen kortfärg i NT), golvat vid HP.
  `rebids.ts`: `openerRebidAfterLimitedResponse` (minor 1m–2NT, p≥14) och
  `openerRebidAfter1NTResponse` (1NT–2NT kvantitativ, p≥16). Facit i
  `rebids.test.ts` (13 hp + AKQxx accepterar; platt quack-13 passar).

## ⬜ Kvar att bygga

### Steg D — TP-nudge för sangöppning
**Steg b (sårbarhets-oberoende) KLAR 2026-07-01.** Ägarens resonemang (efter
exempelhänder): (1) 5-korts major > 5-korts minor i värde; (2) en 5-korts major i
5-3-3-2 är besvärlig att rebjuda → talar för 1NT; (3) öppnar man 1NT med en
5-korts minor berövas partnern att visa en 4-korts major på 1-läget → öppna
minorn. Regel (i `openings.ts`, balanserad gren):
- **Bra 14 → 1NT:** `p === 14 && startpoäng ≥ 15 && ingen 5-korts färg`
  (4-3-3-3/4-4-3-2). Samma regel-id `'1NT'`. Honnörskvaliteten (Q2 sänker, AQ109/
  tior lyfter) fångas redan av `startingPoints`, så tröskeln ≥15 självväljer bra
  14:or. Facit i `openings.test.ts` (bra 14 → 1NT; 5-korts minor → 1♦; 5-korts
  major → 1♠; platt quack-14 → minor).
- **5-korts major** som når tröskeln behåller vi som 1M tills fler exempel (punkt 1
  vinner i tveksamma fall).

**✅ Steg D-vulnerabilitet KLAR 2026-07-01:** `classifyOpening(hand, vulnerable)`
tar nu en sårbarhetsflagga; `isVulnerable(seat, vul)` (`openings.ts`, exporterad)
trådas in via `buildAuction` (och `Spela.tsx` – lokal dubblett borttagen). Regel:
ej sårbar → nudge vid startp. ≥ 15, sårbar → ≥ 16. Facit i `openings.test.ts`
(startp. 15 nudgas bara ej sårbar; startp. 16 alltid). Default `false` (bakåtkompat).

### Steg E — öppnarens reverse / hoppskift på TP (tillagt 2026-07-01)
Styrkegrindade återbud: en **reverse** kräver extra. En formstark 16:a
(`bergenPoints`) bör kunna reversera medan en platt 17:a kanske inte ska. I dag
rå HP i `rebids.ts`. Naturlig granne till C-1 (samma mått, öppnarens sida).
**Mänsklig input behövs:** ska form lyfta in i reverse-zon, eller hålla reverse
rent HP-styrt för att inte vilseleda svararen om styrkan?

### Steg F — tredje/fjärde-hands lättöppning (tillagt 2026-07-01)
Människor öppnar lätt i 3:e hand med form (Drury, Steg-sekundär, täcker *svaret* –
inte själva beslutet att öppna lätt). Eget omdöme bredvid Steg A (öppningsgolvet).
**Mänsklig input behövs:** hur lätt får 3:e hand öppna, och ska 4:e hand
(Pearson/regeln om 15) skilja sig?

## ⬜ Sekundära TP-lägen (efter C/D, om vi vill gå hela vägen "brett")
- **Drury** (`responses-drury.ts`): passad hand, limithöjning – väg stödpoäng.
- **Game tries** (lång färg / hjälpfärg) – formstyrda till sin natur.
- **§7 inkliv/advancer** (`overcalls.ts`, `doubles.ts`): väg färgkvalitet/form,
  inte bara HP (eget domän – egen runda).
- **Off-book i budlådan** (`auction-live.ts`): `raiseWithFit` använder redan
  `dummyPoints` – kontrollera att off-book-svaren är linje med Steg B/C.

## 🔧 Städning / konsekvens
- ✅ **Gemensam hjälpare** `pointsWithFloor(hand, trump, kind)` (2026-07-01,
  `evaluation.ts`): `max(HP, fit-mått)`-mönstret är nu single-sourcat. Ersatte de
  fyra inlinade ställena (`responses.ts` stödpoäng + `rebids.ts` ×3 Bergenpoäng).
  Returnerar `{hp, measure, points, lifted, text}` så förklaringstexten
  (`"11 hp / 14 stödp."`) också är single-sourcad. Beteendebevarande – 485 tester
  gröna, `tsc` rent.
- ✅ **Invariant-test "nedgradera aldrig"** (2026-07-01, `tp-invariant.test.ts`):
  seedat svep (3000 givar × 4 händer × 4 trumf × stöd/Bergen, ~96 000 fall)
  bevisar att `pointsWithFloor` aldrig ger poäng under HP-golvet. Räknar även
  faktiska lyft (`liftedCount > 0`) så testet inte är vakuöst. Låser principen
  globalt, inte bara per steg. Eftersom alla fyra TP-budbeslut nu läser
  `pointsWithFloor` skyddar detta hela domänen.
- **Slamzon-tröskeln (≥33/≥37) — konsekvenskoll** (tillagt 2026-07-01):
  `slam-auction.ts` summerar redan Bergen+stödpoäng. Auditera att den summeringen
  inte dubbelräknar form mot A/B/C (två TP-mått som båda lyfter samma korthet).
- **Visa TP-måttet i budförklaringen** konsekvent (`spTxt`/`txt` finns i B/C-1) så
  ägaren ser *varför* ett bud lyftes.
- **Hålfinnare/övningar** (`docs/arbetslista.md` punkt 31–32) som tränar de nya
  TP-lyften.

## Arbetsregler (varje steg)
1. **Facit före fix** – uppdatera/lägg testfall som låser det nya beslutet.
2. **`npm test` grön** – hela sviten, inkl. on-book-svepen (inga regressions).
3. **`max(HP, …)`-golvet** – verifiera att inget facit nedgraderas.
4. **Fråga ägaren** vid varje omdömesläge (konkreta exempelhänder).
5. Uppdatera `docs/handvardering.md` (spec), `docs/status.md`, `CLAUDE.md` (beslut).
