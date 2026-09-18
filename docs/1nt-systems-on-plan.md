# Systems on efter vårt 1NT i konkurrens — ägarens spec (2026-09-18, felrapport #77)

> Ägardirektiv: *"systems on efter 1NT (konkurrensbud). Om motståndet bjuder det
> budet jag vill bjuda så betyder dubbelt motsvarande det bud motståndet lagt."*
> Alla detaljer nedan är ägarens svar på direkta frågor (rutinen 🙋 i
> `docs/arbetsrutiner.md`) — inget är Claudes gissning. **En struktur mot ALLA
> inkliv** (naturliga som konstgjorda): Lebensohl-kärnan (§7.5) och värde-X:et mot
> DONT (§7.4a) rivs.

## Svararen efter 1NT – (inkliv)
| Deras bud | Svararens verktyg |
|---|---|
| **X** | Systems on helt (Stayman, överföringar, 2♠ MSS, 2NT, 3-läget, Texas, 4NT). **XX = värden 8+**, jämn hand. |
| **2♣** | **X = Stayman** (stulet bud). I övrigt systems on. |
| **2♦** | **X = överföring till hjärter** (stulet bud). 2♥ = överföring till spader, 2♠ = MSS. Stayman är tappad: hand med fyrkorts högfärg går **jämna vägen**. |
| **2♥ / 2♠** | **X = värden 8+ med fyrkorts (andra) högfärg.** Femkorts+ högfärg och 8+ → **överföring på 3-läget: 3♦→♥, 3♥→♠** (bara högfärger; överföring in i deras färg används inte). **2♠ över 2♥ = MSS** (systems on). Svag hand (0–7) passar. |
| **3-läget+** | X = straff/värden. |

**Gäller över alla 2-lägesinkliv:**
- **Texas 4♦/4♥** (6+ högfärg, utgångsvärden, ej slam) — #77: ♠Q87 ♥KQT985 ♦Q2 ♣JT
  över (2♣) → **4♦**, öppnaren 4♥.
- **Jämn hand med värden:** med **trolig stopp** i deras färg → **2NT (8–9) / 3NT
  (10+)** som ostört. **Utan stopp → pass först**, straff-X i andra ronden om
  budgivningen kommer tillbaka.
- Bud ÖVER deras bud behåller sin ostörda betydelse (systems on).

## Öppnaren
- Efter **stulet bud-X** (Stayman / hjärteröverföring): svara som ostört.
- Efter **X = 8+ med fyrkorts högfärg** (över deras 2♥/2♠): **med fit alltid lägsta
  nivå** i den andra högfärgen; **utan fit alltid 2NT/3NT** (min/max). Aldrig
  straffpass — svararen placerar.
- Efter **överföring på 3-läget**: **alltid bara 3M**. Svararen: pass med 8–9,
  3NT (fem kort) / 4M (sex kort) med 10+.
- **Återöppning** 1NT – (2x) – pass – pass: **pass**, utom med **5+ högfärg** som
  bjuds på 2-läget (går den inte att bjuda på 2-läget: pass).

## Rivs / ändras
- §7.5 Lebensohl-kärnan (2NT-relä, direkt 3-läge = GF) — `lebensohl.ts`-vägen
  efter vårt 1NT.
- §7.4a värde-X mot DONT + öppnarens 2NT-relä (facit #39, #43) — X är inte längre
  straff på 2-läget.
- #77-mellanfixen "4M direkt" ersätts av Texas.

## Mätning — "ska 1NT-paret vinna budgivningen 9 av 10 gånger?" (ägarens fråga 2026-09-18)

```
Bash:  NTSTORT=1 npx vitest run src/lib/engine/nt-stort.probe.test.ts
```

20 000 givar (frö 20260721) → 633 där vårt 1NT störs i direkt sits; ny struktur mot
den gamla (git stash) på samma givar. DD ser alla kort — trendmätare, inte domar.

- **Vi vinner kontraktet:** gamla 54 % → nya **43 %**. Svararen passar direkt i 299
  givar (47 %; förr 165) och då vinner vi kontraktet i 4 % av fallen.
- **Poäng:** när svararen BJUDER gick snittet 72 → 161 (systemet gör sitt jobb).
  Totalt, efter åtstramningen nedan: snitt **92** mot gamla 91; par ligger på 166.
- **Tre läckor visades för ägaren, som beslöt:** (1) pass på värden + öppnaren
  passar vid återöppning → **står kvar** (medvetet: given säljs ibland). (2) straff-X
  i andra ronden var blind (8+ hp) och dubblade hem deras 2♠ → **kräver nu 8+ hp
  och 3+ kort i deras färg** (10 givar ändrade, netto +2410). (3) svag hand med
  femkortsfärg över 2♥/2♠ → **pass står kvar**.
- Givarna där 1NT passas ut redubblat ger orimliga DD-poäng (bottarna sitter kvar
  i 1NT XX) — läs aggregaten utan dem.
