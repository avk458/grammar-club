#!/usr/bin/env node
// Build an offline EPUB from the chapter sources.
//
// The web app reveals each answer with a Vue component, which Foliate does not
// run. Here every question becomes a native <details> element: no script, and
// it opens on click in any reader. Run with `npm run epub`.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import MarkdownIt from 'markdown-it'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = join(root, 'docs/content')
const publicDir = join(root, 'docs/.vuepress/public')
const outDir = join(root, 'dist')
const buildDir = join(outDir, 'epub')
const bookPath = join(outDir, 'grammar-club.epub')

const TITLE = '语法俱乐部'
const AUTHOR = '旋元佑'
const LETTERS = 'ABCD'

const chapters = [
  'Preface',
  'Introduction',
  'Contents',
  ...Array.from({ length: 22 }, (_, i) => `Chapter${String(i + 1).padStart(2, '0')}`)
]
const hrefFor = name => `ch-${name.toLowerCase()}.xhtml`

// Ampersands that start no entity are invalid XHTML and break the package.
const NAMED_ENTITIES = { nbsp: '#160', emsp: '#8195', ensp: '#8194', mdash: '#8212', ndash: '#8211', hellip: '#8230' }
const entitySafe = text => text
  // XML defines only lt, gt, amp, apos and quot; the HTML names in the text
  // have to become character references.
  .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name] ? `&${NAMED_ENTITIES[name]};` : match)
  .replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]*;)/g, '&amp;')

const escapeHtml = text =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---- Vue component attributes -------------------------------------------------

function attributes (text) {
  const out = {}
  let i = 0
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++
    if (i >= text.length) break

    const name = /^[:a-zA-Z][-\w]*/.exec(text.slice(i))
    if (!name) { i++; continue }
    const key = name[0].replace(/^:/, '')
    i += name[0].length

    while (i < text.length && /\s/.test(text[i])) i++
    if (text[i] !== '=') { out[key] = true; continue }
    i++
    while (i < text.length && /\s/.test(text[i])) i++

    const quote = text[i]
    let value = ''
    if (quote === '"' || quote === "'") {
      let j = i + 1
      while (j < text.length && text[j] !== quote) {
        if (text[j] === '\\' && text[j + 1] === quote) { value += quote; j += 2 } else { value += text[j]; j++ }
      }
      i = j + 1
    } else {
      const bare = /^\S+/.exec(text.slice(i))
      value = bare ? bare[0] : ''
      i += value.length
    }
    out[key] = value
  }
  return out
}

// :c="['a', 'b\'c']" holds a JavaScript array literal.
function choices (source) {
  const body = String(source).trim().replace(/^\[/, '').replace(/\]$/, '')
  const items = []
  let current = ''
  let quote = ''
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (quote) {
      if (char === '\\' && (body[i + 1] === quote || body[i + 1] === '\\')) { current += body[i + 1]; i++ } else if (char === quote) quote = ''
      else current += char
    } else if (char === '"' || char === "'") quote = char
    else if (char === ',') { items.push(current.trim()); current = '' } else current += char
  }
  if (current.trim()) items.push(current.trim())
  return items.filter(Boolean)
}

// ---- Component rewrites -------------------------------------------------------

// <Test> and <Tense> become finished HTML, parked behind a token that markdown
// passes through untouched; the tokens are swapped back after rendering.
function makeCollector () {
  const blocks = []
  return {
    blocks,
    keep: html => { blocks.push(html); return `QQBLOCK${blocks.length - 1}QQX` }
  }
}

function readTest (source, at) {
  let i = at + '<Test'.length
  let quote = ''
  while (i < source.length) {
    const char = source[i]
    if (quote) {
      if (char === '\\') { i += 2; continue }
      if (char === quote) quote = ''
      i++
      continue
    }
    if (char === '"' || char === "'") { quote = char; i++; continue }
    if (char === '>') break
    i++
  }

  const attrs = attributes(source.slice(at + '<Test'.length, i))
  const after = i + 1
  if (source.startsWith('</Test>', after)) return { attrs, content: '', end: after + 7 }

  const close = source.indexOf('</Test>', after)
  if (close === -1) return { attrs, content: '', end: after }
  return { attrs, content: source.slice(after, close), end: close + 7 }
}

function details (summary, body) {
  return `<details class="test"><summary>${summary}</summary>${body}</details>`
}

