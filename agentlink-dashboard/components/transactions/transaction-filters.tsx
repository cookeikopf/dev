"use client"

import { Search, Download, Calendar } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { TransactionFilter } from "@/types"

interface TransactionFiltersProps {
  filter: TransactionFilter
  onFilterChange: (filter: TransactionFilter) => void
  onExport: () => void
}

export function TransactionFilters({ 
  filter, 
  onFilterChange,
  onExport 
}: TransactionFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search transactions..."
            value={filter.search || ''}
            onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
            className="pl-10"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filter.status || 'all'}
            onValueChange={(value) => onFilterChange({ ...filter, status: value as TransactionFilter['status'] })}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filter.type || 'all'}
            onValueChange={(value) => onFilterChange({ ...filter, type: value as TransactionFilter['type'] })}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="refund">Refund</SelectItem>
              <SelectItem value="fee">Fee</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={onExport}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Date From</Label>
          <Input
            type="date"
            value={filter.dateFrom || ''}
            onChange={(e) => onFilterChange({ ...filter, dateFrom: e.target.value })}
            className="w-[150px]"
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs">Date To</Label>
          <Input
            type="date"
            value={filter.dateTo || ''}
            onChange={(e) => onFilterChange({ ...filter, dateTo: e.target.value })}
            className="w-[150px]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Min Amount</Label>
          <Input
            type="number"
            placeholder="0"
            value={filter.minAmount || ''}
            onChange={(e) => onFilterChange({ ...filter, minAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="w-[120px]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Max Amount</Label>
          <Input
            type="number"
            placeholder="∞"
            value={filter.maxAmount || ''}
            onChange={(e) => onFilterChange({ ...filter, maxAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="w-[120px]"
          />
        </div>
      </div>
    </div>
  )
}
