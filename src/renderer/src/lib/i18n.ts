import { useSyncExternalStore } from 'react'

/**
 * i18n leve da UI (mesmo padrão do LocalPlayer/LocalPDF). `pt` é a fonte da
 * verdade das chaves; `en`/`es` como `Record<MessageKey, string>` fazem o
 * compilador recusar chave faltando ou sobrando. Locale num store externo (não
 * React) pra `t()` rodar fora de componente (toasts/erros do store, status da
 * IA, prompts do modelo…). O App remonta na troca (key={locale} no main.tsx).
 *
 * NÃO passam por aqui (são domínio/técnico): marca LocalMind, endônimos, nomes
 * de motores/provedores ("Local (GGUF)", "Anthropic (Claude)", "OpenAI",
 * "Google Gemini", "OpenAI-compatible", "Base URL"), nomes de modelos, termos
 * técnicos (GGUF, sidecar, tokens, GPU), teclas de atalho, chaves de contrato
 * JSON dos prompts, chaves de localStorage e caminhos.
 */

export type Locale = 'pt' | 'en' | 'es'

/** Endônimos — NÃO traduzir (cada idioma no seu próprio nome). */
export const LOCALE_LABELS: Record<Locale, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español'
}

/** Tag BCP-47 por locale (pra toLocaleString/datas/Intl/lang do HTML). */
const LOCALE_TAGS: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES'
}

const LOCALE_KEY = 'localmind.locale'

