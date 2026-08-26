export interface Command {
  id: string
  title: string
  category: string
  keywords: string[]
  icon?: string
  run: () => void
}

interface ScoredCommand {
  command: Command
  score: number
}

function fuzzyScore(text: string, pattern: string): number {
  if (!pattern) return 0
  const t = text.toLowerCase()
  const p = pattern.toLowerCase()

  const exactIdx = t.indexOf(p)
  if (exactIdx !== -1) return 10000 - exactIdx

  let pi = 0
  let score = 0
  let lastMatch = -1
  for (let ti = 0; ti < t.length && pi < p.length; ti++) {
    if (t[ti] === p[pi]) {
      score += lastMatch === ti - 1 ? 10 : 1
      lastMatch = ti
      pi++
    }
  }
  return pi === p.length ? score : 0
}

function bestScore(c: Command, q: string): number {
  return Math.max(
    fuzzyScore(c.title, q),
    fuzzyScore(c.category, q),
    ...c.keywords.map((k) => fuzzyScore(k, q)),
  )
}

class CommandRegistry {
  private commands = new Map<string, Command>()

  register(command: Command): void {
    this.commands.set(command.id, command)
  }

  unregister(id: string): void {
    this.commands.delete(id)
  }

  all(): Command[] {
    return [...this.commands.values()].sort((a, b) =>
      a.title.localeCompare(b.title),
    )
  }

  search(query: string): Command[] {
    const q = query.trim().toLowerCase()
    if (!q) return this.all()

    const scored: ScoredCommand[] = []
    for (const cmd of this.commands.values()) {
      const score = bestScore(cmd, q)
      if (score > 0) scored.push({ command: cmd, score })
    }

    scored.sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title))
    return scored.map((s) => s.command)
  }

  run(id: string): void {
    const cmd = this.commands.get(id)
    if (cmd) cmd.run()
  }
}

export const commands = new CommandRegistry()