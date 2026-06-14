import { ref } from 'vue'
import type { HighlighterCore } from 'shiki/core'

// Lazily-created, shared Shiki highlighter. We use the fine-grained core + the
// (wasm-free) JavaScript regex engine and import only the languages we emit, so
// the bundle doesn't pull Shiki's full language set.

const THEME = 'github-dark'
const LANGS = ['markdown', 'javascript', 'typescript', 'tsx', 'css', 'vue', 'json'] as const

let instance: HighlighterCore | null = null
let loading: Promise<HighlighterCore> | null = null
const ready = ref(false)

function langFor(language: string): string {
  return (LANGS as readonly string[]).includes(language) ? language : 'text'
}

async function ensure(): Promise<HighlighterCore> {
  if (instance) return instance
  if (!loading) {
    loading = (async () => {
      const { createHighlighterCore } = await import('shiki/core')
      const { createJavaScriptRegexEngine } = await import('shiki/engine/javascript')
      const [md, js, ts, tsx, css, vue, json, theme] = await Promise.all([
        import('shiki/langs/markdown.mjs'),
        import('shiki/langs/javascript.mjs'),
        import('shiki/langs/typescript.mjs'),
        import('shiki/langs/tsx.mjs'),
        import('shiki/langs/css.mjs'),
        import('shiki/langs/vue.mjs'),
        import('shiki/langs/json.mjs'),
        import('shiki/themes/github-dark.mjs'),
      ])
      return createHighlighterCore({
        themes: [theme.default],
        langs: [md.default, js.default, ts.default, tsx.default, css.default, vue.default, json.default],
        engine: createJavaScriptRegexEngine(),
      })
    })()
  }
  instance = await loading
  ready.value = true
  return instance
}

export function useHighlighter() {
  void ensure()

  function highlight(code: string, language: string): string | null {
    if (!instance) return null
    return instance.codeToHtml(code, { lang: langFor(language), theme: THEME })
  }

  return { ready, highlight }
}
