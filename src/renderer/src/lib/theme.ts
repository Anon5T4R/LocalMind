import { useSyncExternalStore } from 'react'

/**
 * Temas nomeados da UI (mesmo padrão de store externo do i18n). `default` é o
 * tema escuro original do app (o `:root` do styles.css); os demais são blocos
 * `:root[data-theme="<nome>"]` que redefinem as variáveis de cor. Persistido
 * em localStorage e aplicado via atributo `data-theme` no <html>.
 */

export const THEMES = [
  'default',
  'nature',
  'darkblue',
  'calmgreen',
  'pastelpink',
  'punkprincess'
] as const

export type Theme = (typeof THEMES)[number]

const THEME_KEY = 'localmind.theme'

function loadTheme(): Theme {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null
  return v && (THEMES as readonly string[]).includes(v) ? (v as Theme) : 'default'
}

let current: Theme = loadTheme()
const listeners = new Set<() => void>()

function apply(theme: Theme): void {
  const el = document.documentElement
  if (theme === 'default') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', theme)
}

export function getTheme(): Theme {
  return current
}

export function setTheme(theme: Theme): void {
  if (theme === current) return
  current = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* localStorage indisponível */
  }
  apply(theme)
  for (const l of listeners) l()
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Inscreve o componente nas trocas de tema. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme)
}

/** Aplica o tema persistido na inicialização (chamado no main.tsx antes do render). */
export function initTheme(): void {
  apply(current)
}
