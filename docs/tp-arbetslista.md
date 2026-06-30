# TP i budvalet — arbetslista

> 🔺 **NÄSTA GÅNG BÖRJAR VI MED:** Steg C-2 (minorhöjningar på TP). Inled med att
> **fråga ägaren om konkreta exempelhänder** – öppen fråga: *ska korthet väga i
> minorhöjningar, eller bara längd/sidofärg?* (Städning klar 2026-07-01:
> `pointsWithFloor`-hjälpare + globalt invariant-test. Kvar i städning om vi vill:
> slamzon-tröskelns konsekvenskoll.)

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

## ⬜ Kvar att bygga

### Steg C-2 — minorhöjningar på TP
Fit i minor siktar oftast 3NT (HP/stoppar-styrt), men 5m/slam i minor är
formstyrt. **Mänsklig input behövs:** ska korthet väga i minorhöjningar, eller
bara längd/sidofärg?
- `responses.ts` `respondToMinor`: inverterad minor (svag/stark), 2NT-inbjudan,
  gap-handen — i dag rå HP.
- `rebids.ts` `openerRebidAfterInvertedMinor`: 3NT-accept (HP/stopp) vs
  minimumsbud — i dag rå HP.

### Steg C-3 — sang-accepter på TP
Öppnaren/svararen accepterar en sanginbjudan. Balanserat → måttet är
**startpoäng** (bra ess/tior, 5-korts färg, längd – ingen kortfärg i NT).
**Mänsklig input behövs:** när väger en femkortsfärg upp en sanghand?
- `rebids.ts` `openerRebidAfterLimitedResponse` ('2NT inbjudan' → 3NT vid p≥14).
- `responses-2nt.ts` `openerRebidAfter2NTResponse` ('2NT inbjudan' → 3NT vid p≥16).
- Svararens egen sang-inbjudan vs utgång (semi-forcing 1NT-grenen, `responder-rebids.ts`).

### Steg D — TP-nudge för sangöppning
`openings.ts`: 1NT (15–17) / 2NT (20–21) / 3NT (25–27) är i dag rena HP-steg.
Ägaren valde att **låta TP nudga sang** (Q3, 2026-06-30): t.ex. en stark 14 med
femkortsfärg/bra ess räknas upp i 1NT-zonen. **Mest omdömeskrävande** – avviker
från ren 2/1; bygg sist och med tydliga exempelhänder. NB: får aldrig krocka med
öppningsgolvet (Steg A) eller sänka en hand.

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
