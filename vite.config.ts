import { defineConfig, type Plugin } from 'vite'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Plugin to serve dist/page-agent.user.js during dev if requested
function serveUserscriptPlugin(): Plugin {
  return {
    name: 'serve-userscript',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/page-agent.user.js') {
          const scriptPath = resolve(__dirname, 'dist/page-agent.user.js')
          if (existsSync(scriptPath)) {
            const content = readFileSync(scriptPath, 'utf-8')
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
            res.end(content)
            return
          }
        }
        next()
      })
    },
  }
}

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
  plugins: [
    serveUserscriptPlugin(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'EVAL') return
        if (warning.message?.includes('Some chunks are larger than 500 kB')) return
        warn(warning)
      },
    },
  },
})
