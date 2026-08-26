import { useEffect, useState } from 'react'
import { invoke } from '@/lib/tauri'

export function useAppInfo() {
  const [info, setInfo] = useState<string>('')

  useEffect(() => {
    invoke<string>('app_info')
      .then(setInfo)
      .catch(() => setInfo('NEXUS — browser preview'))
  }, [])

  return info
}