"use client"

import Link from "next/link"
import { TrendingUp, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatNumber, getStatusColor } from "@/lib/utils"
import type { Agent } from "@/types"

interface TopAgentsProps {
  agents: Agent[]
}

export function TopAgents({ agents }: TopAgentsProps) {
  // Sort by revenue and take top 5
  const topAgents = [...agents]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Top Performing Agents</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              By total revenue generated
            </p>
          </div>
          <Link 
            href="/dashboard/agents"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topAgents.map((agent, index) => (
            <Link
              key={agent.id}
              href={`/dashboard/agents/${agent.id}`}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-medium text-sm">
                {index + 1}
              </div>
              
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {agent.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{agent.name}</p>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getStatusColor(agent.status)}`}
                  >
                    {agent.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {agent.totalTransactions.toLocaleString()} transactions
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-sm font-medium">
                  {formatCurrency(agent.totalRevenue)}
                </p>
                <div className="flex items-center justify-end gap-1 text-xs text-green-500">
                  <TrendingUp className="h-3 w-3" />
                  <span>+{(Math.random() * 20 + 5).toFixed(1)}%</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
