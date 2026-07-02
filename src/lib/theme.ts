// Ljust/mörkt läge. Sparat val (localStorage) vinner; utan sparat val följer
// appen systemets läge. Klassen "dark" på <html> styr alla dark:-stilar
// (se @custom-variant i index.css). index.html sätter klassen redan före
// laddning så sidan aldrig blinkar vit.

import { loadValue, saveValue } from './storage'

export type Theme = 'light' | 'dark'

/** Läget just nu: sparat val om det finns, annars systemets. */
export function currentTheme(): Theme {
  const saved = loadValue<Theme | null>('theme', null)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Slå på/av mörkt läge på sidan (klassen på <html>). */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

// Timer som plockar bort toningsklassen när övergången är klar (hålls i en
// modulvariabel så snabba dubbelklick inte lämnar klassen kvar för evigt).
let fadeTimer: number | undefined

/** Växla läge, spara valet och applicera med en mjuk ~1 s toning. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
  const root = document.documentElement

  // Slå på toningen bara under själva växlingen (se .theme-fade i index.css).
  root.classList.add('theme-fade')
  window.clearTimeout(fadeTimer)
  fadeTimer = window.setTimeout(() => root.classList.remove('theme-fade'), 1100)

  saveValue('theme', next)
  applyTheme(next)
  return next
}
