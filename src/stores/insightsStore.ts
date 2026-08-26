import { create } from 'zustand'
import { insightsApi, type InsightsReport } from '@/core/filesystem/api'

interface InsightsState {
  report: InsightsReport | null
  loading: boolean
  error: string | null
  load: (workspacePath: string) => Promise<void>
}

export const useInsightsStore = create<InsightsState>((set) => ({
  report: null,
  loading: false,
  error: null,

  load: async (workspacePath) => {
    set({ loading: true, error: null })
    try {
      const report = await insightsApi.report(workspacePath)
      set({ report, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },
}))