const pt = {
  // --- comuns ---
  'lang.title': 'Idioma',
  'theme.title': 'Tema',
  'theme.default': 'Escuro (padrão)',
  'theme.nature': 'Natureza',
  'theme.darkblue': 'Azul escuro',
  'theme.calmgreen': 'Verde calmo',
  'theme.pastelpink': 'Rosa pastel',
  'theme.punkprincess': 'PunkPrincess',
  'common.close': 'Fechar',
  'common.cancel': 'Cancelar',
  'common.delete': 'Excluir',
  'common.noColor': 'Sem cor',
  'common.preparingContext': 'Preparando contexto…',

  // --- Toolbar ---
  'tb.new': 'Novo',
  'tb.new.title': 'Novo mapa',
  'tb.open': 'Abrir',
  'tb.open.title': 'Abrir',
  'tb.save': 'Salvar',
  'tb.save.title': 'Salvar',
  'tb.saveAs': 'Salvar como…',
  'tb.saveAs.title': 'Salvar como',
  'tb.export': 'Exportar',
  'tb.export.title': 'Exportar',
  'tb.export.png': 'Imagem (PNG)',
  'tb.undo.title': 'Desfazer (Ctrl+Z)',
  'tb.redo.title': 'Refazer (Ctrl+Shift+Z)',
  'tb.addChild': '+ Filho',
  'tb.generate': 'Gerar mapa',
  'tb.expand': 'Expandir nó',
  'tb.expand.title': 'Gerar subtópicos com IA',
  'tb.chat': 'Chat',
  'tb.chat.title': 'Abrir/fechar chat com a IA',
  'tb.help':
    'Atalhos:\n' +
    'Tab = novo filho\n' +
    'Enter = novo irmão\n' +
    'F2 = editar  ·  duplo-clique = editar\n' +
    'Delete = excluir\n' +
    'Espaço = recolher/expandir\n' +
    '↑ ↓ ← → = navegar entre nós\n' +
    'Alt+↑ / Alt+↓ = reordenar irmãos\n' +
    'Alt+→ = indentar  ·  Alt+← = desindentar\n' +
    'Ctrl+Z / Ctrl+Shift+Z = desfazer/refazer',
  'tb.engine.loaded': 'Modelo local carregado',
  'tb.engine.loading': 'Carregando modelo local…',
  'tb.engine.notLoaded': 'Modelo local não carregado (carrega na 1ª geração)',
  'tb.error.title': 'Clique para fechar',
  'engine.compat': 'Compatível',
  'export.defaultTitle': 'mapa',

  // --- SettingsDialog ---
  'settings.title': 'Configurações',
  'settings.engine': 'Motor de IA',
  'settings.localModel': 'Modelo local',
  'settings.rescan': 'Re-escanear',
  'settings.scanning': 'Buscando…',
  'settings.browseGguf': 'Procurar .gguf…',
  'settings.noModels': 'Nenhum modelo encontrado. Use "Procurar .gguf…".',
  'settings.selected': 'Selecionado: {path}',
  'settings.loadNow': 'Carregar modelo agora',
  'settings.loading': 'Carregando…',
  'settings.unload': 'Descarregar',
  'settings.unload.title': 'Libera a RAM/VRAM. Trocar de modelo já faz isso automaticamente.',
  'settings.unloaded': 'Modelo descarregado',
  'settings.loaded': '✓ Modelo carregado',
  'settings.loadProgress': 'Carregando… {pct}%',
  'settings.starting': 'Iniciando…',
  'settings.loadFail': 'Falha ao carregar',
  'settings.context': 'Contexto (tokens)',
  'settings.gpuLayers': 'Camadas GPU (-1 = auto)',
  'settings.temperature': 'Temperatura: {value}',
  'settings.model': 'Modelo',
  'settings.modelOf': 'Modelo {name}',
  'settings.apiKey': 'API Key {label}',
  'settings.optional': '(opcional)',
  'settings.keySaved': '✓ salva',
  'settings.keyPlaceholderSaved': '•••••••• (já salva)',
  'settings.keyPlaceholder': 'cole sua key',
  'settings.saveKey': 'Salvar key',
  'settings.ifRequired': '(se exigida)',

  // --- GeneratePanel ---
  'gen.title': 'Gerar mapa mental',
  'gen.desc':
    'Escreva um tema OU cole um texto inteiro (artigo, anotações, resumo). A IA monta a árvore completa — isso substitui o mapa atual.',
  'gen.placeholder':
    "Ex: 'Estratégia de lançamento de um app'  —  ou cole um texto longo para a IA estruturar em mapa.",
  'gen.depth': 'Profundidade',
  'gen.breadth': 'Ramos',
  'gen.generate': 'Gerar',
  'gen.generating': 'Gerando…',
  'gen.hint': 'Dica: Ctrl+Enter para gerar.',

  // --- AskAiModal ---
  'ask.title': 'Editar bloco com IA',
  'ask.current': 'Bloco atual:',
  'ask.placeholder': 'O que a IA deve fazer com este bloco? Ex: reescreva mais formal',
  'ask.apply': 'Aplicar',
  'ask.applying': 'Aplicando…',
  'ask.preset.shorter': 'Reescreva mais curto e claro',
  'ask.preset.technical': 'Reescreva de forma mais técnica',
  'ask.preset.question': 'Transforme em uma pergunta',
  'ask.preset.fix': 'Corrija e melhore o texto',

  // --- ContextMenu ---
  'ctx.edit': 'Editar texto',
  'ctx.addChild': 'Novo filho',
  'ctx.addSibling': 'Novo irmão',
  'ctx.expandAi': 'Expandir com IA (gerar filhos)',
  'ctx.deepExpand': 'Expandir profundo (2 níveis)',
  'ctx.explain': 'Explicar (nó filho)',
  'ctx.askAi': 'Editar bloco com IA…',
  'ctx.expandBranch': 'Expandir ramo',
  'ctx.collapseBranch': 'Recolher ramo',
  'ctx.side': 'Lado',
  'ctx.side.left': 'Esquerda',
  'ctx.side.right': 'Direita',
  'ctx.side.up': 'Cima',
  'ctx.side.down': 'Baixo',
  'ctx.font': 'Fonte',
  'ctx.widthReset': 'Largura padrão',
  'ctx.color': 'Cor',

  // --- MindNodeView ---
  'node.new': 'Novo nó',
  'node.branchUp': 'Novo ramo acima',
  'node.branchDown': 'Novo ramo abaixo',
  'node.branchLeft': 'Novo ramo à esquerda',
  'node.branchRight': 'Novo ramo à direita',
  'node.expand': 'Expandir',
  'node.collapse': 'Recolher',
  'node.resize': 'Arraste para mudar a largura',

  // --- ChatPanel ---
  'chat.title': 'Chat com IA',
  'chat.loadingModel': 'Carregando modelo… {pct}%',
  'chat.resize.title': 'Ampliar / reduzir',
  'chat.clear': 'Limpar conversa',
  'chat.empty':
    'Converse com a IA (usa o mesmo motor configurado). Peça ideias, estruturas, textos — e copie ou insira no mapa.',
  'chat.copy': 'Copiar',
  'chat.asNode': '＋ nó',
  'chat.asNode.title': 'Adiciona como 1 nó filho do selecionado',
  'chat.asBranch': '＋ ramo',
  'chat.asBranch.title': 'Insere a resposta inteira como sub-árvore (entende listas/tópicos)',
  'chat.resizePanel.title': 'Arraste para redimensionar',
  'chat.composer.placeholder': 'Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)',
  'chat.stop': 'Parar',
  'chat.send': 'Enviar',
  'chat.system':
    'Você é um assistente dentro de um app de mapas mentais (LocalMind). ' +
    'Responda em português do Brasil, de forma clara e organizada. ' +
    'Use listas e tópicos quando ajudar. Pode sugerir estruturas de mapa mental.',

  // --- status/erros da IA (useAiActions/prompts) ---
  'ai.status.generatingMap': 'Gerando mapa…',
  'ai.status.expanding': 'Expandindo "{text}"…',
  'ai.status.deepExpanding': 'Expandindo "{text}" em profundidade…',
  'ai.status.explaining': 'Explicando "{text}"…',
  'ai.status.rephrasing': 'Reescrevendo…',
  'ai.err.noNodes': 'Modelo não retornou nós.',
  'ai.err.noSubtopics': 'Nenhum subtópico retornado.',
  'ai.err.nothing': 'Nada gerado.',
  'ai.err.noJson': 'O modelo não retornou JSON válido. Resposta: {resp}',

  // --- export / store (rótulos gerados na criação) ---
  'export.empty': 'Vazio',
  'map.new': 'Novo mapa',
  'node.central': 'Ideia central'
} as const

