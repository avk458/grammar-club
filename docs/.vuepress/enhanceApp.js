// Follow the Omarchy theme, remember where the reader stopped, and let the
// sidebar fold away.
//
// The launcher opens the app as
//   /grammar-club/?om=<background>-<foreground>-<accent>-<code>-<mode>&resume
// The palette is applied once and cached for the next start without it. With
// resume, the app reopens the last chapter and scrolls back to its position.

const PALETTE_KEY = 'grammar-club-palette'
const SIDEBAR_KEY = 'grammar-club-sidebar-hidden'
const POSITION_KEY = 'grammar-club-position'
const RESUMING_KEY = 'grammar-club-resuming'
const HEX = /^[0-9a-f]{6}$/i

function read (key) {
  try {
    return window.localStorage.getItem(key)
  } catch (e) {
    return null
  }
}

function write (key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch (e) {
    // Private mode or a full quota: the look and the position still work,
    // they are just not kept for the next start.
  }
}

// The five values arrive from the URL, so each one is checked before it is
// written into a stylesheet.
function paletteCSS (spec) {
  const parts = String(spec || '').split('-')
  const valid = parts.length === 5 &&
    parts.slice(0, 4).every(p => HEX.test(p)) &&
    /^(dark|light)$/.test(parts[4])
  if (!valid) return ''

  const [background, foreground, accent, deep, mode] = parts
  const mix = (percent, color) => `color-mix(in srgb,#${color} ${percent}%,#${background})`

  return ':root{' +
    `color-scheme:${mode};` +
    `--om-background:#${background};` +
    `--om-foreground:#${foreground};` +
    `--om-accent:#${accent};` +
    `--om-surface:${mix(5, foreground)};` +
    `--om-surface-strong:${mix(10, foreground)};` +
    `--om-border:${mix(16, foreground)};` +
    `--om-muted:${mix(55, foreground)};` +
    `--om-accent-foreground:#${background};` +
    `--om-code-background:#${deep};` +
    `--om-quote-background:color-mix(in srgb,#${accent} 14%,#${background});` +
    `--om-selection:color-mix(in srgb,#${accent} 28%,#${background})` +
    '}'
}

export default ({ router }) => {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)

  const incoming = paletteCSS(params.get('om'))
  const palette = document.createElement('style')
  palette.id = 'om-palette'
  palette.textContent = incoming || read(PALETTE_KEY) || ''
  document.head.appendChild(palette)
  if (incoming) write(PALETTE_KEY, incoming)

  // Every path here keeps the site base, as location.pathname has it.
  const pathNow = () => window.location.pathname

  const isChapter = path =>
    typeof path === 'string' && path.charAt(0) === '/' && path.indexOf('/content/') !== -1

  const savePosition = y => {
    const path = pathNow()
    if (!isChapter(path)) return
    write(POSITION_KEY, JSON.stringify({
      path,
      y: Math.round(y === undefined ? window.scrollY : y)
    }))
  }

  let scrollTimer = 0
  window.addEventListener('scroll', () => {
    window.clearTimeout(scrollTimer)
    scrollTimer = window.setTimeout(savePosition, 400)
  }, { passive: true })
  window.addEventListener('pagehide', () => savePosition())

  let saved = null
  try {
    const value = JSON.parse(read(POSITION_KEY) || 'null')
    if (value && isChapter(value.path)) saved = value
  } catch (e) {
    saved = null
  }

  // The theme scrolls smoothly; a resume jumps to the place instead of sliding
  // the whole chapter past the reader.
  const jumpToSaved = () =>
    window.scrollTo({ top: saved.y || 0, behavior: 'instant' })

  if (params.has('resume') && saved) {
    if (saved.path === pathNow() && !window.location.hash) {
      window.setTimeout(jumpToSaved, 60)
    } else if (saved.path !== pathNow()) {
      // The router adds the site base on a push, so leave through the browser
      // with the full path the position already holds.
      write(RESUMING_KEY, saved.path)
      window.location.replace(saved.path)
      return
    }
  }

  // Arrived here from the jump above: the chapter is the right one, so put the
  // reader back where they were.
  if (read(RESUMING_KEY) === pathNow() && !window.location.hash) {
    write(RESUMING_KEY, '')
    window.setTimeout(jumpToSaved, 60)
  }

  // A chapter the reader lands on keeps the position saved for it; only a step
  // to another page starts that page at the top.
  let stepped = false
  if (router && router.afterEach) {
    router.afterEach(() => {
      if (stepped) savePosition(0)
      stepped = true
    })
  }

  const root = document.documentElement
  root.classList.toggle('om-sidebar-collapsed', read(SIDEBAR_KEY) === '1')

  const addToggle = () => {
    if (document.querySelector('.om-sidebar-toggle')) return

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'om-sidebar-toggle'
    button.title = '折叠 / 展开侧栏'
    button.setAttribute('aria-label', '折叠或展开侧栏')
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z"/></svg>'
    button.addEventListener('click', () => {
      const collapsed = root.classList.toggle('om-sidebar-collapsed')
      write(SIDEBAR_KEY, collapsed ? '1' : '0')
    })
    document.body.appendChild(button)
  }

  setTimeout(addToggle, 0)
  if (router && router.afterEach) router.afterEach(addToggle)
}
