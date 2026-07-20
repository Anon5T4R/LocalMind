import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Os módulos testados (renderer) usam os alias que o electron-vite declara em
// `electron.vite.config.ts`. O vitest não lê aquele arquivo, então os alias
// precisam ser repetidos aqui — sem isso, `import '@shared/types'` não resolve.
export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    // Ambiente node: os módulos sob teste são lógica pura (geometria e
    // serialização) e não tocam DOM. `mapToPngDataUrl` (canvas) fica de fora.
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts']
  }
})
