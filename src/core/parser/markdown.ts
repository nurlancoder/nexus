const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function splitFrontmatter(content: string): {
  frontmatter: string
  body: string
} {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return { frontmatter: '', body: content }
  let frontmatter = match[0]
  if (!frontmatter.endsWith('\n')) frontmatter += '\n'
  let body = content.slice(match[0].length)
  if (body.startsWith('\n')) body = body.slice(1)
  return { frontmatter, body }
}

export function joinFrontmatter(frontmatter: string, body: string): string {
  if (!frontmatter) return body
  return frontmatter.endsWith('\n') ? frontmatter + body : frontmatter + '\n' + body
}

export type PropertyValue = string | number | boolean | string[]

export interface Frontmatter {
  title?: string
  tags?: string[]
  [key: string]: PropertyValue | undefined
}

const QUOTE_RE = /^["']|["']$/g

function coerceScalar(value: string): string | number | boolean {
  const trimmed = value.trim().replace(QUOTE_RE, '')
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  const n = Number(trimmed)
  if (!Number.isNaN(n) && trimmed !== '') return n
  return trimmed
}

function coerceValue(raw: string, lines: string[], i: number): PropertyValue {
  const trimmed = raw.trim()
  if (trimmed === '') {
    const block: string[] = []
    let j = i + 1
    while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
      block.push(lines[j].replace(/^\s+-\s+/, '').replace(QUOTE_RE, ''))
      j++
    }
    if (block.length > 0) return block
    return []
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((t) => t.trim().replace(QUOTE_RE, ''))
      .filter(Boolean)
  }
  return coerceScalar(trimmed)
}

export function parseFrontmatter(content: string): Frontmatter {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return {}
  const frontmatter: Frontmatter = {}
  const lines = match[1].split('\n')
  for (let i = 0; i < lines.length; i++) {
    const sep = lines[i].indexOf(':')
    if (sep === -1) continue
    const key = lines[i].slice(0, sep).trim()
    if (!key) continue
    frontmatter[key] = coerceValue(lines[i].slice(sep + 1), lines, i)
  }
  return frontmatter
}

export function serializeFrontmatter(frontmatter: Frontmatter): string {
  const keys = Object.keys(frontmatter)
  if (keys.length === 0) return ''
  const lines = ['---']
  for (const key of keys) {
    const value = frontmatter[key]
    if (value === undefined) continue
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}:`)
      } else {
        lines.push(`${key}:`)
        for (const item of value) lines.push(`  - ${item}`)
      }
    } else {
      const str = String(value)
      lines.push(`${key}: ${/^[\d.]+$/.test(str) || str === 'true' || str === 'false' ? str : `"${str.replace(/"/g, '\\"')}"`}`)
    }
  }
  lines.push('---')
  return lines.join('\n')
}

export function coerceInput(raw: string): PropertyValue {
  const trimmed = raw.trim()
  if (trimmed === '') return ''
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((t) => t.trim().replace(QUOTE_RE, ''))
      .filter(Boolean)
  }
  return coerceScalar(trimmed)
}

export function extractTitle(content: string, fallback: string): string {
  const fm = parseFrontmatter(content)
  if (fm.title) return String(fm.title)
  const heading = content.match(/^#\s+(.+)$/m)
  if (heading) return heading[1].trim()
  return fallback.replace(/\.(md|markdown|txt)$/i, '')
}

export function unescapeWikiLinks(markdown: string): string {
  return markdown.replace(/\\\[\\\[/g, '[[').replace(/\\\]\\\]/g, ']]')
}

export interface WikiLink {
  target: string
  alias?: string
  section?: string
  embed: boolean
  raw: string
}

export interface Heading {
  level: number
  text: string
  line: number
}

export interface TaskItem {
  text: string
  checked: boolean
  line: number
}

export interface ParsedNote {
  frontmatter: Frontmatter
  title: string
  links: WikiLink[]
  tags: string[]
  headings: Heading[]
  tasks: TaskItem[]
  embeds: string[]
  wordCount: number
}

const WIKILINK_RE = /(!?)\[\[([^\]|#]+)(?:\|([^\]|#]+))?(?:#([^\]|]+))?\]\]/g

export function parseWikiLinks(body: string): WikiLink[] {
  const links: WikiLink[] = []
  for (const m of body.matchAll(WIKILINK_RE)) {
    links.push({
      embed: m[1] === '!',
      target: m[2].trim(),
      alias: m[3]?.trim() || undefined,
      section: m[4]?.trim() || undefined,
      raw: m[0],
    })
  }
  return links
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/gm
const TASK_RE = /^\s*[-*+]\s+\[( |x|X)\]\s+(.+)$/gm
const TAG_RE = /(?:^|\s)#([a-zA-Z0-9_\-\u00C0-\u024F]+)/g

export function parseMarkdown(content: string): ParsedNote {
  const { body } = splitFrontmatter(content)
  const frontmatter = parseFrontmatter(content)
  const links = parseWikiLinks(body)
  const headings: Heading[] = []
  for (const m of body.matchAll(HEADING_RE)) {
    headings.push({ level: m[1].length, text: m[2].trim(), line: 0 })
  }
  const tasks: TaskItem[] = []
  for (const m of body.matchAll(TASK_RE)) {
    tasks.push({ text: m[2].trim(), checked: m[1] !== ' ', line: 0 })
  }
  const tags = new Set<string>()
  const bodyTags = body.matchAll(TAG_RE)
  for (const m of bodyTags) {
    if (!m[0].includes('#[')) tags.add(m[1])
  }
  const fmTags = frontmatter.tags
  if (Array.isArray(fmTags)) for (const t of fmTags) tags.add(t)
  const embeds = links.filter((l) => l.embed).map((l) => l.target)
  return {
    frontmatter,
    title: extractTitle(content, 'Untitled'),
    links: links.filter((l) => !l.embed),
    tags: [...tags],
    headings,
    tasks,
    embeds,
    wordCount: body.split(/\s+/).filter(Boolean).length,
  }
}

export function extractTags(content: string): string[] {
  return parseMarkdown(content).tags
}