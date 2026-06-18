import { useState } from 'react'
import { useMap } from '../store'
import type { AiActions } from '../ai/useAiActions'

interface Props {
  nodeId: string
  ai: AiActions
  onClose: () => void
}

const PRESETS = [
  'Reescreva mais curto e claro',
  'Reescreva de forma mais técnica',
  'Transforme em uma pergunta',
  'Corrija e melhore o texto'
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
        <h2>💬 Editar bloco com IA</h2>
        <p className="muted">
          Bloco atual: <strong>{node?.text}</strong>
        </p>
        <textarea
          autoFocus
          rows={3}
          placeholder="O que a IA deve fazer com este bloco? Ex: reescreva mais formal"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
          }}
        />
        <div className="preset-row">
          {PRESETS.map((p) => (
            <button key={p} className="preset" onClick={() => submit(p)} disabled={ai.busy}>
              {p}
            </button>
          ))}
        </div>
        {ai.error && <div className="form-error">⚠ {ai.error}</div>}
        <div className="modal-actions">
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={() => submit()} disabled={ai.busy || !instruction.trim()}>
            {ai.busy ? 'Aplicando…' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
