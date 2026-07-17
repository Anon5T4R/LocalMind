import { t, type MessageKey } from '../lib/i18n'
import { THEMES, setTheme, useTheme, type Theme } from '../lib/theme'

/** Seletor de tema — usado na linha "Tema" das Configurações. */
export default function ThemePicker({ className = '' }: { className?: string }): JSX.Element {
  const theme = useTheme()
  return (
    <select
      className={`lang-select ${className}`.trim()}
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      title={t('theme.title')}
      aria-label={t('theme.title')}
    >
      {THEMES.map((th) => (
        <option key={th} value={th}>
          {t(`theme.${th}` as MessageKey)}
        </option>
      ))}
    </select>
  )
}
