"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReputationBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function ReputationBadge({ 
  score, 
  size = 'md',
  showLabel = true 
}: ReputationBadgeProps) {
  const getColor = (score: number) => {
    if (score >= 4.5) return "text-green-500"
    if (score >= 4.0) return "text-blue-500"
    if (score >= 3.0) return "text-yellow-500"
    return "text-red-500"
  }

  const getLabel = (score: number) => {
    if (score >= 4.5) return "Excellent"
    if (score >= 4.0) return "Very Good"
    if (score >= 3.0) return "Good"
    if (score >= 2.0) return "Fair"
    return "Poor"
  }

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }

  const starSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  return (
    <div className={cn("flex items-center gap-1.5", sizeClasses[size])}>
      <Star className={cn("fill-yellow-400 text-yellow-400", starSizes[size])} />
      <span className="font-medium">{score.toFixed(1)}</span>
      {showLabel && (
        <span className={cn("text-muted-foreground", getColor(score))}>
          ({getLabel(score)})
        </span>
      )}
    </div>
  )
}
