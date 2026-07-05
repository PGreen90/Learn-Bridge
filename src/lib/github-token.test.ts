// GitHub-nyckeln (för direktskick av felrapporter): läses/sparas/raderas i
// localStorage under en EGEN nyckel utanför "learnbridge:"-prefixet, så
// "Nollställ framsteg" inte råkar radera den. Test-miljön är node (ingen DOM),
// så vi stubbar en minimal localStorage.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearGithubToken,
  hasGithubToken,
  loadGithubToken,
  saveGithubToken,
} from './github-token'

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
})

describe('github-token', () => {
  it('saknar nyckel från början', () => {
    expect(loadGithubToken()).toBeNull()
    expect(hasGithubToken()).toBe(false)
  })

  it('sparar och läser tillbaka nyckeln (trimmad)', () => {
    saveGithubToken('  github_pat_ABC  ')
    expect(loadGithubToken()).toBe('github_pat_ABC')
    expect(hasGithubToken()).toBe(true)
  })

  it('tom sträng raderar nyckeln', () => {
    saveGithubToken('github_pat_ABC')
    saveGithubToken('   ')
    expect(loadGithubToken()).toBeNull()
  })

  it('clearGithubToken tar bort nyckeln', () => {
    saveGithubToken('github_pat_ABC')
    clearGithubToken()
    expect(hasGithubToken()).toBe(false)
  })

  it('lagrar under en egen nyckel utanför learnbridge:-prefixet', () => {
    saveGithubToken('github_pat_ABC')
    expect(localStorage.getItem('rebidz:felrapport-token')).toBe('github_pat_ABC')
    expect(localStorage.getItem('learnbridge:felrapport-token')).toBeNull()
  })
})
