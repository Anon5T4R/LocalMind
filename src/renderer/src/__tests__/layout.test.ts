import { describe, expect, it } from 'vitest'
import type { MindNode } from '@shared/types'
import {
  NODE_H,
  NODE_W,
  descendantIds,
  hiddenIds,
  layoutTree,
  nodeSize,
  resolveSides
} from '../layout'

/** Atalho pra montar nós sem repetir os campos obrigatórios em todo teste. */
function node(id: string, parentId: string | null, extra: Partial<MindNode> = {}): MindNode {
  return { id, text: id, parentId, ...extra }
}

/** Caixa ocupada por um nó (posição + tamanho estimado), pra checar sobreposição. */
function box(nodes: MindNode[], id: string): { x: number; y: number; w: number; h: number } {
  const { positions } = layoutTree(nodes)
  const p = positions.get(id)!
  const { w, h } = nodeSize(nodes.find((n) => n.id === id)!)
  return { x: p.x, y: p.y, w, h }
}

describe('nodeSize', () => {
  // `width: 0` é falsy: um `n.width ?? NODE_W` deixaria o card com largura zero
  // (invisível no canvas e com o texto estourando pra fora).
  it('trata largura zero como ausente e cai na largura padrão', () => {
    expect(nodeSize(node('a', null, { width: 0 })).w).toBe(NODE_W)
    expect(nodeSize(node('a', null, { width: -50 })).w).toBe(NODE_W)
  })

  // Com largura igual ao padding horizontal, o espaço útil de texto é zero e a
  // conta de caracteres por linha dá 0 — sem o piso de 6, a divisão devolve
  // Infinity linhas e a altura contamina TODA a geometria com NaN.
  it('mantém a altura finita quando o card é estreito demais pro padding', () => {
    const h = nodeSize(node('a', null, { width: 30, text: 'x'.repeat(60) })).h
    expect(Number.isFinite(h)).toBe(true)
    expect(h).toBeGreaterThan(NODE_H)
  })

  // `fontSize: 0` também é falsy. Sem o guarda, ele vira divisor e a altura de
  // texto colapsa pra 0 — blocos de várias linhas ficariam com altura mínima e
  // se sobreporiam aos irmãos.
  it('trata fontSize zero como ausente e mede igual ao padrão', () => {
    const texto = 'a\nb\nc\nd\ne'
    const comZero = nodeSize(node('a', null, { text: texto, fontSize: 0 })).h
    const semNada = nodeSize(node('a', null, { text: texto })).h
    expect(comZero).toBe(semNada)
    expect(comZero).toBeGreaterThan(NODE_H)
  })

  // Quebras de linha explícitas contam como linhas; medir só pelo comprimento
  // total daria a mesma altura pros dois e o bloco alto invadiria o vizinho.
  it('conta quebras de linha explícitas na altura', () => {
    const umaLinha = nodeSize(node('a', null, { text: 'abcde' })).h
    const cincoLinhas = nodeSize(node('a', null, { text: 'a\nb\nc\nd\ne' })).h
    expect(cincoLinhas).toBeGreaterThan(umaLinha)
  })
})

describe('resolveSides', () => {
  it('devolve mapa vazio quando não existe raiz', () => {
    expect(resolveSides([]).size).toBe(0)
    // Floresta sem raiz: todo mundo aponta pra um pai.
    expect(resolveSides([node('a', 'x'), node('b', 'a')]).size).toBe(0)
  })

  it('alterna direita/esquerda nos filhos da raiz sem side explícito', () => {
    const nodes = [node('r', null), node('a', 'r'), node('b', 'r'), node('c', 'r'), node('d', 'r')]
    const sides = resolveSides(nodes)
    expect([sides.get('a'), sides.get('b'), sides.get('c'), sides.get('d')]).toEqual([
      'right',
      'left',
      'right',
      'left'
    ])
  })

  // 'up'/'down' são eixos próprios: se entrassem no contador de balanceamento,
  // um mapa com um ramo pra cima jogaria todo o resto pra um lado só.
  it('não deixa side vertical explícito desequilibrar o balanceamento L/R', () => {
    const nodes = [node('r', null), node('u', 'r', { side: 'up' }), node('a', 'r'), node('b', 'r')]
    const sides = resolveSides(nodes)
    expect(sides.get('u')).toBe('up')
    expect(sides.get('a')).toBe('right')
    expect(sides.get('b')).toBe('left')
  })

  // Se só os filhos diretos recebessem lado, os netos ficariam sem entrada no
  // mapa e o layout os descartaria (subárvore some da tela).
  it('propaga o lado do filho da raiz por toda a subárvore', () => {
    const nodes = [
      node('r', null),
      node('u', 'r', { side: 'up' }),
      node('filho', 'u'),
      node('neto', 'filho')
    ]
    const sides = resolveSides(nodes)
    expect(sides.get('filho')).toBe('up')
    expect(sides.get('neto')).toBe('up')
  })
})

