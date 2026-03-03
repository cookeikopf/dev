"use client"

import Link from "next/link"
import { Bot, Star, ArrowUpDown } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatNumber, getStatusColor } from "@/lib/utils"
import type { Agent } from "@/types"

interface AgentTableProps {
  agents: Agent[]
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSort: (field: string) => void
}

export function AgentTable({ agents, sortBy, sortOrder, onSort }: AgentTableProps) {
  const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=active]:bg-accent"
      onClick={() => onSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead>
              <SortButton field="status">Status</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="revenue">Revenue</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="transactions">Transactions</SortButton>
            </TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Capabilities</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No agents found
              </TableCell>
            </TableRow>
          ) : (
            agents.map((agent) => (
              <TableRow key={agent.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/dashboard/agents/${agent.id}`} className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {agent.identity}
                      </p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(agent.status)}
                  >
                    {agent.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(agent.totalRevenue)}
                </TableCell>
                <TableCell>
                  {formatNumber(agent.totalTransactions)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{agent.reputation.toFixed(1)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {agent.capabilities.slice(0, 2).map((cap) => (
                      <Badge key={cap} variant="secondary" className="text-xs">
                        {cap.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                    {agent.capabilities.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{agent.capabilities.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
