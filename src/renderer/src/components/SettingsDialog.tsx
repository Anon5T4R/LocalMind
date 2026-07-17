import { useEffect, useState } from 'react'
import type { AppSettings, EngineKind, LocalModelInfo } from '@shared/types'
import { t } from '../lib/i18n'
import LocalePicker from './LocalePicker'
import ThemePicker from './ThemePicker'

interface Props {
  onClose: () => void
}

const ENGINES: { value: EngineKind; label: string }[] = [
  { value: 'local', label: 'Local (GGUF)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai-compatible', label: 'OpenAI-compatible' }
]

function gb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(2) + ' GB'
}

export function SettingsDialog({ onClose }: Props): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [models, setModels] = useState<LocalModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({})
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({})
  const [loadMsg, setLoadMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.localmind.getSettings().then(setSettings)
    refreshModels()
    for (const p of ['anthropic', 'openai', 'gemini', 'openai-compatible'] as const) {
      window.localmind.hasApiKey(p).then((has) => setKeyStatus((s) => ({ ...s, [p]: has })))
    }
    return window.localmind.onLoadProgress(({ progress, phase }) => {
      setLoadMsg(
        phase === 'context'
          ? progress >= 1
            ? t('settings.loaded')
            : t('common.preparingContext')
          : t('settings.loadProgress', { pct: Math.round(progress * 100) })
      )
    })
  }, [])

  const handleLoad = async (): Promise<void> => {
    setLoading(true)
    setLoadMsg(t('settings.starting'))
    const res = await window.localmind.loadLocalModel()
    setLoading(false)
    if (!res.ok) setLoadMsg('⚠ ' + (res.error ?? t('settings.loadFail')))
    else setLoadMsg(t('settings.loaded'))
  }

  const refreshModels = async (): Promise<void> => {
    setLoadingModels(true)
    try {
      setModels(await window.localmind.listLocalModels())
    } finally {
      setLoadingModels(false)
    }
  }

  const patch = async (p: Partial<AppSettings>): Promise<void> => {
    const next = await window.localmind.setSettings(p)
    setSettings(next)
  }

  const saveKey = async (provider: Exclude<EngineKind, 'local'>): Promise<void> => {
    const key = keyInputs[provider] ?? ''
    await window.localmind.setApiKey(provider, key)
    setKeyInputs((s) => ({ ...s, [provider]: '' }))
    setKeyStatus((s) => ({ ...s, [provider]: Boolean(key) }))
  }

  if (!settings) return <div className="modal-backdrop" />

  const engine = settings.engine

  const keyField = (
    provider: Exclude<EngineKind, 'local'>,
    label: string,
    optional = false
  ): JSX.Element => (
    <div className="field">
      <label>
        {t('settings.apiKey', { label })}{' '}
        {optional && <span className="muted">{t('settings.optional')}</span>}
        {keyStatus[provider] && <span className="ok"> {t('settings.keySaved')}</span>}
      </label>
      <div className="row">
        <input
          type="password"
          placeholder={
            keyStatus[provider] ? t('settings.keyPlaceholderSaved') : t('settings.keyPlaceholder')
          }
          value={keyInputs[provider] ?? ''}
          onChange={(e) => setKeyInputs((s) => ({ ...s, [provider]: e.target.value }))}
        />
        <button onClick={() => saveKey(provider)}>{t('settings.saveKey')}</button>
      </div>
    </div>
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>⚙ {t('settings.title')}</h2>

        <div className="field">
          <label>{t('lang.title')}</label>
          <LocalePicker />
        </div>

        <div className="field">
          <label>{t('theme.title')}</label>
          <ThemePicker />
        </div>

        <div className="field">
          <label>{t('settings.engine')}</label>
          <select
            value={engine}
            onChange={(e) => patch({ engine: e.target.value as EngineKind })}
          >
            {ENGINES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {engine === 'local' && (
          <div className="section">
            <div className="section-head">
              <h3>{t('settings.localModel')}</h3>
              <div className="row">
                <button onClick={refreshModels} disabled={loadingModels}>
                  {loadingModels ? t('settings.scanning') : `↻ ${t('settings.rescan')}`}
                </button>
                <button
                  onClick={async () => {
                    const p = await window.localmind.pickModelFile()
                    if (p) patch({ localModelPath: p })
                  }}
                >
                  {t('settings.browseGguf')}
                </button>
              </div>
            </div>
            <div className="model-list">
              {models.length === 0 && !loadingModels && (
                <p className="muted">{t('settings.noModels')}</p>
              )}
              {models.map((m) => (
                <label
                  key={m.path}
                  className={`model-item${settings.localModelPath === m.path ? ' active' : ''}${
                    m.isSidecar ? ' sidecar' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    checked={settings.localModelPath === m.path}
                    onChange={() => patch({ localModelPath: m.path })}
                  />
                  <span className="model-name">{m.name}</span>
                  <span className="model-size">{gb(m.sizeBytes)}</span>
                  {m.isSidecar && <span className="badge">sidecar</span>}
                </label>
              ))}
            </div>
            {settings.localModelPath && (
              <p className="muted small">
                {t('settings.selected', { path: settings.localModelPath })}
              </p>
            )}
            <div className="row" style={{ alignItems: 'center' }}>
              <button
                className="primary"
                disabled={loading || !settings.localModelPath}
                onClick={handleLoad}
              >
                {loading ? t('settings.loading') : `⬇ ${t('settings.loadNow')}`}
              </button>
              <button
                disabled={loading}
                onClick={async () => {
                  await window.localmind.unloadLocalModel()
                  setLoadMsg(t('settings.unloaded'))
                }}
                title={t('settings.unload.title')}
              >
                {t('settings.unload')}
              </button>
              {loadMsg && <span className="muted small">{loadMsg}</span>}
            </div>
            <div className="row">
              <label className="inline">
                {t('settings.context')}
                <input
                  type="number"
                  min={512}
                  max={32768}
                  step={512}
                  value={settings.localContextSize}
                  onChange={(e) => patch({ localContextSize: Number(e.target.value) })}
                />
              </label>
              <label className="inline">
                {t('settings.gpuLayers')}
                <input
                  type="number"
                  min={-1}
                  max={200}
                  value={settings.localGpuLayers}
                  onChange={(e) => patch({ localGpuLayers: Number(e.target.value) })}
                />
              </label>
            </div>
          </div>
        )}

        {engine === 'anthropic' && (
          <div className="section">
            <ModelField
              label={t('settings.modelOf', { name: 'Claude' })}
              value={settings.anthropic.model}
              onChange={(model) => patch({ anthropic: { ...settings.anthropic, model } })}
            />
            {keyField('anthropic', 'Anthropic')}
          </div>
        )}

        {engine === 'openai' && (
          <div className="section">
            <ModelField
              label={t('settings.modelOf', { name: 'OpenAI' })}
              value={settings.openai.model}
              onChange={(model) => patch({ openai: { ...settings.openai, model } })}
            />
            {keyField('openai', 'OpenAI')}
          </div>
        )}

        {engine === 'gemini' && (
          <div className="section">
            <ModelField
              label={t('settings.modelOf', { name: 'Gemini' })}
              value={settings.gemini.model}
              onChange={(model) => patch({ gemini: { ...settings.gemini, model } })}
            />
            {keyField('gemini', 'Gemini')}
          </div>
        )}

        {engine === 'openai-compatible' && (
          <div className="section">
            <div className="field">
              <label>Base URL</label>
              <input
                value={settings.openaiCompatible.baseUrl ?? ''}
                placeholder="http://localhost:1234/v1"
                onChange={(e) =>
                  patch({
                    openaiCompatible: { ...settings.openaiCompatible, baseUrl: e.target.value }
                  })
                }
              />
            </div>
            <ModelField
              label={t('settings.model')}
              value={settings.openaiCompatible.model}
              onChange={(model) =>
                patch({ openaiCompatible: { ...settings.openaiCompatible, model } })
              }
            />
            {keyField('openai-compatible', t('settings.ifRequired'), true)}
          </div>
        )}

        <div className="field">
          <label>{t('settings.temperature', { value: settings.temperature.toFixed(2) })}</label>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={settings.temperature}
            onChange={(e) => patch({ temperature: Number(e.target.value) })}
          />
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModelField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