describe('layoutTree', () => {
  it('devolve posições vazias quando não existe raiz', () => {
    expect(layoutTree([]).positions.size).toBe(0)
    expect(layoutTree([node('a', 'inexistente')]).positions.size).toBe(0)
  })

  // A raiz é o centro do sistema de coordenadas: se ela fosse ancorada em (0,0)
  // em vez de centrada, os ramos da esquerda e de cima ficariam deslocados meio
  // card em relação aos da direita e de baixo.
  it('centra a raiz na origem em vez de ancorar no canto', () => {
    const nodes = [node('r', null)]
    const { w, h } = nodeSize(nodes[0])
    expect(layoutTree(nodes).positions.get('r')).toEqual({ id: 'r', x: -w / 2, y: -h / 2 })
  })

  it('cresce pra x negativo à esquerda e positivo à direita', () => {
    const nodes = [node('r', null), node('a', 'r'), node('b', 'r')]
    const { positions, sides } = layoutTree(nodes)
    expect(sides.get('a')).toBe('right')
    expect(positions.get('a')!.x).toBeGreaterThan(0)
    expect(positions.get('b')!.x).toBeLessThan(-NODE_W)
  })

  it('cresce pra y negativo em up e positivo em down', () => {
    const nodes = [
      node('r', null),
      node('u', 'r', { side: 'up' }),
      node('d', 'r', { side: 'down' })
    ]
    const { positions } = layoutTree(nodes)
    expect(positions.get('u')!.y).toBeLessThan(-NODE_H)
    expect(positions.get('d')!.y).toBeGreaterThan(0)
  })

  // O bloco de irmãos é centrado na raiz. Sem isso (começando o empilhamento em
  // 0) o mapa cresceria só pra baixo e a raiz ficaria no topo, não no meio.
  it('centra o bloco de irmãos no eixo cruzado da raiz', () => {
    const nodes = [node('r', null), node('a', 'r', { side: 'right' }), node('b', 'r', { side: 'right' })]
    const { positions } = layoutTree(nodes)
    const centroA = positions.get('a')!.y + nodeSize(nodes[1]).h / 2
    const centroB = positions.get('b')!.y + nodeSize(nodes[2]).h / 2
    expect(centroA + centroB).toBeCloseTo(0)
  })

  // É o motivo de `extent()` existir: a faixa reservada pro irmão é a da
  // SUBÁRVORE, não a do card. Medindo só o card, um nó alto (ou com muitos
  // filhos) invadiria o irmão de baixo.
  it('não sobrepõe irmãos de alturas diferentes', () => {
    const nodes = [
      node('r', null),
      node('alto', 'r', { side: 'right', text: 'l1\nl2\nl3\nl4\nl5\nl6' }),
      node('baixo', 'r', { side: 'right' })
    ]
    const alto = box(nodes, 'alto')
    const baixo = box(nodes, 'baixo')
    expect(alto.y + alto.h).toBeLessThanOrEqual(baixo.y)
  })

  // Mesma regra um nível acima: o irmão com uma subárvore grande precisa de uma
  // faixa maior que o próprio card.
  it('reserva a faixa da subárvore inteira, não só a do card do irmão', () => {
    const nodes = [
      node('r', null),
      node('pai', 'r', { side: 'right' }),
      node('f1', 'pai'),
      node('f2', 'pai'),
      node('f3', 'pai'),
      node('vizinho', 'r', { side: 'right' })
    ]
    const f3 = box(nodes, 'f3')
    const vizinho = box(nodes, 'vizinho')
    expect(f3.y + f3.h).toBeLessThanOrEqual(vizinho.y)
  })

  // Colapsar esconde os filhos do desenho, mas o lado deles continua resolvido:
  // é o que permite reexpandir sem recalcular a direção da subárvore.
  it('não posiciona descendentes de nó colapsado, mas mantém o lado deles', () => {
    const nodes = [
      node('r', null),
      node('pai', 'r', { collapsed: true }),
      node('filho', 'pai'),
      node('neto', 'filho')
    ]
    const { positions, sides } = layoutTree(nodes)
    expect(positions.has('pai')).toBe(true)
    expect(positions.has('filho')).toBe(false)
    expect(positions.has('neto')).toBe(false)
    expect(sides.get('neto')).toBe('right')
  })

  // Raiz colapsada esconde o mapa inteiro menos ela mesma.
  it('mantém a raiz visível quando a própria raiz está colapsada', () => {
    const nodes = [node('r', null, { collapsed: true }), node('a', 'r')]
    const { positions } = layoutTree(nodes)
    expect(positions.has('r')).toBe(true)
    expect(positions.has('a')).toBe(false)
  })
})

describe('descendantIds', () => {
  // O nó pedido NÃO entra no resultado — é o que separa "esconder os filhos" de
  // "sumir com o nó colapsado junto".
  it('não inclui o próprio id e desce até o último nível', () => {
    const nodes = [node('r', null), node('a', 'r'), node('b', 'a'), node('c', 'b'), node('z', 'r')]
    const d = descendantIds(nodes, 'a')
    expect(d.has('a')).toBe(false)
    expect([...d].sort()).toEqual(['b', 'c'])
  })

  it('devolve conjunto vazio pra folha e pra id inexistente', () => {
    const nodes = [node('r', null), node('a', 'r')]
    expect(descendantIds(nodes, 'a').size).toBe(0)
    expect(descendantIds(nodes, 'fantasma').size).toBe(0)
  })
})

describe('hiddenIds', () => {
  // O bug clássico: incluir o próprio colapsado no conjunto de escondidos faz o
  // nó desaparecer da tela e o usuário perde o botão de reexpandir.
  it('esconde os descendentes do colapsado, nunca ele mesmo', () => {
    const nodes = [node('r', null), node('pai', 'r', { collapsed: true }), node('filho', 'pai')]
    const hidden = hiddenIds(nodes)
    expect(hidden.has('pai')).toBe(false)
    expect(hidden.has('filho')).toBe(true)
  })

  it('cobre a subárvore quando há colapsados aninhados', () => {
    const nodes = [
      node('r', null),
      node('a', 'r', { collapsed: true }),
      node('b', 'a', { collapsed: true }),
      node('c', 'b'),
      node('livre', 'r')
    ]
    const hidden = hiddenIds(nodes)
    expect([...hidden].sort()).toEqual(['b', 'c'])
  })

  it('devolve conjunto vazio quando nada está colapsado', () => {
    expect(hiddenIds([node('r', null), node('a', 'r')]).size).toBe(0)
  })
})
