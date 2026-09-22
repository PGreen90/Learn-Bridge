# Sunt förnuft-lagret — motorn ska inte passa blint (NU sedan 2026-09-22)

> **Ägarens oro 2026-09-22** (efter frö 20296021, där ♠AKQJ865 passade över
> 1♥–(2NT)): *"bekymrad allmänt om hur svag motorn är på att reagera … tänka och
> agera själv, inte bara slaviskt följa en förutbestämd budföljd."* Det var en av
> anledningarna till motorbytet.

## Diagnosen
Beslutstabellen (`auction-decide.ts`) är regler för KÄNDA lägen. Träffar ingen rad
blir det `pass (ingen regel)` i `decideCallTraced` — tystnad utan tanke. Det är
inte "tänka själv", det är "hitta inte regeln, passa". Motorbytet gav rätt
arkitektur (egen hand + auktionen, stol för stol); det som saknas är att tabellen
täcker lägena, och ett sista lager som resonerar när den inte gör det.

## Riggen (byggd 2026-09-22)
`src/lib/engine/sunt-fornuft.probe.test.ts` — budar N givar, fångar varje pass
utan regel och klassar läget ur `auctionFacts` + egen hand:

```
$env:SUNT='1'; npx vitest run src/lib/engine/sunt-fornuft.probe.test.ts
```
(valfritt `SUNT_N`, `SUNT_FROM`). Rapport: `revisor-output/sunt-fornuft.txt`
(+ `.json` för diff före/efter). Kategorierna A–N är HYPOTESER — läs exemplen.

**Första mätningen (8 000 givar från 20290001, 78 404 bud):** 30 421 pass utan
regel. De flesta är rätt (B "vi står i utgång" 3 255 · F1 "de står i utgång"
7 157 · J "inget att säga" 12 049). **K "krav ligger på mig" = 0** — inga
kravbud passas. De misstänkta:

| Kat. | Antal | Vad | Bedömning efter läsning |
|---|---|---|---|
| D2 | 127 | partnern bjöd, jag objuden med 6+ hp | **Hål 1 (bekräftat):** advancern över partnerns **svaga hoppinkliv** — utan stöd passar hon oavsett styrka (16–18 hp!), med 3+ stöd höjer hon ALLTID spärrande (4♣ på 18 hp med stopp, i stället för 3NT). 25 fall i mätningen, 15 med 10+ hp. |
| E2 | 944 | partnern bjöd senast, jag har bjudit, 12+ | Blandat. Bekräftade hål: XX-handen som sedan passar (20290030: 19 hp) · dubblaren som passar i utpassningssits med 16 (20290022). |
| G1 | 1 060 | de bjöd, vår sida tyst, jag har 12+ | Mest rätt (balanserad utan inkliv/X). Hål: stark hand efter deras 1x–1NT (20290076: 20 hp passar). |
| N | 1 038 | utpassningssits med 10+ | Mest rätt. Kandidat: balansering med 14–16 mot deras låga delkontrakt. |
| L | 80 | partnern dubblade, jag passar | Kan vara straff (rätt) eller tappat svar — läs. |
| M | 452 | de dubblade vårt bud, pass utan regel | Ofta rätt (pass = "spela"), men ingen regel säger det. |
| H / I | 898 / 1 417 | fit eller egen färg mot deras låga bud | Mest 6–9 hp, pass rimligt; läs de med 10+. |

## Läget
- **Hål 1 BYGGT 2026-09-22** (ägarens besked: 3NT 15+ med stopp · ny färg ej krav,
  5+ kort och 15+ · ordningen ok): `advance-jump-overcall.ts` + facit. D2 12+ gick
  32 → 19 i mätningen. Ägarens tillägg: med stöd men utan utgångsintresse
  behövs ingen höjning (pass); bjuder de 3x tävlar advancern 4m (fanns redan).
- **Nya kandidater ur resterna av D2:** advancern efter partnerns **2NT-inkliv över
  deras svaga tvåa** (20291006: 12 hp passar 2NT 15–18 → 3NT saknas) · advancern
  över partnerns inkliv av deras **svaga tvåa** (20290669, 20291572) · advancerns
  ANDRA tur när de bjuder vidare (20290750: 15 hp + solid 7-korts klöver passar
  två gånger).

## Byggordning (ägaren godkände 2026-09-22)
Principen: **mät → facit → regel**, ett hål i taget. Aldrig en enda catch-all
som "bjuder på allt" — den skulle förstöra systemriktig tystnad.

1. **Advancern över partnerns svaga hoppinkliv** (hål 1) — tydligast och
   systematiskt. Struktur = ägarens besked (frågor nedan).
2. **XX-handen och dubblaren i andra tur** (E2/N-fynden): den starka handen som
   visat styrka och sedan tystnar.
3. **Stark hand efter deras 1x–P–1NT / låga delkontrakt** (G1/N): balansering
   eller direkt aktion med 14+.
4. **Det sista lagret:** när ingen rad träffar — egen bärande färg + ovisad styrka?
   fit + poäng för nästa nivå? gemensam utgångsstyrka ej uttagen? Annars pass MED
   motivering ("inget att tillägga: …"), så tystnaden också är ett beslut.
   Vakt: lagret får aldrig återöppna ett avslut (`partnerSignedOff`) eller bjuda
   över utgång utan slamregel.

Efter varje steg: kör riggen igen, diff mot `sunt-fornuft.json`, läs de nya
auktionerna (samma metod som ovanlig 2NT-genomlysningen).

## Frågor till ägaren — hål 1 (advancern över svagt hoppinkliv, t.ex. (1♠)–3♣–(P)–?)
Hoppinklivet lovar 6+ kort och 6–10 hp (§7.1). I dag: 3+ stöd → alltid 4♣ (spärr);
utan stöd → pass utan regel.
1. **Utan stöd, stark hand (15+ med stopp i deras färg):** 3NT? Från vilken styrka?
2. **Egen färg:** ny färg på 3-läget — naturlig och krav (5+ kort, 10+ hp)? Eller
   inget eget färgbud över en spärr?
3. **Med stöd och stark hand:** när är höjningen till 5m/4M utgång i stället för
   spärr (t.ex. 3+ stöd och 14+)? Cue i deras färg som utgångsintresse?
4. **Mellanhänder (10–14, utan stöd/stopp):** pass, eller något?
