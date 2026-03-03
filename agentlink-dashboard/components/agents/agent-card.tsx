"use client"

import Link from "next/link"
import { Bot, TrendingUp, Receipt, Star } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatCurrency, formatNumber, getStatusColor, truncateString } from "@/lib/utils"
import type { Agent } from "@/types"

interface AgentCardProps {
  agent: Agent
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link href={`/dashboard/agents/${agent.id}`}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <Bot className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{agent.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {truncateString(agent.identity, 30)}
                </p>
              </div>
            </div>
            <Badge 
              variant="outline" 
              className={getStatusColor(agent.status)}
            >
              {agent.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {agent.description}
          </p>
          
          <div className="flex flex-wrap gap-1">
            {agent.capabilities.slice(0, 3).map((cap) => (
              <Badge key={cap} variant="secondary" className="text-xs">
                {cap.replace(/_/g, ' ')}
              </Badge>
            ))}
            {agent.capabilities.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{agent.capabilities.length - 3}
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-4 pt-2 border-t">
            <div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span className="text-xs">Revenue</span>
              </div>
              <p className="text-sm font-medium">{formatCurrency(agent.totalRevenue)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Receipt className="h-3 w-3" />
                <span className="text-xs">Txns</span>
              </div>
              <p className="text-sm font-medium">{formatNumber(agent.totalTransactions)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Star className="h-3 w-3" />
                <span className="text-xs">Rating</span>
              </div>
              <p className="text-sm font-medium">{agent.reputation.toFixed(1)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
