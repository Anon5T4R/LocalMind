import { useState } from 'react'
import type { AiActions } from '../ai/useAiActions'
import { t } from '../lib/i18n'

interface Props {
  ai: AiActions
  onClose: () => void
}

export function GeneratePanel({ ai, onClose }: Props): JSX.Element {
  const [topic, setTopic] = useState('')
  const [depth, setDepth] = useState(2)
  const [breadth, setBreadth] = useState(4)

  const submit = async (): Promise<void> => {
    if (!topic.trim()) return
    await ai.generateMap(topic.trim(), depth, breadth)
    if (!ai.error) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>✨ {t('gen.title')}</h2>
        <p className="muted">{t('gen.desc')}</p>
        <textarea
          autoFocus
          rows={6}
          placeholder={t('gen.placeholder')}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
          }}
        />
        <div className="row">
          <label>
            {t('gen.depth')}
            <input
              type="number"
              min={1}
              max={4}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
            />
          </label>
          <label>
            {t('gen.breadth')}
            <input
              type="number"
              min={2}
              max={8}
              value={breadth}
              onChange={(e) => setBreadth(Number(e.target.value))}
            />
          </label>
        </div>
        {ai.error && <div className="form-error">⚠ {ai.error}</div>}
        <div className="modal-actions">
          <button onClick={onClose}>{t('common.cancel')}</button>
          <button className="primary" onClick={submit} disabled={ai.busy || !topic.trim()}>
            {ai.busy ? t('gen.generating') : t('gen.generate')}
          </button>
        </div>
        <p className="hint">{t('gen.hint')}</p>
      </div>
    </div>
  )
}
