"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/utils"
import type { RevenueData } from "@/types"

interface TransactionVolumeChartProps {
  data: RevenueData[]
}

export function TransactionVolumeChart({ data }: TransactionVolumeChartProps) {
  const chartData = useMemo(() => {
    // Group by week for cleaner visualization
    const weeklyData: Record<string, number> = {}
    
    data.forEach((item) => {
      const date = new Date(item.date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]
      
      weeklyData[weekKey] = (weeklyData[weekKey] || 0) + item.transactions
    })
    
    return Object.entries(weeklyData).map(([date, transactions]) => ({
      date: formatDate(date),
      transactions,
    }))
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Volume</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Weekly transaction count
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm">
                        <p className="text-sm text-muted-foreground">
                          Week of {payload[0].payload.date}
                        </p>
                        <p className="text-lg font-bold">
                          {payload[0].value as number} transactions
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar
                dataKey="transactions"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
