export interface Command {
  id: string
  title: string
  category: string
  keywords: string[]
  icon?: string
  run: () => void
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
    return this.all().filter((c) => {
      return (
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.toLowerCase().includes(q))
      )
    })
  }

  run(id: string): void {
    const cmd = this.commands.get(id)
    if (cmd) cmd.run()
  }
}

export const commands = new CommandRegistry()