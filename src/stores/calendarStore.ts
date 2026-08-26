import { create } from 'zustand'
import { calendarApi, type CalendarEvent } from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'

interface CalendarState {
  year: number
  month: number
  events: CalendarEvent[]
  loading: boolean
  error: string
  setMonth: (year: number, month: number) => void
  load: () => Promise<void>
}

export const useCalendarStore = create<CalendarState>((set, get) => {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    events: [],
    loading: false,
    error: '',

    setMonth: (year, month) => {
      set({ year, month })
      void get().load()
    },

    load: async () => {
      const ws = useWorkspaceStore.getState().workspace
      if (!ws) return
      const { year, month } = get()
      set({ loading: true, error: '' })
      try {
        const events = await calendarApi.events(ws.path, year, month)
        set({ events, loading: false })
      } catch (e) {
        set({ error: String(e), loading: false })
      }
    },
  }
})
