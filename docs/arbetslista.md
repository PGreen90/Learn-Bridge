# Arbetslista — fullända budmotorn

> Vad som behöver på plats för att göra budmotorn (och till sist kortspelet)
> komplett. Numrerad byggordning. Punkterna **1–9** stänger **M3** (öppnarens
> återbud så att en auktion aldrig stannar redan vid öppnarens andra bud för de
> fem öppningarna 1♣/1♦/1♥/1♠/1NT).

## M3 — färdigställ öppnarens återbud (de fem öppningar vi svarar på)
1. Återbud efter **semi-forcing 1NT** (1♥/1♠–1NT) — §5.1
2. Återbud efter **enkel höjning** = Bergen game try (1♥–2♥ → 2NT) — §4.1
3. Återbud efter **2-över-1 GF** (fast arrival, naturligt) — §5.3
4. Återbud efter **Bergen-höjningar** (3♣/3♦/3 i hf) — §4.1
5. Återbud efter **tvetydig splinter** (relä → kort färg / signoff) — §4.1
6. Återbud efter **Jacoby 2NT** (kortfärg/3NT/4 i trumf) — §4.1
7. Återbud efter **inverterade minorhöjningar** (stark/svag) — §4.2
8. Återbud efter **avslutande svar** (svagt hoppskift, spärrhöjningar, 3NT) — pass/avslut
9. **1NT-grenens fullföljanden**: svar på Stayman, fullfölj Jacoby (+superaccept),
   fullfölj Texas, svar på Minor Suit Stayman — §4.3

## Svararens andra bud (så auktionerna blir hela)
10. Preferens/fortsättning efter semi-forcing 1NT — §5.1
11. Smolen + svararens rebud efter fullföljd transfer/Stayman — §4.3
12. Fjärde färg krav — §6.6

## Saknade svarsmotorer (övriga öppningar)
13. Svar på stark 2♣ (2♦ väntebud, andra negativa) — §4.4
14. Svar på svaga tvåöppningar 2♦/2♥/2♠ + Ogust — §4.5
15. Svar på spärröppningar (3-/4-läget) — §4.6
16. Svar på 2NT-öppning (Stayman/transfers, 20–21) + hantera 3NT-öppning

## Slamverktyg (§6)
17. 1430 RKC Blackwood + trumfdam-/kungfråga — §6.1
18. Cue-bid / kontrollbud — §6.2
19. Sjöbergs 5NT, Gerber, Exclusion Blackwood — §6.3–6.5
20. Drury (passad hand) — §6.7

## Konkurrens / försvarsbud (§7)
21. Inkliv + svar — §7.1
22. Tvåfärgsinkliv: Michaels + ovanlig 2NT — §7.2
23. Dubblingar: upplysning / negativ / responsiv / stöd — §7.3
24. Lebensohl — §7.4
25. DONT mot 1NT — §7.5
26. Mot stark 1♣ / Multi / svaga / spärrar — §7.6
27. Störd budgivning i auktionsmotorn (bottarna budar/dubblar/passar på riktigt)

## Kortspelet
28. Double-dummy solver (Bo Haglunds DDS i WebAssembly) — facit för stick
29. Kortspels-läge: spela ut korten mot bottar (avslut + motspel)
30. Markeringar & utspel (UDCA, Lavinthal, 3:e/5:e, honnörsutspel) — §8

## Stöd som följer med (löpande)
31. Hålfinnare utökas för varje nytt återbud/svar
32. Övningar i JSON som tränar de nya bitarna i budträningen

## Status
- ✅ M1 öppningar, M2 svar på 1♥/1♠, M3 svar på 1♣/1♦ + 1NT + §5.2
- ✅ Punkt **1–9** (öppnarens återbud efter alla svar)
- ✅ Punkt **10–12** (svararens andra bud: semi-forcing 1NT, Smolen/transfer-
  fortsättning, fjärde färg krav) – `responder-rebids.ts`
- 🔜 Nästa: punkt **13** (svar på stark 2♣, §4.4)
