import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const userscriptHeader = `// ==UserScript==
// @name         Page Agent Everywhere
// @namespace    https://github.com/jay-reddin89/page-agent-JR
// @version      0.6.0
// @description  Add a configurable Page Agent assistant to every webpage.
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @homepageURL  https://github.com/jay-reddin89/page-agent-JR
// @supportURL   https://github.com/jay-reddin89/page-agent-JR/issues
// @source       https://github.com/jay-reddin89/page-agent-JR/tree/feat/page-agent-userscript
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      *
// ==/UserScript==`

export default defineConfig({
  publicDir: false,
  plugins: [{
    name: 'userscript-metadata',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk' && output.isEntry) output.code = `${userscriptHeader}\n${output.code}`
      }
    },
  }],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/userscript/main.ts'),
      name: 'PageAgentUserscript',
      formats: ['iife'],
      fileName: () => 'page-agent.user.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
      onwarn(warning, warn) {
        if (warning.code === 'EVAL') return
        if (warning.message?.includes('Some chunks are larger than 500 kB')) return
        warn(warning)
      },
    },
  },
})
