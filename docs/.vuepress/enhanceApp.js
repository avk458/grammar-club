// Follow the Omarchy theme and let the reader fold the sidebar away.
//
// The theme-set hook rewrites /omarchy-theme.css. The last copy is cached in
// localStorage so the first frame already has the right colours, then the file
// is polled so an open window follows a theme change without a reload.

const CSS_URL = '/omarchy-theme.css'
const POLL_MS = 3000
const CACHE_KEY = 'grammar-club-palette'
const SIDEBAR_KEY = 'grammar-club-sidebar-hidden'

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
    // Private mode or a full quota: the look is still correct, just not kept.
  }
}

export default ({ router }) => {
  if (typeof window === 'undefined') return

  const palette = document.createElement('style')
  palette.id = 'om-palette'
  palette.textContent = read(CACHE_KEY) || ''
  document.head.appendChild(palette)

  const refreshPalette = () => {
    window
      .fetch(`${CSS_URL}?v=${Date.now()}`)
      .then(res => (res.ok ? res.text() : ''))
      .then(css => {
        if (!css || css === palette.textContent) return
        palette.textContent = css
        write(CACHE_KEY, css)
      })
      .catch(() => {})
  }

  refreshPalette()
  window.setInterval(refreshPalette, POLL_MS)

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
