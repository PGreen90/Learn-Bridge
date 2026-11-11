// "Installera appen" (nästa nivå etapp 2, 2026-11-11).
//
// Chrome, Edge och Android skickar händelsen `beforeinstallprompt` när sidan
// går att installera som app. Händelsen kommer EN gång, tidigt — därför fångas
// den här på modulnivå (modulen importeras från main.tsx) och sparas tills
// användaren trycker på knappen. Safari på iPhone skickar aldrig händelsen;
// där visas ingen knapp, och Om-sidans text om webbläsarens meny gäller.

import { useEffect, useState } from 'react'

/** Webbläsarens installationsfråga (inte standardiserad, därav egen typ). */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let sparad: InstallPrompt | null = null
const lyssnare = new Set<() => void>()
const meddela = () => lyssnare.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Stoppa webbläsarens egna minirad — vi visar en knapp där det passar.
    e.preventDefault()
    sparad = e as InstallPrompt
    meddela()
  })
  window.addEventListener('appinstalled', () => {
    sparad = null
    meddela()
  })
}

/** Kan appen installeras just nu? + funktionen som visar webbläsarens fråga. */
export function useInstallera(): { kan: boolean; installera: () => Promise<void> } {
  const [kan, setKan] = useState(sparad !== null)
  useEffect(() => {
    const uppdatera = () => setKan(sparad !== null)
    lyssnare.add(uppdatera)
    uppdatera()
    return () => {
      lyssnare.delete(uppdatera)
    }
  }, [])
  return {
    kan,
    installera: async () => {
      const fraga = sparad
      if (!fraga) return
      // Frågan får bara visas en gång per händelse.
      sparad = null
      meddela()
      await fraga.prompt()
      await fraga.userChoice.catch(() => undefined)
    },
  }
}
