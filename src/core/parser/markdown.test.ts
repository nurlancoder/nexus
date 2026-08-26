import { describe, it, expect } from 'vitest'
import {
  splitFrontmatter,
  joinFrontmatter,
  parseFrontmatter,
  serializeFrontmatter,
  parseWikiLinks,
  parseMarkdown,
  extractTitle,
  coerceInput,
} from './markdown'

describe('splitFrontmatter / joinFrontmatter', () => {
  it('splits frontmatter from body', () => {
    const { frontmatter, body } = splitFrontmatter('---\ntitle: Test\n---\nBody')
    expect(frontmatter).toBe('---\ntitle: Test\n---\n')
    expect(body).toBe('Body')
  })

  it('returns full content when no frontmatter', () => {
    const { frontmatter, body } = splitFrontmatter('Just body')
    expect(frontmatter).toBe('')
    expect(body).toBe('Just body')
  })

  it('rejoins frontmatter and body', () => {
    expect(joinFrontmatter('---\ntitle: X\n---\n', 'body')).toBe('---\ntitle: X\n---\nbody')
    expect(joinFrontmatter('', 'body')).toBe('body')
  })
})

describe('parseFrontmatter', () => {
  it('coerces scalar types', () => {
    const fm = parseFrontmatter(
      '---\n' +
        'title: Hello World\n' +
        'private: true\n' +
        'priority: 5\n' +
        'tags: [react, typescript]\n' +
        '---\n',
    )
    expect(fm.title).toBe('Hello World')
    expect(fm.private).toBe(true)
    expect(fm.priority).toBe(5)
    expect(fm.tags).toEqual(['react', 'typescript'])
  })

  it('parses YAML block list', () => {
    const fm = parseFrontmatter('---\ntags:\n  - one\n  - two\n---\n')
    expect(fm.tags).toEqual(['one', 'two'])
  })

  it('returns empty object without frontmatter', () => {
    expect(parseFrontmatter('no frontmatter')).toEqual({})
  })
})

describe('serializeFrontmatter', () => {
  it('round-trips frontmatter', () => {
    const fm: ReturnType<typeof parseFrontmatter> = {
      title: 'My Note',
      private: true,
      priority: 5,
      tags: ['a', 'b'],
    }
    const serialized = serializeFrontmatter(fm)
    expect(parseFrontmatter(serialized)).toEqual(fm)
  })

  it('returns empty string for empty frontmatter', () => {
    expect(serializeFrontmatter({})).toBe('')
  })
})

describe('parseWikiLinks', () => {
  it('parses simple links', () => {
    const links = parseWikiLinks('See [[React]] and [[Frontend Development]].')
    expect(links).toEqual([
      { target: 'React', embed: false, raw: '[[React]]' },
      { target: 'Frontend Development', embed: false, raw: '[[Frontend Development]]' },
    ])
  })

  it('parses alias and section', () => {
    const links = parseWikiLinks('[[React|React Framework]] and [[Page#Section]]')
    expect(links[0]).toMatchObject({ target: 'React', alias: 'React Framework' })
    expect(links[1]).toMatchObject({ target: 'Page', section: 'Section' })
  })

  it('parses embeds separately', () => {
    const links = parseWikiLinks('![[image.png]] and [[note]]')
    expect(links[0]).toMatchObject({ target: 'image.png', embed: true })
    expect(links[1]).toMatchObject({ target: 'note', embed: false })
  })
})

describe('parseMarkdown', () => {
  const doc = [
    '---',
    'title: Full Note',
    'tags: [guide, frontend]',
    'status: published',
    '---',
    '# React',
    '',
    'Intro text with #inline tag.',
    '',
    '- [ ] First task',
    '- [x] Done task',
    '',
    'See [[React]] and [[Hooks|React Hooks#Advanced]].',
    '![[diagram.png]]',
  ].join('\n')

  it('extracts frontmatter, links, tags, tasks, embeds', () => {
    const parsed = parseMarkdown(doc)
    expect(parsed.title).toBe('Full Note')
    expect(parsed.frontmatter.status).toBe('published')
    expect(parsed.tags).toContain('inline')
    expect(parsed.tags).toContain('guide')
    expect(parsed.tags).toContain('frontend')
    expect(parsed.links).toHaveLength(2)
    expect(parsed.links[1]).toMatchObject({ target: 'Hooks', alias: 'React Hooks', section: 'Advanced' })
    expect(parsed.tasks).toEqual([
      { text: 'First task', checked: false, line: 0 },
      { text: 'Done task', checked: true, line: 0 },
    ])
    expect(parsed.embeds).toEqual(['diagram.png'])
    expect(parsed.headings[0]).toMatchObject({ level: 1, text: 'React' })
  })

  it('derives title from H1 when no frontmatter title', () => {
    const parsed = parseMarkdown('# My Heading\ncontent')
    expect(parsed.title).toBe('My Heading')
  })

  it('counts words', () => {
    expect(parseMarkdown('one two three four').wordCount).toBe(4)
  })

  it('does not treat [# as a tag', () => {
    const parsed = parseMarkdown('text [#tag]\n')
    expect(parsed.tags).not.toContain('tag')
  })
})

describe('extractTitle', () => {
  it('prefers frontmatter title over H1', () => {
    expect(extractTitle('---\ntitle: FM Title\n---\n# H1 Title', 'fallback')).toBe('FM Title')
  })

  it('falls back to filename', () => {
    expect(extractTitle('plain text', 'my-note.md')).toBe('my-note')
  })
})

describe('coerceInput', () => {
  it('coerces scalars', () => {
    expect(coerceInput('true')).toBe(true)
    expect(coerceInput('42')).toBe(42)
    expect(coerceInput('hello')).toBe('hello')
    expect(coerceInput('  spaced  ')).toBe('spaced')
  })

  it('splits comma lists into arrays', () => {
    expect(coerceInput('react, frontend, ui')).toEqual(['react', 'frontend', 'ui'])
    expect(coerceInput('one')).toBe('one')
  })

  it('returns empty string for empty input', () => {
    expect(coerceInput('')).toBe('')
    expect(coerceInput('   ')).toBe('')
  })

  it('strips quotes from values', () => {
    expect(coerceInput('"quoted"')).toBe('quoted')
  })
})