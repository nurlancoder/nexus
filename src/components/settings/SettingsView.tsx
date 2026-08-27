import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useShortcutsStore } from '@/stores/shortcutsStore'
import { applyLayoutPreset, presetFlags, type LayoutPreset } from '@/core/layout/presets'

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  const { theme } = useWorkspaceStore()
  const isDark = theme === 'dark'
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <p
          className={`text-[12px] font-medium ${
            isDark ? 'text-zinc-200' : 'text-zinc-700'
          }`}
        >
          {label}
        </p>
        {description && (
          <p className={`mt-0.5 text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            {description}
          </p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked
            ? 'bg-blue-600'
            : isDark
              ? 'bg-zinc-700'
              : 'bg-zinc-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useWorkspaceStore()
  const isDark = theme === 'dark'
  return (
    <section className="border-b border-zinc-200 py-4 dark:border-zinc-800">
      <h3
        className={`mb-1 text-[10px] font-semibold uppercase tracking-widest ${
          isDark ? 'text-zinc-500' : 'text-zinc-400'
        }`}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

export function SettingsView() {
  const {
    theme,
    setTheme,
    focusMode,
    setFocusMode,
    sidebarVisible,
    toggleSidebar,
    inspectorVisible,
    toggleInspector,
    setWelcomeVisible,
    closeWorkspace,
  } = useWorkspaceStore()

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <h2 className="text-[15px] font-semibold text-zinc-800 dark:text-zinc-100">
        Settings
      </h2>

      <Section title="Appearance">
        <div className="flex items-start justify-between gap-4 py-1">
          <div>
            <p className="text-[12px] font-medium text-zinc-700 dark:text-zinc-200">
              Theme
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              Switch between light and dark appearance.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-md px-2.5 py-1 text-[11px] capitalize transition-colors ${
                  theme === t
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Layout">
        <div className="flex items-start justify-between gap-4 py-1">
          <div>
            <p className="text-[12px] font-medium text-zinc-700 dark:text-zinc-200">
              Sidebar
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              File explorer panel on the left.
            </p>
          </div>
          <Toggle checked={sidebarVisible} onChange={toggleSidebar} label="Sidebar" />
        </div>
        <div className="flex items-start justify-between gap-4 py-1">
          <div>
            <p className="text-[12px] font-medium text-zinc-700 dark:text-zinc-200">
              Inspector
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              Note properties and backlinks on the right.
            </p>
          </div>
          <Toggle checked={inspectorVisible} onChange={toggleInspector} label="Inspector" />
        </div>
        <div className="flex items-start justify-between gap-4 py-1">
          <div>
            <p className="text-[12px] font-medium text-zinc-700 dark:text-zinc-200">
              Focus mode
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              Hide panels and tabs for distraction-free writing.
            </p>
          </div>
          <Toggle checked={focusMode} onChange={setFocusMode} label="Focus mode" />
        </div>
        <div className="py-2">
          <p className="mb-1.5 text-[12px] font-medium text-zinc-700 dark:text-zinc-200">
            Layout presets
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(['default', 'writing', 'research'] as LayoutPreset[]).map((p) => (
              <button
                key={p}
                onClick={() => applyLayoutPreset(p)}
                className={`rounded-md border px-2.5 py-1 text-[11px] capitalize transition-colors ${
                  focusMode === presetFlags(p).focusMode &&
                  sidebarVisible === presetFlags(p).sidebarVisible &&
                  inspectorVisible === presetFlags(p).inspectorVisible
                    ? 'border-blue-500 text-blue-500'
                    : 'border-zinc-300 text-zinc-600 hover:border-blue-400 hover:text-blue-500 dark:border-zinc-700 dark:text-zinc-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Workspace">
        <div className="flex flex-col gap-1.5 py-1">
          <button
            onClick={() => useShortcutsStore.getState().toggle()}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-left text-[12px] text-zinc-600 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-zinc-700 dark:text-zinc-300"
          >
            View keyboard shortcuts
          </button>
          <button
            onClick={() => setWelcomeVisible(true)}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-left text-[12px] text-zinc-600 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-zinc-700 dark:text-zinc-300"
          >
            Switch workspace…
          </button>
          <button
            onClick={closeWorkspace}
            className="rounded-md border border-red-300 px-2.5 py-1.5 text-left text-[12px] text-red-500 transition-colors hover:border-red-400 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/50"
          >
            Close workspace
          </button>
        </div>
      </Section>

      <Section title="About">
        <p className="py-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          Nexus v0.1.0 · Local-first knowledge workspace
        </p>
      </Section>
    </div>
  )
}