function renderTest (attrs, content, keep) {
  const question = attrs.q || ''
  const explanation = content.trim()

  // An exercise with no answer at all, such as the Chapter 17 rewrite drills.
  const bare = !attrs.q && !attrs.a && !attrs.c
  if (bare && !attrs.n) return keep(`<p>${explanation}</p>`)

  const options = attrs.c
    ? `<ol class="choices">${choices(attrs.c).map((item, i) => `<li>${escapeHtml(LETTERS[i] || '')}. ${escapeHtml(item)}</li>`).join('')}</ol>`
    : ''
  const answer = attrs.a ? `<p class="answer"><b>${escapeHtml(attrs.a)}</b></p>` : ''
  const hasAnswer = Boolean(answer || explanation)

  // A multiple-choice quiz keeps its question and options in view, the way the
  // web app does; only the answer is behind the disclosure.
  if (options) {
    const toggle = hasAnswer
      ? `<details class="answer-toggle"><summary>答案</summary>${answer}${explanation ? `<div class="explain">${explanation}</div>` : ''}</details>`
      : ''
    return keep(`<div class="test">${question ? `<p class="tests-q">${question}</p>` : ''}${options}${toggle}</div>`)
  }

  if (!hasAnswer) return keep(`<div class="test">${question ? `<p>${question}</p>` : ''}</div>`)

  return keep(details(question || '答案', answer + (explanation ? `<div class="explain">${explanation}</div>` : '')))
}

// <Quote> and <Card> only add a background in the web app. As blockquote
// markdown their contents keep rendering (lists, bold) in the book as well.
function toBlockquote (markdown) {
  return markdown
    .split('\n')
    .map(line => (line.trim() ? `> ${line}` : '>'))
    .join('\n')
}

function transformTests (source, keep) {
  let out = ''
  let i = 0
  while (i < source.length) {
    const at = source.indexOf('<Test', i)
    if (at === -1) { out += source.slice(i); break }
    out += source.slice(i, at)

    const node = readTest(source, at)
    i = node.end

    // Chapter 17 alternates an exercise with its rewritten sentence; a
    // two-column drill, so pair them into one revealable answer.
    if (node.attrs.n && node.content.trim()) {
      const rest = source.slice(i)
      const nextAt = i + /^\s*/.exec(rest)[0].length
      if (source.startsWith('<Test', nextAt)) {
        const next = readTest(source, nextAt)
        if (!next.attrs.q && !next.attrs.a && !next.attrs.c && !next.attrs.n && next.content.trim()) {
          out += keep(details(node.content.trim(), `<div class="explain">${next.content.trim()}</div>`))
          i = next.end
          continue
        }
      }
    }

    out += renderTest(node.attrs, node.content, keep)
  }
  return out
}

function rewrite (source, keep, images) {
  let text = source.replace(/^---\n[\s\S]*?\n---\n/, '')

  // Links between chapters point at .md files that the book does not carry.
  text = text.replace(/\]\(([\w.]+)\.md(#[^)]*)?\)/g, (match, name) => {
    const target = chapters.find(chapter => chapter.toLowerCase() === name.toLowerCase())
    return target ? `](${hrefFor(target)})` : match
  })

  text = text.replace(/<Tense\s+img="([^"]+)"\s*\/>/g, (match, src) => {
    const file = basename(src)
    images.add(file)
    return keep(`<div class="tense"><img src="images/${file}" alt=""/></div>`)
  })

  text = text.replace(/<Quote>([\s\S]*?)<\/Quote>/g, (match, inner) => toBlockquote(inner))
  text = text.replace(/<Card>([\s\S]*?)<\/Card>/g, (match, inner) => toBlockquote(inner))

  text = text.replace(/<Note([^>]*)>([\s\S]*?)<\/Note>/g, (match, rawAttrs, inner) => {
    // The web app stacks the annotated word and its grammar tag in an
    // inline-grid, so the tag sits under the word. Grid does the same here.
    const note = attributes(rawAttrs).note
    const tag = note ? `<span class="note-tag">${escapeHtml(note)}</span>` : ''
    return `<span class="note"><span class="note-word">${inner}</span>${tag}</span>`
  })

  return transformTests(text, keep)
}

// ---- Book assembly ------------------------------------------------------------

const markdown = new MarkdownIt({ html: true, xhtmlOut: true, linkify: false, typographer: false })

