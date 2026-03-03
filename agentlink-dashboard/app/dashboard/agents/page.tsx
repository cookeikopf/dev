"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AgentCard } from "@/components/agents/agent-card"
import { AgentTable } from "@/components/agents/agent-table"
import { AgentFilters } from "@/components/agents/agent-filters"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { api } from "@/lib/api"
import type { AgentFilter } from "@/types"

export default function AgentsPage() {
  const [filter, setFilter] = useState<AgentFilter>({
    search: '',
    status: 'all',
    sortBy: 'created',
    sortOrder: 'desc',
  })
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['agents', filter, page],
    queryFn: () => api.getAgents({ ...filter, page, limit: 12 }),
  })

  const handleSort = (field: string) => {
    setFilter(prev => ({
      ...prev,
      sortBy: field as AgentFilter['sortBy'],
      sortOrder: prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">
            Manage and monitor your registered agents
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Register Agent
        </Button>
      </div>

      <AgentFilters
        filter={filter}
        onFilterChange={setFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[280px]" />
            ))}
          </div>
        ) : (
          <Skeleton className="h-[400px]" />
        )
      ) : data?.data.length === 0 ? (
        <div className="flex h-[300px] flex-col items-center justify-center rounded-lg border border-dashed">
          <p className="text-lg font-medium">No agents found</p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your filters or register a new agent
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      ) : (
        <AgentTable
          agents={data?.data || []}
          sortBy={filter.sortBy || 'created'}
          sortOrder={filter.sortOrder || 'desc'}
          onSort={handleSort}
        />
      )}

      {data && data.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  onClick={() => setPage(p)}
                  isActive={page === p}
                  className="cursor-pointer"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                className={page >= data.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
