import { useWorkspaceStore } from '@/stores/workspaceStore'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  className?: string
  rounded?: string
}

export function Skeleton({
  width,
  height,
  className = '',
  rounded = 'rounded-md',
}: SkeletonProps) {
  const isDark = useWorkspaceStore((s) => s.theme) === 'dark'

  return (
    <div
      className={`${rounded} ${className}`}
      style={{
        width,
        height,
        background: isDark
          ? 'linear-gradient(90deg, rgb(39 39 42) 25%, rgb(63 63 70) 50%, rgb(39 39 42) 75%)'
          : 'linear-gradient(90deg, rgb(228 228 231) 25%, rgb(212 212 216) 50%, rgb(228 228 231) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite linear',
      }}
    />
  )
}
