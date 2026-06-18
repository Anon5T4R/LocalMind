import { useState } from 'react'
import type { AiActions } from '../ai/useAiActions'

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
        <h2>✨ Gerar mapa mental</h2>
        <p className="muted">
          Escreva um tema OU cole um texto inteiro (artigo, anotações, resumo). A IA monta a árvore
          completa — isso substitui o mapa atual.
        </p>
        <textarea
          autoFocus
          rows={6}
          placeholder="Ex: 'Estratégia de lançamento de um app'  —  ou cole um texto longo para a IA estruturar em mapa."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
          }}
        />
        <div className="row">
          <label>
            Profundidade
            <input
              type="number"
              min={1}
              max={4}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
            />
          </label>
          <label>
            Ramos
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
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={submit} disabled={ai.busy || !topic.trim()}>
            {ai.busy ? 'Gerando…' : 'Gerar'}
          </button>
        </div>
        <p className="hint">Dica: Ctrl+Enter para gerar.</p>
      </div>
    </div>
  )
}
