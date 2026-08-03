/// <reference types="vite-plugin-pwa/client" />
// PWA-uppdateringen (Etapp A ur granskningen 2026-08-02). Tidigare gällde
// "autoUpdate": en ny service worker tog över TYST mitt i en session — och i
// kombination med att gamla JS-filer städas bort kunde en öppen flik få
// chunk-fel (vit sida). Nu registrerar vi arbetaren i "prompt"-läge: när en ny
// version finns visar Layout en diskret rad med en Uppdatera-knapp, och den
// gamla versionen fortsätter fungera tills användaren själv väljer (eller
// stänger fliken — nästa besök startar då på nya versionen precis som förr).
//
// Filen importeras BARA från main.tsx — inte från komponenter — så att
// testerna (vitest) aldrig behöver den virtuella modulen nedan (den finns
// bara när Vite bygger/serverar appen).
import { registerSW } from 'virtual:pwa-register'
import { NY_VERSION_EVENT, type NyVersionDetail } from './lib/sw-events'

export function setupPwaUpdate(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      window.dispatchEvent(
        new CustomEvent<NyVersionDetail>(NY_VERSION_EVENT, {
          detail: { update: () => void updateSW(true) },
        }),
      )
    },
  })
}
