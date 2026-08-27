import { useEffect, useRef, useState } from 'react'

interface ResizerProps {
  direction: 'vertical' | 'horizontal'
  value: number
  onResize: (value: number) => void
  position?: 'left' | 'right'
  minSize?: number
  maxSize?: number
}

export function Resizer({
  direction,
  value,
  onResize,
  position = 'right',
  minSize = 150,
  maxSize = 500,
}: ResizerProps) {
  const startPos = useRef<number | null>(null)
  const baseValue = useRef(0)
  const onResizeRef = useRef(onResize)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (startPos.current === null) return
      const current = direction === 'vertical' ? e.clientX : e.clientY
      const delta = current - startPos.current
      const next = Math.min(maxSize, Math.max(minSize, baseValue.current + delta))
      onResizeRef.current(next)
    }
    const onUp = () => {
      startPos.current = null
      setDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    if (dragging) {
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [direction, minSize, maxSize, dragging])

  const isVertical = direction === 'vertical'

  return (
    <div
      role="separator"
      aria-label={isVertical ? 'Vertical resize handle' : 'Horizontal resize handle'}
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      aria-valuenow={value}
      aria-valuemin={minSize}
      aria-valuemax={maxSize}
      tabIndex={0}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 50 : 10
        if (isVertical) {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault()
            onResize(Math.max(minSize, value - step))
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault()
            onResize(Math.min(maxSize, value + step))
          }
        } else {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault()
            onResize(Math.max(minSize, value - step))
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault()
            onResize(Math.min(maxSize, value + step))
          }
        }
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        startPos.current = isVertical ? e.clientX : e.clientY
        baseValue.current = value
        setDragging(true)
        document.body.style.cursor = isVertical ? 'col-resize' : 'row-resize'
        document.body.style.userSelect = 'none'
      }}
      className={
        isVertical
          ? `group relative z-10 w-1 shrink-0 cursor-col-resize ${
              position === 'left' ? '-ml-1' : '-mr-1'
            }`
          : `group relative z-10 h-1 shrink-0 cursor-row-resize ${
              position === 'left' ? '-mt-1' : '-mb-1'
            }`
      }
    >
      <div
        className={`absolute transition-colors ${
          dragging
            ? isVertical
              ? 'inset-y-0 left-1/2 w-px -translate-x-1/2 bg-blue-500'
              : 'inset-x-0 top-1/2 h-px -translate-y-1/2 bg-blue-500'
            : isVertical
              ? 'inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent group-hover:bg-blue-400'
              : 'inset-x-0 top-1/2 h-px -translate-y-1/2 bg-transparent group-hover:bg-blue-400'
        }`}
      />
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 ${
          dragging ? '!opacity-100' : ''
        }`}
      >
        <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} gap-0.5`}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`rounded-full ${dragging ? 'bg-blue-500' : 'bg-zinc-400 dark:bg-zinc-500'} ${
                isVertical ? 'h-[3px] w-[3px]' : 'h-[3px] w-[3px]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
