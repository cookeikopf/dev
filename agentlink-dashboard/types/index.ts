export interface Agent {
  id: string;
  name: string;
  identity: string;
  description: string;
  capabilities: string[];
  status: 'active' | 'inactive' | 'pending';
  reputation: number;
  totalRevenue: number;
  totalTransactions: number;
  createdAt: string;
  updatedAt: string;
  avatar?: string;
  owner: string;
}

export interface Transaction {
  id: string;
  agentId: string;
  agentName: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  type: 'payment' | 'refund' | 'fee';
  description: string;
  from: string;
  to: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardStats {
  totalAgents: number;
  totalVolume: number;
  totalTransactions: number;
  activeAgents: number;
  revenueChange: number;
  transactionChange: number;
  agentChange: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  transactions: number;
}

export interface ActivityItem {
  id: string;
  type: 'transaction' | 'agent_created' | 'agent_updated' | 'status_change';
  title: string;
  description: string;
  timestamp: string;
  agentId?: string;
  agentName?: string;
}

export interface AgentFilter {
  search?: string;
  status?: Agent['status'] | 'all';
  sortBy?: 'name' | 'revenue' | 'transactions' | 'created';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionFilter {
  search?: string;
  agentId?: string;
  status?: Transaction['status'] | 'all';
  type?: Transaction['type'] | 'all';
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
}