function renderChapter (name, images) {
  const raw = readFileSync(join(contentDir, `${name}.md`), 'utf8')
  const collector = makeCollector()
  const prepared = rewrite(raw, collector.keep, images)
  const title = (/^#\s+(.+)$/m.exec(prepared) || [, name])[1].trim()

  let html = markdown.render(prepared)
  // Tables in the book have a "-" header row that the web app hides.
  html = html.replace(/<thead>\s*<tr>(\s*<th[^>]*>-\s*<\/th>)+\s*<\/tr>\s*<\/thead>/g, '')
  html = html
    .replace(/<p>\s*(QQBLOCK\d+QQX)\s*<\/p>/g, (match, token) => collector.blocks[Number(/QQBLOCK(\d+)QQX/.exec(token)[1])])
    .replace(/QQBLOCK(\d+)QQX/g, (match, index) => collector.blocks[Number(index)])

  return { html: entitySafe(html), title }
}

function page (title, body, nav) {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${nav || ''}
${body}
</body>
</html>
`
}

const STYLE = `body { line-height: 1.7; margin: 0 5%; }
h1 { font-size: 1.6em; margin: 1.2em 0 0.8em; }
h2 { font-size: 1.3em; margin: 1.4em 0 0.6em; }
h3 { font-size: 1.15em; }
p { margin: 0.6em 0; }
a { color: #8a4b2a; }
img { max-width: 100%; }
.tense { text-align: center; margin: 1em 0; }
table { border-collapse: collapse; margin: 1em 0; width: 100%; }
th, td { border: 1px solid #bbb; padding: 0.4em 0.6em; text-align: left; }
.test { margin: 0.8em 0; padding: 0.2em 0.8em; border-left: 3px solid #c9b8ab; background: #faf7f4; }
.test summary { cursor: pointer; font-weight: 600; }
.test summary::marker { color: #8a4b2a; }
.tests-q { margin: 0.4em 0 0; font-weight: 600; }
.answer-toggle { margin: 0.5em 0 0.2em; }
.choices { list-style: none; margin: 0.6em 0 0.2em; padding-left: 1em; }
.choices li { margin: 0.15em 0; }
.answer { margin: 0.5em 0 0.2em; }
.answer b { color: #8a4b2a; }
.explain { margin-top: 0.4em; }
.note { display: inline-grid; justify-items: center; line-height: 1.1; }
.note-word { font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
.note-tag { font-weight: 700; font-size: 0.75em; line-height: 1.1; color: #8a4b2a; }
body.cover-page { margin: 0; }
.cover { margin: 0; padding: 0; text-align: center; }
.cover img { max-width: 100%; max-height: 100vh; }
blockquote { margin: 1em 0; padding: 0.2em 1em; border-left: 3px solid #d8cdc4; background: #faf7f4; }
`

const COVER_XHTML = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(TITLE)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body class="cover-page" epub:type="cover">
<div class="cover"><img src="images/cover.png" alt="${escapeHtml(TITLE)}"/></div>
</body>
</html>
`

function build () {
  rmSync(buildDir, { recursive: true, force: true })
  mkdirSync(join(buildDir, 'META-INF'), { recursive: true })
  mkdirSync(join(buildDir, 'OEBPS', 'images'), { recursive: true })

  const images = new Set()
  const rendered = chapters.map(name => ({ name, href: hrefFor(name), ...renderChapter(name, images) }))

  writeFileSync(join(buildDir, 'mimetype'), 'application/epub+zip')
  writeFileSync(join(buildDir, 'META-INF', 'container.xml'), `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`)
  writeFileSync(join(buildDir, 'OEBPS', 'style.css'), STYLE)

  copyFileSync(join(root, 'assets/cover.png'), join(buildDir, 'OEBPS', 'images', 'cover.png'))
  writeFileSync(join(buildDir, 'OEBPS', 'cover.xhtml'), COVER_XHTML)

  for (const chapter of rendered) {
    writeFileSync(join(buildDir, 'OEBPS', chapter.href), page(chapter.title, chapter.html))
  }

  for (const file of images) {
    const source = join(publicDir, file)
    if (existsSync(source)) copyFileSync(source, join(buildDir, 'OEBPS', 'images', file))
  }

  const nav = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
<head><meta charset="utf-8"/><title>目录</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<nav epub:type="toc" id="toc"><h1>目录</h1><ol>
${rendered.map(chapter => `<li><a href="${chapter.href}">${escapeHtml(chapter.title)}</a></li>`).join('\n')}
</ol></nav>
</body>
</html>
`
  writeFileSync(join(buildDir, 'OEBPS', 'nav.xhtml'), nav)

  const manifest = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="cover-image" href="images/cover.png" media-type="image/png" properties="cover-image"/>',
    '<item id="css" href="style.css" media-type="text/css"/>',
    ...rendered.map((chapter, i) => `<item id="ch${i}" href="${chapter.href}" media-type="application/xhtml+xml"/>`),
    ...Array.from(images).map(file => `<item id="img-${file.replace(/\W/g, '-')}" href="images/${file}" media-type="image/png"/>`)
  ].join('\n    ')

  const spine = ['<itemref idref="cover" linear="yes"/>', ...rendered.map((chapter, i) => `<itemref idref="ch${i}"/>`)].join('\n    ')

  writeFileSync(join(buildDir, 'OEBPS', 'content.opf'), `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:6f2a4c1e-9d3b-4f5a-8c7e-grammarclub000</dc:identifier>
    <dc:title>${escapeHtml(TITLE)}</dc:title>
    <dc:creator>${escapeHtml(AUTHOR)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:source>https://avk458.github.io/grammar-club/</dc:source>
    <meta name="cover" content="cover-image"/>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    ${manifest}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>
`)

  rmSync(bookPath, { force: true })
  // The mimetype entry must be first and stored uncompressed.
  execFileSync('zip', ['-X0', bookPath, 'mimetype'], { cwd: buildDir })
  execFileSync('zip', ['-Xr9D', bookPath, 'META-INF', 'OEBPS'], { cwd: buildDir })

  console.log(`Wrote ${bookPath} (${rendered.length} chapters, ${images.size} images)`)
}

build()
