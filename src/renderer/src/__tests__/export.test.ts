import { describe, expect, it } from 'vitest'
import type { MindMap, MindNode } from '@shared/types'
import { mapToHtml, mapToMarkdown } from '../export'

function map(nodes: MindNode[]): MindMap {
  return { id: 'm', title: 'm', nodes, createdAt: 0, updatedAt: 0 }
}

function node(id: string, parentId: string | null, extra: Partial<MindNode> = {}): MindNode {
  return { id, text: id, parentId, ...extra }
}

describe('mapToMarkdown', () => {
  it('devolve string vazia quando não há raiz', () => {
    expect(mapToMarkdown(map([]))).toBe('')
    expect(mapToMarkdown(map([node('a', 'inexistente')]))).toBe('')
  })

  // Os filhos diretos da raiz ficam no nível zero (a raiz já é o `#` do título).
  // Indentar a partir de 1 geraria um bullet órfão que o parser de markdown
  // trata como bloco de código.
  it('começa a indentação em zero nos filhos da raiz e soma dois espaços por nível', () => {
    const md = mapToMarkdown(map([node('R', null), node('C', 'R'), node('G', 'C')]))
    expect(md).toBe('# R\n\n- C\n  - G\n')
  })

  // Sem o guarda no `note`, o nó sem nota sairia com um `— _undefined_` colado.
  it('só emite o sufixo de nota quando o nó tem nota', () => {
    const md = mapToMarkdown(
      map([node('R', null), node('sem', 'R'), node('com', 'R', { note: 'obs' })])
    )
    expect(md).toContain('\n- sem\n')
    expect(md).toContain('- com — _obs_')
    expect(md).not.toContain('undefined')
  })

  // Nó cujo parentId aponta pra um id que não existe mais (herança de um delete
  // parcial): a exportação percorre a partir da raiz, então ele some em silêncio.
  it('descarta nó órfão cujo pai não existe', () => {
    const md = mapToMarkdown(map([node('R', null), node('ok', 'R'), node('orfao', 'sumiu')]))
    expect(md).toContain('- ok')
    expect(md).not.toContain('orfao')
  })
})

describe('mapToHtml', () => {
  // O texto do nó é conteúdo do usuário indo direto pra dentro de um documento
  // HTML: sem escape, um `<script>` digitado num nó vira script executável no
  // arquivo exportado.
  it('escapa os metacaracteres de HTML no texto do nó', () => {
    const html = mapToHtml(map([node('R', null), node('x', 'R', { text: '<script>a & b</script>' })]))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;a &amp; b&lt;/script&gt;')
  })

  it('escapa também o texto da raiz, que vai pro <title> e pro <h1>', () => {
    const html = mapToHtml(map([node('R', null, { text: '<b>t</b>' })]))
    expect(html).not.toContain('<b>t</b>')
    expect(html).toContain('<title>&lt;b&gt;t&lt;/b&gt;</title>')
  })

  // A cor é injetada dentro de um atributo delimitado por aspas duplas: sem
  // escapar a aspa, o valor fecha o atributo e injeta HTML arbitrário.
  it('escapa a aspa da cor antes de injetar no atributo style', () => {
    const html = mapToHtml(
      map([node('R', null), node('x', 'R', { color: '#fff" onmouseover="evil()' })])
    )
    expect(html).not.toContain('onmouseover="evil()"')
    expect(html).toContain('&quot;')
  })

  it('escapa a nota, que é outro campo livre do usuário', () => {
    const html = mapToHtml(map([node('R', null), node('x', 'R', { note: '<i>n</i>' })]))
    expect(html).not.toContain('<i>n</i>')
    expect(html).toContain('&lt;i&gt;n&lt;/i&gt;')
  })

  // Um <ul> vazio em folha desenha a barra lateral da lista sem nada dentro.
  it('não emite lista vazia em nó folha', () => {
    const html = mapToHtml(map([node('R', null), node('x', 'R')]))
    expect(html).not.toContain('<ul></ul>')
  })

  it('devolve documento mínimo, sem lista, quando não há raiz', () => {
    const html = mapToHtml(map([]))
    expect(html.startsWith('<!doctype html><title>')).toBe(true)
    expect(html).not.toContain('<ul>')
  })
})
