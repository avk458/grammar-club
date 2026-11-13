// Follow the Omarchy theme, remember where the reader stopped, and let the
// sidebar fold away.
//
// The launcher opens the app as
//   /grammar-club/?om=<background>-<foreground>-<accent>-<code>-<mode>&resume
// The palette is applied once and cached for the next start without it; with
// resume, the app reopens the last chapter and scrolls back to its position.

const PALETTE_KEY = 'grammar-club-palette'
const SIDEBAR_KEY = 'grammar-club-sidebar-hidden'
const POSITION_KEY = 'grammar-club-position'
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

  const isChapter = path => String(path).indexOf('/content/') !== -1

  const savePosition = y => {
    if (!isChapter(window.location.pathname)) return
    write(POSITION_KEY, JSON.stringify({
      path: window.location.pathname,
      y: Math.round(y === undefined ? window.scrollY : y)
    }))
  }

  let scrollTimer = 0
  window.addEventListener('scroll', () => {
    window.clearTimeout(scrollTimer)
    scrollTimer = window.setTimeout(savePosition, 400)
  }, { passive: true })
  window.addEventListener('pagehide', () => savePosition())

  // Only a chapter written by this app is a resume target.
  const saved = (() => {
    try {
      const value = JSON.parse(read(POSITION_KEY) || 'null')
      return value && isChapter(value.path) ? value : null
    } catch (e) {
      return null
    }
  })()

  const wantsResume = params.has('resume') && saved
  const needsJump = wantsResume && saved.path !== window.location.pathname

  const restoreScroll = () => {
    if (!wantsResume || window.location.hash) return
    if (window.location.pathname !== saved.path) return
    window.scrollTo(0, saved.y || 0)
  }

  if (router && router.afterEach) router.afterEach(() => savePosition(0))

  // The router scrolls to the top of a new page, so the restore waits for it
  // and for the first layout of the chapter.
  const afterLoad = () => window.setTimeout(restoreScroll, 60)
  if (router && router.onReady) {
    router.onReady(() => {
      if (!needsJump) return afterLoad()
      const done = router.replace(saved.path)
      if (done && done.then) done.then(afterLoad, afterLoad)
      else afterLoad()
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
