"use client"

import { TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatNumber } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: number
  change: number
  prefix?: string
  suffix?: string
  format?: "currency" | "number" | "percent"
  icon: React.ReactNode
}

export function StatsCard({ 
  title, 
  value, 
  change, 
  prefix = "", 
  suffix = "",
  format = "number",
  icon 
}: StatsCardProps) {
  const isPositive = change >= 0
  
  const formattedValue = () => {
    switch (format) {
      case "currency":
        return formatCurrency(value)
      case "number":
        return `${prefix}${formatNumber(value)}${suffix}`
      case "percent":
        return `${prefix}${value}${suffix}`
      default:
        return `${prefix}${value}${suffix}`
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-8 w-8 rounded-md bg-primary/10 p-1.5 text-primary">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue()}</div>
        <div className="mt-1 flex items-center text-xs">
          <span
            className={`flex items-center gap-0.5 font-medium ${
              isPositive ? "text-green-500" : "text-red-500"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {isPositive ? "+" : ""}
            {change}%
          </span>
          <span className="ml-1 text-muted-foreground">from last month</span>
        </div>
      </CardContent>
    </Card>
  )
}
