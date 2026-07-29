// Light/dark theme — persisted, applied via Tailwind 'dark' class on <html>
const KEY = 'mym_theme'

export type Theme = 'light' | 'dark'

export function getTheme(): Theme {
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function initTheme(): void {
  document.documentElement.classList.toggle('dark', getTheme() === 'dark')
}
