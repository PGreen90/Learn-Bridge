// Sömstället för sparad state (Beslut B etapp 0, steg 3). ALL data som appen
// sparar går genom det HÄR lagret — sidorna anropar aldrig localStorage
// (`lib/storage`) direkt längre. Poängen: i Beslut B etapp 1 byter vi
// IMPLEMENTATIONEN här (localStorage → Supabase-servern) UTAN att röra en enda
// sida. Byt alltså här, aldrig i sidorna.
//
// Lagret ligger OVANPÅ lågnivå-primitiven `lib/storage` (loadValue/saveValue/
// clearAllProgress, prefix `learnbridge:`). Vi återimplementerar inte
// localStorage — varje accessor omsluter bara loadValue/saveValue med EXAKT
// samma nyckelsträng och samma värdeform som sidorna använde förr, så bytet blir
// byte-för-byte osynligt.
//
// Gränssnittet är SYNKRONT i etapp 0 (localStorage är synkront, och flera sidor
// läser i en useState-initializer). Två grupper:
//
//   • ENHET — inställningar och pågående parti som hör hemma på just DEN HÄR
//     enheten och stannar lokalt för alltid, även när konton finns (etapp 1).
//
//   • KONTO — data som i etapp 1 flyttar till servern och knyts till kontot.
//     DESSA metoder blir ASYNKRONA då (Promise) — se TODO nedan; sidorna som
//     läser dem synkront i dag måste skrivas om till await/effekt vid det bytet.

import { clearAllProgress, loadValue, saveValue } from '../storage'
import type { Theme } from '../theme'
import type { PlaySpeed } from '../../pages/play/tempo'
import type { ContractTarget } from '../engine/contract-target'
import type { SavedGame } from '../engine/resume'
import type { DailyLog } from '../engine/daily'
import type { SpelResultat } from '../engine/spel-historik'

// ===========================================================================
// ENHET — bor lokalt för alltid (även med konto i etapp 1).
// ===========================================================================

/** Sparat läge-val: 'light'/'dark', eller null = "följ systemet". */
export function loadTheme(): Theme | null {
  return loadValue<Theme | null>('theme', null)
}
export function saveTheme(value: Theme | null): void {
  saveValue('theme', value)
}

/** Kortljuden av/på (standard PÅ). */
export function loadSound(): boolean {
  return loadValue('sound', true)
}
export function saveSound(on: boolean): void {
  saveValue('sound', on)
}

/** Speltempot (Lugn/Normal/Snabb), standard 'normal'. */
export function loadPlaySpeed(): PlaySpeed {
  return loadValue<PlaySpeed>('playSpeed', 'normal')
}
export function savePlaySpeed(speed: PlaySpeed): void {
  saveValue('playSpeed', speed)
}

/** Auto Claim av/på (standard PÅ). */
export function loadAutoClaim(): boolean {
  return loadValue('autoClaim', true)
}
export function saveAutoClaim(on: boolean): void {
  saveValue('autoClaim', on)
}

/** Kontraktväljarens valda träningsmål (standard 'random'). */
export function loadPlayTarget(): ContractTarget {
  return loadValue<ContractTarget>('play-target', 'random')
}
export function savePlayTarget(target: ContractTarget): void {
  saveValue('play-target', target)
}

/** Budstöd av/på (standard PÅ). */
export function loadBidHelp(): boolean {
  return loadValue('bidHelp', true)
}
export function saveBidHelp(on: boolean): void {
  saveValue('bidHelp', on)
}

/** Pågående parti (Etapp B). Läses som `unknown` — kallaren validerar formen
 *  med validSavedGame (gamla scheman ska falla bort tyst). null = ingen giv. */
export function loadSavedGame(): unknown {
  return loadValue<unknown>('pagaende-giv', null)
}
export function saveSavedGame(game: SavedGame | null): void {
  saveValue('pagaende-giv', game)
}

// ===========================================================================
// KONTO — lokalt NU, flyttar till servern i etapp 1.
// TODO (Beslut B etapp 1): dessa knyts till det inloggade kontot och läses/
// skrivs mot Supabase → metoderna blir ASYNKRONA (returnerar Promise). Sidorna
// som i dag läser dem synkront (Home, DagensArkiv, SpelHistorik, Play,
// BiddingPractice) måste då skrivas om till await/laddningstillstånd. Byt bara
// implementationen här — inte anropsställena i sidorna om det går att undvika.
// ===========================================================================

/** Dagens giv-loggen: givnummer → resultat (standard tomt). */
export function loadDailyLog(): DailyLog {
  return loadValue<DailyLog>('daily-log', {})
}
export function saveDailyLog(log: DailyLog): void {
  saveValue('daily-log', log)
}

/** Legacy: senaste spelade dagens-giv-numret (läses som reserv av startsidan
 *  för den som spelade innan `daily-log` fanns). null = inget sparat. */
export function loadDailyPlayed(): number | null {
  return loadValue<number | null>('daily-played', null)
}
export function saveDailyPlayed(n: number): void {
  saveValue('daily-played', n)
}

/** Frispelets resultathistorik. Läses som `unknown` — kallaren validerar med
 *  validHistorik. Standard tom lista. */
export function loadSpelHistorik(): unknown {
  return loadValue<unknown>('spel-historik', [])
}
export function saveSpelHistorik(list: SpelResultat[]): void {
  saveValue('spel-historik', list)
}

/** Ett budtemas senaste poäng ({correct, total}) — nyckeln `theme:<themeId>`. */
export interface ThemeScore {
  correct: number
  total: number
}
export function loadThemeScore(themeId: string): ThemeScore | null {
  return loadValue<ThemeScore | null>(`theme:${themeId}`, null)
}
export function saveThemeScore(themeId: string, score: ThemeScore): void {
  saveValue(`theme:${themeId}`, score)
}

// ===========================================================================
// Nollställning
// ===========================================================================

/** Radera ALLT appen sparat lokalt ("Nollställ framsteg" i Inställningar).
 *  Delegerar till lågnivå-primitiven. I etapp 1 rensar denna också konto-datan
 *  på servern (blir då async, som konto-gruppen ovan). */
export function clearAllLocalData(): void {
  clearAllProgress()
}
