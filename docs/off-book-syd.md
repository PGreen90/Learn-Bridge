# Off-book Syd — datorpartnerns beteende (FAS 2 punkt 10b)

> **Definition, bekräftad av ägaren 2026-07-01 ("lås som det är").**
> Beskriver vad datorpartnern gör när du (Syd) bjuder **utanför systemlinjen**
> (off-book) i den levande budgivningen. Detta är det vanligaste läget för en
> spelare mot datorn. Beteendet bor i `src/lib/engine/auction-live.ts`
> (`offBookResponse` → `raiseWithFit` / `respondWithoutFit`) och är facit-låst i
> `auction-live.test.ts`.

## När triggar off-book-svaret?
`decideCall` följer parets kanoniska systemlinje **så länge den verkliga
budföljden inte motsagt den** (`divergedFromLine`). Så fort Syd bjudit något annat
än linjen lämnar boten linjen och svarar historiedrivet i stället för att passa.

## Beslutsordning (datorpartnern, t.ex. Nord)

1. **Har partnern visat en färg?**
   Nej → **pass** (boten hittar inte på bud ur intet; inkliv från intet hör till
   §7-försvaret, inte hit).
   Ja ↓

2. **Fit för partnerns färg?** (3 kort räcker för en **öppnad högfärg**, annars 4+)
   Ja → **höj, graderat efter stödpoäng** (`dummyPoints`):
   - 6–10 → **enkel höjning**
   - 11–12 → **inbjudande hopp**
   - 13+ → **utgång** — men bara i **högfärg** (4-läget). En **minorfit blåses
     inte ut** på 5-läget; då stannar höjningen på inbjudande hopp.
   - Höjningen **klampas till lägsta lagliga steg** om konkurrensen tryckt upp budet;
     räcker det inte ens till en enkel höjning → pass.
   Nej ↓

3. **Utan fit:**
   - **Egen 4+ färg** (billigaste läge, ny färg = inte partnerns/motståndarnas/
     egen tidigare): **1-läget** från 6 hp, **2-läget** kräver 12+ (2/1-anda),
     högre avstås.
   - annars **balanserad sang** (bara ostört): 1NT (6–10) / 2NT (11–12) / 3NT (13+).
   - annars **pass**.

## Runt omkring
- **Motståndarna tystnar inte:** när auktionen gått off-book kliver de in på
  riktigt via §7-motorn (`maybeOvercall`) och konkurrerar vidare — men bara direkt
  sits (RHO öppnade nyss). Ingen falsk balansering efter en passrunda.
- **Motståndarna svarar aldrig på *dina* bud** (de är dina motståndare, inte din
  partner) → bara pass om inget §7-läge gäller.
- **On-book är helt oförändrat** — off-book-svaret triggar aldrig när linjen håller
  (bevisat i `auction-live.test.ts`).

## Facit (arbetsregel A) — alla grenar låsta
`auction-live.test.ts`, `describe('off-book: datorpartnern svarar på Syds egna bud')`:
fit svag (2♠) / inbjudan (3♠) / utgång (4♠), egen färg 1-läget (1♥), **egen färg
2-läget kräver 12+ (2♣)**, 1NT, **2NT (11–12)**, **minorfit utan blast (3♦, inte
5♦)**, pass (<6), motståndaren svarar inte. Plus off-book i konkurrens och §7-inkliv
i egna `describe`-block.

## Avgränsning (medvetet inte nu)
Off-book-svar i vidare/kontesterade ronder breddas senare (se `docs/status.md`
"Tolkande budmotor"). Definitionen ovan är den låsta grunden.
