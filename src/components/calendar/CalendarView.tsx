import { useEffect, useMemo, useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { calendarApi, type CalendarEvent } from '@/core/filesystem/api'
import {
  buildMonthGrid,
  monthLabel,
  shiftMonth,
  todayDateString,
  WEEKDAY_LABELS,
} from '@/core/calendar/model'
import { refreshTree } from '@/features/notes/actions'

const KIND_DOT: Record<CalendarEvent['kind'], string> = {
  daily: 'bg-blue-500',
  note: 'bg-zinc-400',
  task: 'bg-amber-500',
}

export function CalendarView() {
  const { theme, workspace } = useWorkspaceStore()
  const openNote = useTabStore((s) => s.openNote)
  const year = useCalendarStore((s) => s.year)
  const month = useCalendarStore((s) => s.month)
  const events = useCalendarStore((s) => s.events)
  const loading = useCalendarStore((s) => s.loading)
  const error = useCalendarStore((s) => s.error)
  const isDark = theme === 'dark'

  const [selected, setSelected] = useState<string>(todayDateString())
  const [dailyBusy, setDailyBusy] = useState(false)

  useEffect(() => {
    void useCalendarStore.getState().load()
  }, [])

  const today = todayDateString()
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month])
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const list = map.get(e.date)
      if (list) list.push(e)
      else map.set(e.date, [e])
    }
    return map
  }, [events])
  const dayEvents = byDate.get(selected) ?? []

  const btn = `rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
    isDark
      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
  }`
  const navBtn = `flex h-7 w-7 items-center justify-center rounded-md text-[14px] transition-colors ${
    isDark
      ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      : 'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800'
  }`
  const mutedText = isDark ? 'text-zinc-500' : 'text-zinc-400'
  const prevMonth = shiftMonth(year, month, -1)
  const nextMonth = shiftMonth(year, month, 1)

  const openDaily = async () => {
    if (!workspace || dailyBusy) return
    setDailyBusy(true)
    try {
      const info = await calendarApi.openDaily(workspace.path, selected)
      if (info.created) await refreshTree()
      openNote(info.path, selected)
    } catch {
      // ignore — button stays available for retry
    } finally {
      setDailyBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className={`flex h-11 shrink-0 items-center gap-2 border-b px-3 ${
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <span className="text-[13px] font-medium">Calendar</span>
        <div className="ml-2 flex items-center gap-1">
          <button
            onClick={() => useCalendarStore.getState().setMonth(prevMonth.year, prevMonth.month)}
            className={navBtn}
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className={`w-32 text-center text-[13px] ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            {monthLabel(year, month)}
          </span>
          <button
            onClick={() => useCalendarStore.getState().setMonth(nextMonth.year, nextMonth.month)}
            className={navBtn}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <button
          onClick={() => {
            const now = new Date()
            useCalendarStore.getState().setMonth(now.getFullYear(), now.getMonth() + 1)
            setSelected(today)
          }}
          className={btn}
        >
          Today
        </button>
        <div className="flex-1" />
        <span className={`text-[11px] ${mutedText}`}>
          {loading ? 'Loading…' : `${events.length} events this month`}
        </span>
      </div>

      {error && <p className="px-3 py-2 text-[12px] text-red-500">{error}</p>}

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto p-3">
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className={`pb-1 text-center text-[10px] font-semibold uppercase tracking-widest ${mutedText}`}>
                {w}
              </div>
            ))}
            {cells.map((cell, i) => {
              if (!cell.date) {
                return <div key={`pad-${i}`} className="min-h-14 rounded-md" />
              }
              const dayEventsForCell = byDate.get(cell.date) ?? []
              const isToday = cell.date === today
              const isSelected = cell.date === selected
              return (
                <button
                  key={cell.date}
                  onClick={() => setSelected(cell.date!)}
                  className={`min-h-14 rounded-md border p-1.5 text-left transition-colors ${
                    isSelected
                      ? isDark
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-blue-500 bg-blue-50'
                      : isToday
                        ? isDark
                          ? 'border-zinc-600 bg-zinc-800/50 ring-1 ring-inset ring-blue-500/30'
                          : 'border-zinc-300 bg-zinc-50 ring-1 ring-inset ring-blue-400/30'
                        : isDark
                          ? 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/40'
                          : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] tabular-nums ${
                      isToday
                        ? 'bg-red-500 font-semibold text-white'
                        : isDark
                          ? 'text-zinc-300'
                          : 'text-zinc-700'
                    }`}
                  >
                    {Number(cell.date.slice(8))}
                  </span>
                  {dayEventsForCell.length > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      {dayEventsForCell.slice(0, 2).map((e, j) => (
                        <div
                          key={`${e.path}:${j}`}
                          className={`flex items-center gap-1 text-[9px] leading-tight ${
                            isDark ? 'text-zinc-400' : 'text-zinc-500'
                          }`}
                        >
                          <span className={`h-1 w-1 shrink-0 rounded-full ${KIND_DOT[e.kind]}`} />
                          <span className="truncate">{e.title}</span>
                        </div>
                      ))}
                      {dayEventsForCell.length > 2 && (
                        <span className={`text-[9px] ${mutedText}`}>
                          +{dayEventsForCell.length - 2} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 flex h-1.5 items-center gap-0.5" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div
          className={`flex w-72 shrink-0 flex-col overflow-auto border-l ${
            isDark ? 'border-zinc-800' : 'border-zinc-200'
          }`}
        >
          <div className="p-3">
            <div className={`mb-1 text-[11px] font-semibold uppercase tracking-widest ${mutedText}`}>
              Agenda
            </div>
            <div className={`text-[15px] font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
              {selected}
              {selected === today && (
                <span className="ml-2 text-[11px] font-normal text-red-500">today</span>
              )}
            </div>
            <button
              onClick={() => void openDaily()}
              disabled={dailyBusy}
              className="mt-2 w-full rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {dailyBusy ? 'Opening…' : 'Open daily note'}
            </button>
          </div>

          <div className="flex-1 space-y-0.5 px-3 pb-3">
            {dayEvents.length === 0 && (
              <div className={`mt-4 flex flex-col items-center gap-2 text-center ${mutedText}`}>
                <div className="text-3xl opacity-30">📅</div>
                <p className="text-[12px]">Nothing scheduled for this day.</p>
              </div>
            )}
            {dayEvents.map((e, i) => (
              <button
                key={`${e.path}:${i}`}
                onClick={() => openNote(e.path, e.title)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                  isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-100'
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[e.kind]}`} />
                <span className={`truncate text-[12px] ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                  {e.title}
                </span>
                <span className={`ml-auto shrink-0 text-[10px] capitalize ${mutedText}`}>
                  {e.kind}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
