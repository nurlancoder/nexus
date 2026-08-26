import { describe, it, expect } from 'vitest'
import {
  filterTasks,
  groupTasks,
  sortWithinSections,
  todayString,
} from './model'
import type { TaskItem } from '@/core/filesystem/api'

const TODAY = '2026-08-21'

function task(partial: Partial<TaskItem>): TaskItem {
  return {
    path: '/w/a.md',
    noteTitle: 'A',
    folder: '',
    line: 1,
    text: 'task',
    done: false,
    due: null,
    priority: null,
    tags: [],
    ...partial,
  }
}

describe('todayString', () => {
  it('returns ISO format with zero padding', () => {
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('filterTasks', () => {
  const tasks = [
    task({ text: 'Buy milk', done: false }),
    task({ text: 'Ship release', done: true }),
    task({ text: 'Call bob', priority: 'high' }),
    task({ text: 'Other', tags: ['web'] }),
  ]

  it('hides completed by default', () => {
    expect(filterTasks(tasks, { query: '', showDone: false, priority: null })).toHaveLength(3)
  })

  it('shows completed when requested', () => {
    expect(filterTasks(tasks, { query: '', showDone: true, priority: null })).toHaveLength(4)
  })

  it('filters by query across text title and tags', () => {
    const f = (q: string) =>
      filterTasks(tasks, { query: q, showDone: true, priority: null }).map((t) => t.text)
    expect(f('milk')).toEqual(['Buy milk'])
    expect(f('bob')).toEqual(['Call bob'])
    expect(f('web')).toEqual(['Other'])
    expect(f('zzz')).toEqual([])
  })

  it('filters by exact priority', () => {
    const out = filterTasks(tasks, { query: '', showDone: true, priority: 'high' })
    expect(out.map((t) => t.text)).toEqual(['Call bob'])
  })
})

describe('groupTasks', () => {
  const tasks = [
    task({ text: 'future', due: '2026-09-01' }),
    task({ text: 'late', due: '2026-08-01' }),
    task({ text: 'now', due: TODAY }),
    task({ text: 'someday' }),
    task({ text: 'finished', done: true }),
  ]

  it('buckets into ordered sections', () => {
    const groups = groupTasks(tasks, TODAY)
    expect(groups.map(([s]) => s)).toEqual([
      'overdue',
      'today',
      'upcoming',
      'noDate',
      'done',
    ])
    expect(groups[0][1][0].text).toBe('late')
    expect(groups[1][1][0].text).toBe('now')
    expect(groups[2][1][0].text).toBe('future')
    expect(groups[3][1][0].text).toBe('someday')
    expect(groups[4][1][0].text).toBe('finished')
  })

  it('omits empty sections', () => {
    const groups = groupTasks([task({ text: 'x' })], TODAY)
    expect(groups.map(([s]) => s)).toEqual(['noDate'])
  })

  it('sorts upcoming by date then priority then text', () => {
    const out = sortWithinSections(
      [
        task({ text: 'b later', due: '2026-09-02' }),
        task({ text: 'a sooner', due: '2026-09-01' }),
        task({ text: 'urgent same day', due: '2026-09-01', priority: 'high' }),
      ],
      TODAY,
    )
    expect(out.map((t) => t.text)).toEqual([
      'urgent same day',
      'a sooner',
      'b later',
    ])
  })
})
