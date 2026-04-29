import { cn } from "@/lib/utils"

interface SkeletonProps {
  className?: string
  variant?: "default" | "text" | "circular" | "rectangular"
  width?: string | number
  height?: string | number
  lines?: number
}

export function Skeleton({ 
  className, 
  variant = "default", 
  width, 
  height, 
  lines = 1 
}: SkeletonProps) {
  if (variant === "text") {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 bg-muted rounded animate-pulse",
              className
            )}
            style={{
              width: i === lines - 1 ? "70%" : "100%",
              ...width && { width },
              ...height && { height }
            }}
          />
        ))}
      </div>
    )
  }

  if (variant === "circular") {
    return (
      <div
        className={cn(
          "rounded-full bg-muted animate-pulse",
          className
        )}
        style={{
          width: width || 40,
          height: height || 40
        }}
      />
    )
  }

  return (
    <div
      className={cn(
        "bg-muted rounded animate-pulse",
        variant === "rectangular" && "rounded-none",
        className
      )}
      style={{
        width,
        height
      }}
    />
  )
}
