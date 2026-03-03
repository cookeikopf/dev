"use client"

import Link from "next/link"
import { ArrowRightLeft, ArrowUpRight, ArrowDownLeft, Minus } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDateTime, getStatusColor, truncateString } from "@/lib/utils"
import type { Transaction } from "@/types"

interface TransactionTableProps {
  transactions: Transaction[]
}

const typeIcons: Record<Transaction['type'], React.ReactNode> = {
  payment: <ArrowUpRight className="h-4 w-4" />,
  refund: <ArrowDownLeft className="h-4 w-4" />,
  fee: <Minus className="h-4 w-4" />,
}

const typeColors: Record<Transaction['type'], string> = {
  payment: "bg-blue-500/10 text-blue-500",
  refund: "bg-orange-500/10 text-orange-500",
  fee: "bg-purple-500/10 text-purple-500",
}

export function TransactionTable({ transactions }: TransactionTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transaction</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No transactions found
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((tx) => (
              <TableRow key={tx.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-2 ${typeColors[tx.type]}`}>
                      {typeIcons[tx.type]}
                    </div>
                    <div>
                      <p className="font-medium">{truncateString(tx.id, 12)}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {tx.description}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Link 
                    href={`/dashboard/agents/${tx.agentId}`}
                    className="text-sm hover:underline"
                  >
                    {tx.agentName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(tx.type)}
                  >
                    {tx.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(tx.status)}
                  >
                    {tx.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(tx.amount, tx.currency)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(tx.createdAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