export type MessageKey = keyof typeof pt

const en: Record<MessageKey, string> = {
  'lang.title': 'Language',
  'theme.title': 'Theme',
  'theme.default': 'Dark (default)',
  'theme.nature': 'Nature',
  'theme.darkblue': 'Dark blue',
  'theme.calmgreen': 'Calm green',
  'theme.pastelpink': 'Pastel pink',
  'theme.punkprincess': 'PunkPrincess',
  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.noColor': 'No color',
  'common.preparingContext': 'Preparing context…',

  'tb.new': 'New',
  'tb.new.title': 'New map',
  'tb.open': 'Open',
  'tb.open.title': 'Open',
  'tb.save': 'Save',
  'tb.save.title': 'Save',
  'tb.saveAs': 'Save as…',
  'tb.saveAs.title': 'Save as',
  'tb.export': 'Export',
  'tb.export.title': 'Export',
  'tb.export.png': 'Image (PNG)',
  'tb.undo.title': 'Undo (Ctrl+Z)',
  'tb.redo.title': 'Redo (Ctrl+Shift+Z)',
  'tb.addChild': '+ Child',
  'tb.generate': 'Generate map',
  'tb.expand': 'Expand node',
  'tb.expand.title': 'Generate subtopics with AI',
  'tb.chat': 'Chat',
  'tb.chat.title': 'Open/close AI chat',
  'tb.help':
    'Shortcuts:\n' +
    'Tab = new child\n' +
    'Enter = new sibling\n' +
    'F2 = edit  ·  double-click = edit\n' +
    'Delete = delete\n' +
    'Space = collapse/expand\n' +
    '↑ ↓ ← → = navigate between nodes\n' +
    'Alt+↑ / Alt+↓ = reorder siblings\n' +
    'Alt+→ = indent  ·  Alt+← = outdent\n' +
    'Ctrl+Z / Ctrl+Shift+Z = undo/redo',
  'tb.engine.loaded': 'Local model loaded',
  'tb.engine.loading': 'Loading local model…',
  'tb.engine.notLoaded': 'Local model not loaded (loads on first generation)',
  'tb.error.title': 'Click to close',
  'engine.compat': 'Compatible',
  'export.defaultTitle': 'map',

  'settings.title': 'Settings',
  'settings.engine': 'AI engine',
  'settings.localModel': 'Local model',
  'settings.rescan': 'Re-scan',
  'settings.scanning': 'Scanning…',
  'settings.browseGguf': 'Browse .gguf…',
  'settings.noModels': 'No models found. Use "Browse .gguf…".',
  'settings.selected': 'Selected: {path}',
  'settings.loadNow': 'Load model now',
  'settings.loading': 'Loading…',
  'settings.unload': 'Unload',
  'settings.unload.title': 'Frees RAM/VRAM. Switching models already does this automatically.',
  'settings.unloaded': 'Model unloaded',
  'settings.loaded': '✓ Model loaded',
  'settings.loadProgress': 'Loading… {pct}%',
  'settings.starting': 'Starting…',
  'settings.loadFail': 'Failed to load',
  'settings.context': 'Context (tokens)',
  'settings.gpuLayers': 'GPU layers (-1 = auto)',
  'settings.temperature': 'Temperature: {value}',
  'settings.model': 'Model',
  'settings.modelOf': '{name} model',
  'settings.apiKey': 'API Key {label}',
  'settings.optional': '(optional)',
  'settings.keySaved': '✓ saved',
  'settings.keyPlaceholderSaved': '•••••••• (already saved)',
  'settings.keyPlaceholder': 'paste your key',
  'settings.saveKey': 'Save key',
  'settings.ifRequired': '(if required)',

  'gen.title': 'Generate mind map',
  'gen.desc':
    'Write a topic OR paste a whole text (article, notes, summary). The AI builds the full tree — this replaces the current map.',
  'gen.placeholder':
    "E.g. 'Launch strategy for an app'  —  or paste a long text for the AI to structure into a map.",
  'gen.depth': 'Depth',
  'gen.breadth': 'Branches',
  'gen.generate': 'Generate',
  'gen.generating': 'Generating…',
  'gen.hint': 'Tip: Ctrl+Enter to generate.',

  'ask.title': 'Edit block with AI',
  'ask.current': 'Current block:',
  'ask.placeholder': 'What should the AI do with this block? E.g. rewrite it more formally',
  'ask.apply': 'Apply',
  'ask.applying': 'Applying…',
  'ask.preset.shorter': 'Rewrite it shorter and clearer',
  'ask.preset.technical': 'Rewrite it more technically',
  'ask.preset.question': 'Turn it into a question',
  'ask.preset.fix': 'Fix and improve the text',

  'ctx.edit': 'Edit text',
  'ctx.addChild': 'New child',
  'ctx.addSibling': 'New sibling',
  'ctx.expandAi': 'Expand with AI (generate children)',
  'ctx.deepExpand': 'Deep expand (2 levels)',
  'ctx.explain': 'Explain (child node)',
  'ctx.askAi': 'Edit block with AI…',
  'ctx.expandBranch': 'Expand branch',
  'ctx.collapseBranch': 'Collapse branch',
  'ctx.side': 'Side',
  'ctx.side.left': 'Left',
  'ctx.side.right': 'Right',
  'ctx.side.up': 'Up',
  'ctx.side.down': 'Down',
  'ctx.font': 'Font',
  'ctx.widthReset': 'Default width',
  'ctx.color': 'Color',

  'node.new': 'New node',
  'node.branchUp': 'New branch above',
  'node.branchDown': 'New branch below',
  'node.branchLeft': 'New branch to the left',
  'node.branchRight': 'New branch to the right',
  'node.expand': 'Expand',
  'node.collapse': 'Collapse',
  'node.resize': 'Drag to change the width',

  'chat.title': 'AI chat',
  'chat.loadingModel': 'Loading model… {pct}%',
  'chat.resize.title': 'Expand / shrink',
  'chat.clear': 'Clear conversation',
  'chat.empty':
    'Chat with the AI (uses the same configured engine). Ask for ideas, structures, text — and copy or insert into the map.',
  'chat.copy': 'Copy',
  'chat.asNode': '＋ node',
  'chat.asNode.title': 'Adds it as one child node of the selected one',
  'chat.asBranch': '＋ branch',
  'chat.asBranch.title': 'Inserts the whole answer as a subtree (understands lists/bullets)',
  'chat.resizePanel.title': 'Drag to resize',
  'chat.composer.placeholder': 'Type a message… (Enter sends, Shift+Enter for a new line)',
  'chat.stop': 'Stop',
  'chat.send': 'Send',
  'chat.system':
    'You are an assistant inside a mind mapping app (LocalMind). ' +
    'Reply in English, clearly and in an organized way. ' +
    'Use lists and bullet points when helpful. You can suggest mind map structures.',

  'ai.status.generatingMap': 'Generating map…',
  'ai.status.expanding': 'Expanding "{text}"…',
  'ai.status.deepExpanding': 'Deep-expanding "{text}"…',
  'ai.status.explaining': 'Explaining "{text}"…',
  'ai.status.rephrasing': 'Rewriting…',
  'ai.err.noNodes': 'The model returned no nodes.',
  'ai.err.noSubtopics': 'No subtopics returned.',
  'ai.err.nothing': 'Nothing generated.',
  'ai.err.noJson': 'The model did not return valid JSON. Response: {resp}',

  'export.empty': 'Empty',
  'map.new': 'New map',
  'node.central': 'Central idea'
}

