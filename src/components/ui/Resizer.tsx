import { useEffect, useRef } from 'react'

interface ResizerProps {
  direction: 'vertical' | 'horizontal'
  value: number
  onResize: (value: number) => void
  position?: 'left' | 'right'
}

export function Resizer({ direction, value, onResize, position = 'right' }: ResizerProps) {
  const startPos = useRef<number | null>(null)
  const baseValue = useRef(0)
  const onResizeRef = useRef(onResize)

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (startPos.current === null) return
      const current = direction === 'vertical' ? e.clientX : e.clientY
      const delta = current - startPos.current
      onResizeRef.current(baseValue.current + delta)
    }
    const onUp = () => {
      startPos.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [direction])

  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault()
        startPos.current = direction === 'vertical' ? e.clientX : e.clientY
        baseValue.current = value
        document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize'
        document.body.style.userSelect = 'none'
      }}
      className={
        direction === 'vertical'
          ? `group relative z-10 w-1 shrink-0 cursor-col-resize ${
              position === 'left' ? '-ml-1' : '-mr-1'
            }`
          : `group relative z-10 h-1 shrink-0 cursor-row-resize ${
              position === 'left' ? '-mt-1' : '-mb-1'
            }`
      }
    >
      <div
        className={`absolute ${
          direction === 'vertical'
            ? 'inset-y-0 left-1/2 w-px -translate-x-1/2'
            : 'inset-x-0 top-1/2 h-px -translate-y-1/2'
        } bg-transparent transition-colors group-hover:bg-blue-400`}
      />
    </div>
  )
}