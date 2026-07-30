---
name: deploy-verifiering
description: Rutinen för att pusha och verifiera en deploy i rebidz — kör hela Vercel-grinden lokalt FÖRE push, mät CLAUDE.md mot 16 kB-guarden på git-bloben (inte arbetsträdet, CRLF-fälla), fråga ägaren före commit/push, och bekräfta att Vercel gick Ready efteråt. Använd varje gång något ska committas, pushas eller deployas.
---

# Pusha & verifiera deploy

Koda den felbenägna rutinen. **Konkret fel den täpper till (2026-07-30):** en
CLAUDE.md-ändring committades och pushades utan att storleken mättes mot
16 kB-guarden först → grinden hade gått röd på Vercel. Mät före push, inte efter.

## Grinden (enda automatiska skyddet mellan koden och live)
`vercel.json` kör **`npx tsc && npm test && npm run build`** vid varje push till
`main`. Rött test/typfel → bygget failar → **inget publiceras**. Ändra aldrig bort
grinden. `base` i Vite MÅSTE vara `/` (annars blank sida) — låst av vaktestet.

## FÖRE commit/push — checklista
1. **Node i PATH** (nya shells har inte alltid det): i bash
   `export PATH="/c/Program Files/nodejs:$PATH"`. Node ligger i `C:\Program Files\nodejs\`.
2. **Kör hela grinden lokalt:** `npx tsc && npm test && npm run build`. Grön lokalt
   ≈ grön på Vercel — det är så du vet att pushen inte bygger rött.
3. **CLAUDE.md-fälla (CRLF):** guarden `src/docs-vakt.test.ts` mäter
   `statSync('CLAUDE.md')` på **arbetsträdet**, som på Windows har CRLF och räknar
   ~1 byte/rad för mycket. Det CI (Linux) checkar ut är **LF-bloben**. Mät därför
   den riktiga storleken innan du litar på ett lokalt rött:
   `git add CLAUDE.md && git cat-file -s :CLAUDE.md` (eller `git show HEAD:CLAUDE.md | wc -c`).
   **Under 16384 = CI passerar** även om `npm test` visar rött på just den raden.
   Filen ligger ofta nära taket — en tillagd rad kan spränga gränsen.
4. **Fråga alltid ägaren före commit/push/deploy** (projektregel, undantagslöst).
   Commit-meddelanden avslutas med `Co-Authored-By`-raden.

## EFTER push — verifiera
5. **Push ≠ live.** Bekräfta att Vercel-deployen gick **Ready** innan du säger att
   det är klart (Vercel-dashboarden, eller be ägaren titta). Kod som syns i appen:
   verifiera på **https://rebidz.com**. CLAUDE.md/docs som inte byggs in i sidan:
   enda signalen är byggstatusen.
6. **Rött bygge** → inget publiceras, förra **Ready**-deployen står kvar live. Laga
   och pusha om — inget farligt är live under tiden.

## Rollback
Varje funktion mergas med egen `--no-ff`-mergepunkt → backa med
`git revert -m 1 <merge-sha>`. Live = senaste **Ready**-deployen i Vercel-dashboarden
(ingen tag i repot).
