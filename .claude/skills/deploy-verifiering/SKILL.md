---
name: deploy-verifiering
description: Rutinen för att pusha och verifiera en deploy i rebidz — grinden bor i GitHub Actions (ci-deploy.yml), inte vercel.json; Vercels Git-auto-deploy är frånkopplad och Actions deployar via token. Fråga ägaren före push, och verifiera efteråt att Actions-körningen gick grön (gh run watch) och aliasade rebidz.com. Använd varje gång något ska committas, pushas eller deployas.
---

# Pusha & verifiera deploy

Koda den felbenägna rutinen. Publiceringen bytte arkitektur **2026-07-30**:
grinden flyttades från `vercel.json` till **GitHub Actions**, för att Vercels
CPU-svultna byggare gav "myntkast"-röda deployer på frisk kod (bakgrund:
`docs/historik.md` + `CLAUDE.md` "Hosting & deploy").

## Så fungerar publiceringen nu
- Vid varje push till `main` kör **`.github/workflows/ci-deploy.yml`** på
  `ubuntu-latest`: `npm ci → npx tsc → npm test`. **Bara om allt är grönt**
  deployar den till Vercel-produktion (`vercel pull/build/deploy --prebuilt --prod`
  via `VERCEL_TOKEN`-hemligheten). Rött test → ingen deploy. Ändra aldrig bort den.
- **Vercels egen Git-auto-deploy är frånkopplad** — Actions är enda vägen till live.
- `vercel.json` bygger nu bara (`npm run build`). `base` i Vite MÅSTE vara `/`
  (annars blank sida) — låst av vaktestet.

## FÖRE commit/push
1. **Node i PATH** (nya shells): i bash `export PATH="/c/Program Files/nodejs:$PATH"`.
2. **Kör grinden lokalt** för att slippa vänta på ett rött moln-bygge:
   `npx tsc && npm test`. (Grinden körs pålitligt på Actions, men lokalt fångar
   uppenbara fel snabbare.)
3. **CLAUDE.md 16 kB-guarden:** `src/docs-vakt.test.ts` kräver blob < 16384 byte.
   Guarden körs nu i Actions på **Linux (LF)**, så den gamla CRLF-fällan är borta.
   Är du osäker, mät bloben: `git add CLAUDE.md && git cat-file -s :CLAUDE.md`.
   Filen ligger ibland nära taket — en tillagd rad kan spränga gränsen.
4. **Fråga alltid ägaren före commit/push/deploy** (projektregel, undantagslöst).
   Commit-meddelanden avslutas med `Co-Authored-By`-raden.

## EFTER push — verifiera (push ≠ live)
5. **Bevaka Actions-körningen tills den är grön** innan du säger att det är klart:
   `gh run list --workflow=ci-deploy.yml --limit 1` → `gh run watch <id> --exit-status`.
   Ett rött steg: `gh run view <id> --log-failed`. En grön körning aliasar
   `https://rebidz.com` (syns i deploy-stegets logg: "Aliased … Ready").
6. **Rött bygge** → inget publiceras, förra deployen står kvar live. Laga och
   pusha om — inget farligt är live under tiden.

## Rollback
Varje funktion mergas med egen `--no-ff`-mergepunkt → backa med
`git revert -m 1 <merge-sha>` och pusha; Actions bygger och deployar den bakåtrullade
koden. Live = senaste gröna Actions-deployen (ingen tag i repot).
