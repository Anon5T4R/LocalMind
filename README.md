# TaylorMind

Clone de XMind/SimpleMind com IA — desktop (Electron + React + TypeScript). Roda modelos **locais** (arquivos `.gguf` via `node-llama-cpp`, sem precisar de LM Studio aberto) ou provedores **remotos** (Anthropic, OpenAI, Gemini, OpenAI-compatible) com a sua própria API key.

## Recursos
- Canvas de mapa mental com layout equilibrado (raiz no centro, ramos pros 4 lados), redimensionar nós, cores, recolher, undo/redo.
- IA: **gerar mapa** de um tema ou texto, **expandir** (1 nível ou profundo, sem repetir), **explicar**, **editar bloco** com instrução.
- **Chat lateral** com a IA, com inserção da resposta como nó ou sub-árvore.
- Exportar **PNG / Markdown / HTML**; salvar/abrir `.tmind`.

## Desenvolvimento
```bash
npm install      # aplica patch de compat (postinstall)
npm run dev      # abre o app em modo dev
npm run pack     # gera executável não-empacotado em release/win-unpacked
npm run dist:win # instalador + portable (Windows)
npm run dist:linux
```

## Notas
- Electron fixado em 29.4.6 (Node 20.9); `scripts/patch-deps.mjs` corrige `cli-spinners` (import attributes) no `postinstall`.
- Modelos locais não são versionados; aponte a pasta dos `.gguf` nas Configurações.

Builds de Windows e Linux são gerados pelo GitHub Actions (`.github/workflows/release.yml`) — push de uma tag `v*` publica um Release.
