import { useState } from 'react'
import { useMap } from '../store'
import type { AiActions } from '../ai/useAiActions'
import { t, type MessageKey } from '../lib/i18n'

interface Props {
  nodeId: string
  ai: AiActions
  onClose: () => void
}

const PRESET_KEYS: MessageKey[] = [
  'ask.preset.shorter',
  'ask.preset.technical',
  'ask.preset.question',
  'ask.preset.fix'
]

export function AskAiModal({ nodeId, ai, onClose }: Props): JSX.Element {
  const node = useMap((s) => s.getNode(nodeId))
  const [instruction, setInstruction] = useState('')

  const submit = async (text?: string): Promise<void> => {
    const inst = (text ?? instruction).trim()
    if (!inst) return
    await ai.rephraseNode(nodeId, inst)
    if (!ai.error) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>💬 {t('ask.title')}</h2>
        <p className="muted">
          {t('ask.current')} <strong>{node?.text}</strong>
        </p>
        <textarea
          autoFocus
          rows={3}
          placeholder={t('ask.placeholder')}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
          }}
        />
        <div className="preset-row">
          {PRESET_KEYS.map((k) => {
            const label = t(k)
            return (
              <button key={k} className="preset" onClick={() => submit(label)} disabled={ai.busy}>
                {label}
              </button>
            )
          })}
        </div>
        {ai.error && <div className="form-error">⚠ {ai.error}</div>}
        <div className="modal-actions">
          <button onClick={onClose}>{t('common.cancel')}</button>
          <button className="primary" onClick={() => submit()} disabled={ai.busy || !instruction.trim()}>
            {ai.busy ? t('ask.applying') : t('ask.apply')}
          </button>
        </div>
      </div>
    </div>
  )
}
