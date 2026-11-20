#!/usr/bin/env node
// Check every question in the built EPUB against the chapter sources.
//
// The book is generated, so a parser slip would drop or mangle a question
// silently. This walks all 25 chapters, compares the source <Test> tags with
// what came out, and fails on anything that does not add up.
// Run with `npm run epub:check` after `npm run epub`.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bookArg = (process.argv.find(a => a.startsWith('--book=')) || '').slice('--book='.length)
const bookPath = bookArg ? resolve(bookArg) : join(root, 'dist/grammar-club.epub')
const chapters = [
  'Preface',
  'Introduction',
  'Contents',
  ...Array.from({ length: 22 }, (_, i) => `Chapter${String(i + 1).padStart(2, '0')}`)
]

const problems = []
const complain = (where, message) => problems.push(`${where}: ${message}`)

const unpacked = mkdtempSync(join(tmpdir(), 'epub-check-'))
execFileSync('unzip', ['-qo', bookPath, '-d', unpacked])
const oebps = join(unpacked, 'OEBPS')

const count = (text, needle) => text.split(needle).length - 1

// <Test n qs>…</Test> followed by a bare <Test>…</Test> is one drill pair, which
// the build renders as a single disclosure.
const pairPattern = /<Test[^>]*(?:^|\s)n(?:\s|>)[^>]*>[\s\S]*?<\/Test>\s*<Test>[\s\S]*?<\/Test>/g

let totals = { source: 0, pairs: 0, units: 0, quizzes: 0, toggles: 0, plain: 0, drills: 0 }

for (const name of chapters) {
  const source = readFileSync(join(root, 'docs/content', `${name}.md`), 'utf8')
  const file = `ch-${name.toLowerCase()}.xhtml`
  const html = readFileSync(join(oebps, file), 'utf8')

  const sourceTags = count(source, '</Test>')
  const pairs = (source.match(pairPattern) || []).length
  const quizzes = count(html, '<div class="test">')
  const toggles = count(html, 'class="answer-toggle"')
  const plain = count(html, '<details class="test">')
  const drills = count(html, '<div class="drill">')
  const lists = count(html, 'class="choices"')

  // Everything the build emits starts from one <Test> tag, except a paired
  // drill, which starts from two.
  const units = quizzes + plain + drills
  const expected = sourceTags - pairs

  if (units < expected) complain(name, `${sourceTags - pairs} questions expected, ${units} rendered`)

  if (count(html, 'QQBLOCK')) complain(name, 'a template placeholder survived')
  if (html.indexOf('<Test') !== -1) complain(name, 'a raw <Test> tag survived')
  // Every :c="[…]"/c="[…]· in the source must give one list of options.
  const sourceChoices = (source.match(/(?:^|[\s:])c="/g) || []).length
  if (lists < sourceChoices) {
    complain(name, `${sourceChoices} choice lists in the source, ${lists} in the book`)
  }

  // Every quiz opens with its question or its options; only the answer folds.
  for (const block of html.split('<div class="test">').slice(1)) {
    if (!/^<p class="tests-q">/.test(block) && !/^<ol class="choices">/.test(block)) {
      complain(name, 'a quiz block does not start with its question or options')
      break
    }
  }
  for (const block of (html.match(/<details class="answer-toggle">[\s\S]*?<\/details>/g) || [])) {
    if (block.indexOf('<summary>答案</summary>') === -1) {
      complain(name, 'an answer toggle without its 答案 label')
      break
    }
  }

  // The n-th quiz in the book must carry the n-th answer in the source, so an
  // answer never ends up under the wrong question.
  const sourceAnswers = []
  for (const tag of source.match(/<Test[^>]*>/g) || []) {
    const hasChoices = /(?:^|[\s:])c="/.test(tag)
    if (!hasChoices) continue
    const answer = /(?:^|[\s:])a="([^"]*)"/.exec(tag)
    sourceAnswers.push(answer ? answer[1] : '')
  }
  const quizBlocks = html.split('<div class="test">').slice(1).filter(block => block.indexOf('class="choices"') !== -1)
  if (quizBlocks.length !== sourceAnswers.length) {
    complain(name, `${sourceAnswers.length} quizzes in the source, ${quizBlocks.length} in the book`)
  }
  quizBlocks.forEach((block, i) => {
    const expected = sourceAnswers[i]
    if (!expected) return
    const found = new RegExp(`<p class="answer"><b>${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</b></p>`)
    if (!found.test(block)) {
      complain(name, `quiz ${i + 1} should answer ${expected}`)
    }
  })

  // The question and answer text must survive the parser intact: read every
  // q="…" and a="…" out of the source and look for it in the chapter.
  for (const attr of ['q', 'a']) {
    const pattern = new RegExp(`(?:^|[\\s:])${attr}="([^"]*)"`, 'g')
    let match
    while ((match = pattern.exec(source))) {
      if (!match[1].trim() || match[1] === '(A)') continue
      if (html.indexOf(match[1]) === -1) complain(name, `missing ${attr} text: ${match[1].slice(0, 40)}`)
    }
  }

  // An empty answer or an empty option would mean the attribute parser lost text.
  if (html.includes('<p class="answer"><b></b></p>')) complain(name, 'an empty answer')
  if (/<li>[A-D]\.\s*<\/li>/.test(html)) complain(name, 'an empty option')

  // The disclosure must not be nested inside its own summary.
  for (const summary of html.match(/<summary>[\s\S]*?<\/summary>/g) || []) {
    if (summary.indexOf('<details') !== -1) complain(name, 'a disclosure nested in a summary')
  }

  const noAnswerDrills = count(source, '<Test n')
  totals.source += sourceTags
  totals.pairs += pairs
  totals.units += units
  totals.quizzes += quizzes
  totals.toggles += toggles
  totals.plain += plain
  totals.drills += noAnswerDrills

  if (process.argv.includes('--verbose')) {
    console.log(
      `${name.padEnd(12)} source ${String(sourceTags).padStart(3)}  pairs ${String(pairs).padStart(2)}` +
      `  quizzes ${String(quizzes).padStart(3)}  toggles ${String(toggles).padStart(3)}` +
      `  plain ${String(plain).padStart(3)}  drills ${String(drills).padStart(2)}` +
      `  no-answer ${String(noAnswerDrills).padStart(2)}`
    )
  }
}

// The published book has 453 exercises; the sources carry 452 tags.
if (totals.source !== 452) complain('total', `expected 452 <Test> tags, found ${totals.source}`)
if (totals.units + totals.pairs !== totals.source) {
  complain('total', `${totals.units} units + ${totals.pairs} paired drills != ${totals.source} tags`)
}

rmSync(unpacked, { recursive: true, force: true })

console.log(
  `${totals.source} questions in ${chapters.length} chapters: ` +
  `${totals.quizzes} choice quizzes (${totals.toggles} with a foldable answer), ` +
  `${totals.plain} annotated-answer blocks, ${totals.pairs} paired drills, ${totals.drills} no-answer drills.`
)

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const problem of problems) console.error('  ' + problem)
  process.exit(1)
}
console.log('No problems found.')
