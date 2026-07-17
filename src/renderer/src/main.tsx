import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useLocale } from './lib/i18n'
import { initTheme } from './lib/theme'
import './styles.css'

// Aplica o tema persistido antes do primeiro render (evita flash do tema padrão).
initTheme()

// Remonta a árvore ao trocar de idioma (key={locale}) → todo t() reavalia.
function Root(): JSX.Element {
  const locale = useLocale()
  return <App key={locale} />
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