const es: Record<MessageKey, string> = {
  'lang.title': 'Idioma',
  'theme.title': 'Tema',
  'theme.default': 'Oscuro (predeterminado)',
  'theme.nature': 'Naturaleza',
  'theme.darkblue': 'Azul oscuro',
  'theme.calmgreen': 'Verde tranquilo',
  'theme.pastelpink': 'Rosa pastel',
  'theme.punkprincess': 'PunkPrincess',
  'common.close': 'Cerrar',
  'common.cancel': 'Cancelar',
  'common.delete': 'Eliminar',
  'common.noColor': 'Sin color',
  'common.preparingContext': 'Preparando contexto…',

  'tb.new': 'Nuevo',
  'tb.new.title': 'Nuevo mapa',
  'tb.open': 'Abrir',
  'tb.open.title': 'Abrir',
  'tb.save': 'Guardar',
  'tb.save.title': 'Guardar',
  'tb.saveAs': 'Guardar como…',
  'tb.saveAs.title': 'Guardar como',
  'tb.export': 'Exportar',
  'tb.export.title': 'Exportar',
  'tb.export.png': 'Imagen (PNG)',
  'tb.undo.title': 'Deshacer (Ctrl+Z)',
  'tb.redo.title': 'Rehacer (Ctrl+Shift+Z)',
  'tb.addChild': '+ Hijo',
  'tb.generate': 'Generar mapa',
  'tb.expand': 'Expandir nodo',
  'tb.expand.title': 'Generar subtemas con IA',
  'tb.chat': 'Chat',
  'tb.chat.title': 'Abrir/cerrar el chat con la IA',
  'tb.help':
    'Atajos:\n' +
    'Tab = nuevo hijo\n' +
    'Enter = nuevo hermano\n' +
    'F2 = editar  ·  doble clic = editar\n' +
    'Delete = eliminar\n' +
    'Espacio = contraer/expandir\n' +
    '↑ ↓ ← → = navegar entre nodos\n' +
    'Alt+↑ / Alt+↓ = reordenar hermanos\n' +
    'Alt+→ = sangrar  ·  Alt+← = quitar sangría\n' +
    'Ctrl+Z / Ctrl+Shift+Z = deshacer/rehacer',
  'tb.engine.loaded': 'Modelo local cargado',
  'tb.engine.loading': 'Cargando modelo local…',
  'tb.engine.notLoaded': 'Modelo local no cargado (se carga en la 1ª generación)',
  'tb.error.title': 'Haz clic para cerrar',
  'engine.compat': 'Compatible',
  'export.defaultTitle': 'mapa',

  'settings.title': 'Configuración',
  'settings.engine': 'Motor de IA',
  'settings.localModel': 'Modelo local',
  'settings.rescan': 'Reescanear',
  'settings.scanning': 'Buscando…',
  'settings.browseGguf': 'Buscar .gguf…',
  'settings.noModels': 'No se encontró ningún modelo. Usa "Buscar .gguf…".',
  'settings.selected': 'Seleccionado: {path}',
  'settings.loadNow': 'Cargar modelo ahora',
  'settings.loading': 'Cargando…',
  'settings.unload': 'Descargar',
  'settings.unload.title': 'Libera la RAM/VRAM. Cambiar de modelo ya lo hace automáticamente.',
  'settings.unloaded': 'Modelo descargado',
  'settings.loaded': '✓ Modelo cargado',
  'settings.loadProgress': 'Cargando… {pct}%',
  'settings.starting': 'Iniciando…',
  'settings.loadFail': 'Error al cargar',
  'settings.context': 'Contexto (tokens)',
  'settings.gpuLayers': 'Capas GPU (-1 = auto)',
  'settings.temperature': 'Temperatura: {value}',
  'settings.model': 'Modelo',
  'settings.modelOf': 'Modelo {name}',
  'settings.apiKey': 'API Key {label}',
  'settings.optional': '(opcional)',
  'settings.keySaved': '✓ guardada',
  'settings.keyPlaceholderSaved': '•••••••• (ya guardada)',
  'settings.keyPlaceholder': 'pega tu key',
  'settings.saveKey': 'Guardar key',
  'settings.ifRequired': '(si se requiere)',

  'gen.title': 'Generar mapa mental',
  'gen.desc':
    'Escribe un tema O pega un texto entero (artículo, notas, resumen). La IA construye el árbol completo — esto reemplaza el mapa actual.',
  'gen.placeholder':
    "Ej: 'Estrategia de lanzamiento de una app'  —  o pega un texto largo para que la IA lo estructure en un mapa.",
  'gen.depth': 'Profundidad',
  'gen.breadth': 'Ramas',
  'gen.generate': 'Generar',
  'gen.generating': 'Generando…',
  'gen.hint': 'Consejo: Ctrl+Enter para generar.',

  'ask.title': 'Editar bloque con IA',
  'ask.current': 'Bloque actual:',
  'ask.placeholder': '¿Qué debe hacer la IA con este bloque? Ej: reescríbelo más formal',
  'ask.apply': 'Aplicar',
  'ask.applying': 'Aplicando…',
  'ask.preset.shorter': 'Reescríbelo más corto y claro',
  'ask.preset.technical': 'Reescríbelo de forma más técnica',
  'ask.preset.question': 'Conviértelo en una pregunta',
  'ask.preset.fix': 'Corrige y mejora el texto',

  'ctx.edit': 'Editar texto',
  'ctx.addChild': 'Nuevo hijo',
  'ctx.addSibling': 'Nuevo hermano',
  'ctx.expandAi': 'Expandir con IA (generar hijos)',
  'ctx.deepExpand': 'Expandir en profundidad (2 niveles)',
  'ctx.explain': 'Explicar (nodo hijo)',
  'ctx.askAi': 'Editar bloque con IA…',
  'ctx.expandBranch': 'Expandir rama',
  'ctx.collapseBranch': 'Contraer rama',
  'ctx.side': 'Lado',
  'ctx.side.left': 'Izquierda',
  'ctx.side.right': 'Derecha',
  'ctx.side.up': 'Arriba',
  'ctx.side.down': 'Abajo',
  'ctx.font': 'Fuente',
  'ctx.widthReset': 'Ancho predeterminado',
  'ctx.color': 'Color',

  'node.new': 'Nuevo nodo',
  'node.branchUp': 'Nueva rama arriba',
  'node.branchDown': 'Nueva rama abajo',
  'node.branchLeft': 'Nueva rama a la izquierda',
  'node.branchRight': 'Nueva rama a la derecha',
  'node.expand': 'Expandir',
  'node.collapse': 'Contraer',
  'node.resize': 'Arrastra para cambiar el ancho',

  'chat.title': 'Chat con IA',
  'chat.loadingModel': 'Cargando modelo… {pct}%',
  'chat.resize.title': 'Ampliar / reducir',
  'chat.clear': 'Limpiar conversación',
  'chat.empty':
    'Conversa con la IA (usa el mismo motor configurado). Pide ideas, estructuras, textos — y cópialos o insértalos en el mapa.',
  'chat.copy': 'Copiar',
  'chat.asNode': '＋ nodo',
  'chat.asNode.title': 'Lo añade como 1 nodo hijo del seleccionado',
  'chat.asBranch': '＋ rama',
  'chat.asBranch.title': 'Inserta la respuesta entera como subárbol (entiende listas/viñetas)',
  'chat.resizePanel.title': 'Arrastra para redimensionar',
  'chat.composer.placeholder': 'Escribe un mensaje… (Enter envía, Shift+Enter salto de línea)',
  'chat.stop': 'Detener',
  'chat.send': 'Enviar',
  'chat.system':
    'Eres un asistente dentro de una app de mapas mentales (LocalMind). ' +
    'Responde en español, de forma clara y organizada. ' +
    'Usa listas y viñetas cuando ayude. Puedes sugerir estructuras de mapa mental.',

  'ai.status.generatingMap': 'Generando mapa…',
  'ai.status.expanding': 'Expandiendo "{text}"…',
  'ai.status.deepExpanding': 'Expandiendo "{text}" en profundidad…',
  'ai.status.explaining': 'Explicando "{text}"…',
  'ai.status.rephrasing': 'Reescribiendo…',
  'ai.err.noNodes': 'El modelo no devolvió nodos.',
  'ai.err.noSubtopics': 'No se devolvió ningún subtema.',
  'ai.err.nothing': 'Nada generado.',
  'ai.err.noJson': 'El modelo no devolvió JSON válido. Respuesta: {resp}',

  'export.empty': 'Vacío',
  'map.new': 'Nuevo mapa',
  'node.central': 'Idea central'
}

const DICTS: Record<Locale, Record<MessageKey, string>> = { pt, en, es }

/** Palpite de locale pelo idioma do sistema (só no 1º uso). */
export function detectLocale(): Locale {
  const l = (typeof navigator !== 'undefined' ? navigator.language : 'pt').toLowerCase()
  if (l.startsWith('en')) return 'en'
  if (l.startsWith('es')) return 'es'
  return 'pt'
}

function loadLocale(): Locale {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_KEY) : null
  return v === 'pt' || v === 'en' || v === 'es' ? v : detectLocale()
}

let current: Locale = loadLocale()
const listeners = new Set<() => void>()

export function getLocale(): Locale {
  return current
}

export function setLocale(locale: Locale): void {
  if (locale === current) return
  current = locale
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    /* localStorage indisponível */
  }
  for (const l of listeners) l()
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Inscreve o componente nas trocas de locale. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale)
}

/** Tag BCP-47 do locale atual ("pt-BR"/"en-US"/"es-ES"). */
export function localeTag(): string {
  return LOCALE_TAGS[current]
}

/** Traduz uma chave, interpolando placeholders `{param}`. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let msg: string = DICTS[current][key] ?? pt[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.split(`{${k}}`).join(String(v))
    }
  }
  return msg
}
