"use client"

import { Search, SlidersHorizontal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AgentFilter } from "@/types"

interface AgentFiltersProps {
  filter: AgentFilter
  onFilterChange: (filter: AgentFilter) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
}

export function AgentFilters({ 
  filter, 
  onFilterChange,
  viewMode,
  onViewModeChange 
}: AgentFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search agents..."
            value={filter.search || ''}
            onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
            className="pl-10"
          />
        </div>
        
        <Select
          value={filter.status || 'all'}
          onValueChange={(value) => onFilterChange({ ...filter, status: value as AgentFilter['status'] })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup 
              value={`${filter.sortBy}-${filter.sortOrder}`}
              onValueChange={(value) => {
                const [sortBy, sortOrder] = value.split('-') as [AgentFilter['sortBy'], AgentFilter['sortOrder']]
                onFilterChange({ ...filter, sortBy, sortOrder })
              }}
            >
              <DropdownMenuRadioItem value="name-asc">Name (A-Z)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name-desc">Name (Z-A)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="revenue-desc">Revenue (High-Low)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="revenue-asc">Revenue (Low-High)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="transactions-desc">Transactions (High-Low)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="created-desc">Recently Added</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('grid')}
            className="rounded-none rounded-l-md"
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
            className="rounded-none rounded-r-md"
          >
            List
          </Button>
        </div>
      </div>
    </div>
  )
}
