"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransactionTable } from "@/components/transactions/transaction-table"
import { TransactionFilters } from "@/components/transactions/transaction-filters"
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
import type { TransactionFilter } from "@/types"

export default function TransactionsPage() {
  const [filter, setFilter] = useState<TransactionFilter>({
    search: '',
    status: 'all',
    type: 'all',
  })
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filter, page],
    queryFn: () => api.getTransactions({ ...filter, page, limit: 20 }),
  })

  const handleExport = () => {
    // In a real app, this would generate and download a CSV
    const csvContent = "data:text/csv;charset=utf-8," 
      + "ID,Agent,Type,Status,Amount,Date\n"
      + (data?.data.map(tx => 
          `${tx.id},${tx.agentName},${tx.type},${tx.status},${tx.amount},${tx.createdAt}`
        ).join("\n") || "")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "transactions.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage all payment transactions
          </p>
        </div>
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <TransactionFilters
        filter={filter}
        onFilterChange={setFilter}
        onExport={handleExport}
      />

      {isLoading ? (
        <Skeleton className="h-[500px]" />
      ) : data?.data.length === 0 ? (
        <div className="flex h-[300px] flex-col items-center justify-center rounded-lg border border-dashed">
          <p className="text-lg font-medium">No transactions found</p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <TransactionTable transactions={data?.data || []} />
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
            {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
              // Show pages around current page
              let pageNum = page
              if (page <= 3) {
                pageNum = i + 1
              } else if (page >= data.totalPages - 2) {
                pageNum = data.totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }
              
              if (pageNum < 1 || pageNum > data.totalPages) return null
              
              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    onClick={() => setPage(pageNum)}
                    isActive={page === pageNum}
                    className="cursor-pointer"
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              )
            })}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                className={page >= data.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {data && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.total)} of {data.total} transactions
        </p>
      )}
    </div>
  )
}
