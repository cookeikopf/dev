"use client"

import { use } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { 
  ArrowLeft, 
  Bot, 
  Calendar, 
  Copy, 
  Edit, 
  ExternalLink,
  Receipt,
  Star,
  TrendingUp,
  User
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { TransactionTable } from "@/components/transactions/transaction-table"
import { ReputationBadge } from "@/components/agents/reputation-badge"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { api } from "@/lib/api"
import { 
  formatCurrency, 
  formatDate, 
  formatNumber, 
  getStatusColor,
  truncateString 
} from "@/lib/utils"

interface AgentDetailPageProps {
  params: Promise<{ id: string }>
}

export default function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = use(params)

  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => api.getAgent(id),
  })

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['agent-transactions', id],
    queryFn: () => api.getAgentTransactions(id),
  })

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['revenue-data'],
    queryFn: api.getRevenueData,
  })

  if (agentLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center">
        <p className="text-lg font-medium">Agent not found</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/agents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Agents
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/agents">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agents
        </Link>
      </Button>

      {/* Agent Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-primary text-xl">
              <Bot className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{agent.name}</h1>
              <Badge 
                variant="outline" 
                className={getStatusColor(agent.status)}
              >
                {agent.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{agent.description}</p>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="font-mono">{truncateString(agent.identity, 40)}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Public
          </Button>
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Edit Agent
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {formatCurrency(agent.totalRevenue)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {formatNumber(agent.totalTransactions)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reputation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReputationBadge score={agent.reputation} size="lg" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="text-lg font-medium">
                {formatDate(agent.createdAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {revenueLoading ? (
            <Skeleton className="h-[300px]" />
          ) : revenueData ? (
            <RevenueChart data={revenueData} />
          ) : null}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          {transactionsLoading ? (
            <Skeleton className="h-[400px]" />
          ) : transactions ? (
            <TransactionTable transactions={transactions} />
          ) : null}
        </TabsContent>

        <TabsContent value="capabilities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agent.capabilities.map((capability) => (
                  <div
                    key={capability}
                    className="flex items-center gap-3 p-4 rounded-lg border"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium capitalize">
                        {capability.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Active capability
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Agent ID</label>
                  <p className="text-sm text-muted-foreground font-mono">{agent.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Owner</label>
                  <p className="text-sm text-muted-foreground font-mono">{agent.owner}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Created At</label>
                  <p className="text-sm text-muted-foreground">{formatDateTime(agent.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Last Updated</label>
                  <p className="text-sm text-muted-foreground">{formatDateTime(agent.updatedAt)}</p>
                </div>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button variant="outline">Deactivate Agent</Button>
                <Button variant="destructive">Delete Agent</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
