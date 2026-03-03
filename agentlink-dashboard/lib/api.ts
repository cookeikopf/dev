import { 
  Agent, 
  Transaction, 
  DashboardStats, 
  RevenueData, 
  ActivityItem,
  PaginatedResponse,
  AgentFilter,
  TransactionFilter 
} from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// Mock data for development
const mockAgents: Agent[] = [
  {
    id: 'agent_1',
    name: 'Payment Processor Alpha',
    identity: 'did:agentlink:payment-alpha',
    description: 'Automated payment processing agent for e-commerce transactions',
    capabilities: ['payment_processing', 'refund_handling', 'currency_exchange'],
    status: 'active',
    reputation: 4.8,
    totalRevenue: 1250000,
    totalTransactions: 15420,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-03-20T14:30:00Z',
    owner: 'user_1',
  },
  {
    id: 'agent_2',
    name: 'Escrow Service Beta',
    identity: 'did:agentlink:escrow-beta',
    description: 'Secure escrow service for peer-to-peer transactions',
    capabilities: ['escrow', 'dispute_resolution', 'multi_sig'],
    status: 'active',
    reputation: 4.9,
    totalRevenue: 890000,
    totalTransactions: 8750,
    createdAt: '2024-02-01T08:00:00Z',
    updatedAt: '2024-03-19T16:45:00Z',
    owner: 'user_2',
  },
  {
    id: 'agent_3',
    name: 'Subscription Manager',
    identity: 'did:agentlink:sub-manager',
    description: 'Handles recurring subscription payments and billing',
    capabilities: ['subscription_management', 'billing', 'invoice_generation'],
    status: 'active',
    reputation: 4.5,
    totalRevenue: 650000,
    totalTransactions: 12300,
    createdAt: '2024-01-20T12:00:00Z',
    updatedAt: '2024-03-18T09:15:00Z',
    owner: 'user_1',
  },
  {
    id: 'agent_4',
    name: 'Cross-Chain Bridge',
    identity: 'did:agentlink:bridge-gamma',
    description: 'Facilitates cross-chain asset transfers',
    capabilities: ['cross_chain', 'liquidity_provision', 'swap'],
    status: 'pending',
    reputation: 0,
    totalRevenue: 0,
    totalTransactions: 0,
    createdAt: '2024-03-15T14:00:00Z',
    updatedAt: '2024-03-15T14:00:00Z',
    owner: 'user_3',
  },
  {
    id: 'agent_5',
    name: 'Invoice Generator Pro',
    identity: 'did:agentlink:invoice-pro',
    description: 'Automated invoice generation and tracking',
    capabilities: ['invoice_generation', 'payment_tracking', 'reminders'],
    status: 'inactive',
    reputation: 3.8,
    totalRevenue: 125000,
    totalTransactions: 2100,
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-03-01T11:00:00Z',
    owner: 'user_2',
  },
]

const mockTransactions: Transaction[] = [
  {
    id: 'tx_1',
    agentId: 'agent_1',
    agentName: 'Payment Processor Alpha',
    amount: 150.00,
    currency: 'USD',
    status: 'completed',
    type: 'payment',
    description: 'E-commerce purchase #12345',
    from: 'customer_1',
    to: 'merchant_1',
    createdAt: '2024-03-20T14:30:00Z',
  },
  {
    id: 'tx_2',
    agentId: 'agent_2',
    agentName: 'Escrow Service Beta',
    amount: 2500.00,
    currency: 'USD',
    status: 'completed',
    type: 'payment',
    description: 'Freelance project escrow',
    from: 'client_1',
    to: 'freelancer_1',
    createdAt: '2024-03-20T13:15:00Z',
  },
  {
    id: 'tx_3',
    agentId: 'agent_1',
    agentName: 'Payment Processor Alpha',
    amount: 75.50,
    currency: 'USD',
    status: 'pending',
    type: 'payment',
    description: 'Subscription renewal',
    from: 'customer_2',
    to: 'merchant_2',
    createdAt: '2024-03-20T12:00:00Z',
  },
  {
    id: 'tx_4',
    agentId: 'agent_3',
    agentName: 'Subscription Manager',
    amount: 29.99,
    currency: 'USD',
    status: 'completed',
    type: 'payment',
    description: 'Monthly SaaS subscription',
    from: 'customer_3',
    to: 'saas_company',
    createdAt: '2024-03-20T10:45:00Z',
  },
  {
    id: 'tx_5',
    agentId: 'agent_2',
    agentName: 'Escrow Service Beta',
    amount: 500.00,
    currency: 'USD',
    status: 'failed',
    type: 'payment',
    description: 'Failed escrow release',
    from: 'client_2',
    to: 'freelancer_2',
    createdAt: '2024-03-20T09:30:00Z',
  },
  {
    id: 'tx_6',
    agentId: 'agent_1',
    agentName: 'Payment Processor Alpha',
    amount: 25.00,
    currency: 'USD',
    status: 'completed',
    type: 'fee',
    description: 'Transaction fee',
    from: 'merchant_1',
    to: 'agentlink',
    createdAt: '2024-03-20T08:00:00Z',
  },
  {
    id: 'tx_7',
    agentId: 'agent_3',
    agentName: 'Subscription Manager',
    amount: 99.00,
    currency: 'USD',
    status: 'completed',
    type: 'refund',
    description: 'Annual plan refund',
    from: 'saas_company',
    to: 'customer_4',
    createdAt: '2024-03-19T16:00:00Z',
  },
  {
    id: 'tx_8',
    agentId: 'agent_1',
    agentName: 'Payment Processor Alpha',
    amount: 499.99,
    currency: 'USD',
    status: 'completed',
    type: 'payment',
    description: 'Electronics purchase',
    from: 'customer_5',
    to: 'merchant_3',
    createdAt: '2024-03-19T14:20:00Z',
  },
]

// API Client
class ApiClient {
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // In production, this would make actual API calls
    // For now, we'll use mock data
    await new Promise(resolve => setTimeout(resolve, 300)) // Simulate network delay
    
    // Simulate API errors occasionally
    if (Math.random() < 0.02) {
      throw new Error('Network error')
    }
    
    return this.getMockData(endpoint) as T
  }

  private getMockData(endpoint: string): unknown {
    // Parse endpoint and return appropriate mock data
    if (endpoint.includes('/agents?')) {
      return this.filterAgents(endpoint)
    }
    if (endpoint.includes('/agents/') && !endpoint.includes('/transactions')) {
      const id = endpoint.split('/agents/')[1]
      return mockAgents.find(a => a.id === id) || null
    }
    if (endpoint.includes('/agents/') && endpoint.includes('/transactions')) {
      const id = endpoint.split('/agents/')[1].split('/transactions')[0]
      return mockTransactions.filter(t => t.agentId === id)
    }
    if (endpoint.includes('/transactions')) {
      return this.filterTransactions(endpoint)
    }
    if (endpoint.includes('/stats')) {
      return this.getDashboardStats()
    }
    if (endpoint.includes('/revenue')) {
      return this.getRevenueData()
    }
    if (endpoint.includes('/activity')) {
      return this.getActivityFeed()
    }
    if (endpoint === '/agents') {
      return {
        data: mockAgents,
        total: mockAgents.length,
        page: 1,
        limit: 10,
        totalPages: 1,
      }
    }
    return null
  }

  private filterAgents(endpoint: string): PaginatedResponse<Agent> {
    const url = new URL(`http://localhost${endpoint}`)
    const search = url.searchParams.get('search')?.toLowerCase()
    const status = url.searchParams.get('status')
    const sortBy = url.searchParams.get('sortBy') || 'created'
    const sortOrder = url.searchParams.get('sortOrder') || 'desc'
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')

    let filtered = [...mockAgents]

    if (search) {
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(search) ||
        a.description.toLowerCase().includes(search) ||
        a.identity.toLowerCase().includes(search)
      )
    }

    if (status && status !== 'all') {
      filtered = filtered.filter(a => a.status === status)
    }

    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'revenue':
          comparison = a.totalRevenue - b.totalRevenue
          break
        case 'transactions':
          comparison = a.totalTransactions - b.totalTransactions
          break
        case 'created':
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    const start = (page - 1) * limit
    const end = start + limit

    return {
      data: filtered.slice(start, end),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    }
  }

  private filterTransactions(endpoint: string): PaginatedResponse<Transaction> {
    const url = new URL(`http://localhost${endpoint}`)
    const search = url.searchParams.get('search')?.toLowerCase()
    const agentId = url.searchParams.get('agentId')
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const minAmount = url.searchParams.get('minAmount')
    const maxAmount = url.searchParams.get('maxAmount')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')

    let filtered = [...mockTransactions]

    if (search) {
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(search) ||
        t.agentName.toLowerCase().includes(search) ||
        t.id.toLowerCase().includes(search)
      )
    }

    if (agentId) {
      filtered = filtered.filter(t => t.agentId === agentId)
    }

    if (status && status !== 'all') {
      filtered = filtered.filter(t => t.status === status)
    }

    if (type && type !== 'all') {
      filtered = filtered.filter(t => t.type === type)
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      filtered = filtered.filter(t => new Date(t.createdAt) >= fromDate)
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      filtered = filtered.filter(t => new Date(t.createdAt) <= toDate)
    }

    if (minAmount) {
      filtered = filtered.filter(t => t.amount >= parseFloat(minAmount))
    }

    if (maxAmount) {
      filtered = filtered.filter(t => t.amount <= parseFloat(maxAmount))
    }

    filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    const start = (page - 1) * limit
    const end = start + limit

    return {
      data: filtered.slice(start, end),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    }
  }

  private getDashboardStats(): DashboardStats {
    const activeAgents = mockAgents.filter(a => a.status === 'active').length
    const totalVolume = mockTransactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0)
    const totalTransactions = mockTransactions.length

    return {
      totalAgents: mockAgents.length,
      totalVolume,
      totalTransactions,
      activeAgents,
      revenueChange: 12.5,
      transactionChange: 8.3,
      agentChange: 15.2,
    }
  }

  private getRevenueData(): RevenueData[] {
    const data: RevenueData[] = []
    const today = new Date()
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      
      // Generate realistic-looking data
      const baseRevenue = 50000 + Math.random() * 30000
      const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.6 : 1
      const revenue = Math.round(baseRevenue * weekendFactor)
      const transactions = Math.round(revenue / (50 + Math.random() * 100))
      
      data.push({
        date: date.toISOString().split('T')[0],
        revenue,
        transactions,
      })
    }
    
    return data
  }

  private getActivityFeed(): ActivityItem[] {
    return [
      {
        id: 'act_1',
        type: 'transaction',
        title: 'New transaction completed',
        description: 'Payment Processor Alpha processed $150.00',
        timestamp: '2024-03-20T14:30:00Z',
        agentId: 'agent_1',
        agentName: 'Payment Processor Alpha',
      },
      {
        id: 'act_2',
        type: 'agent_created',
        title: 'New agent registered',
        description: 'Cross-Chain Bridge was added to the network',
        timestamp: '2024-03-15T14:00:00Z',
        agentId: 'agent_4',
        agentName: 'Cross-Chain Bridge',
      },
      {
        id: 'act_3',
        type: 'status_change',
        title: 'Agent status updated',
        description: 'Invoice Generator Pro was deactivated',
        timestamp: '2024-03-01T11:00:00Z',
        agentId: 'agent_5',
        agentName: 'Invoice Generator Pro',
      },
      {
        id: 'act_4',
        type: 'transaction',
        title: 'High-value transaction',
        description: 'Escrow Service Beta processed $2,500.00',
        timestamp: '2024-03-20T13:15:00Z',
        agentId: 'agent_2',
        agentName: 'Escrow Service Beta',
      },
      {
        id: 'act_5',
        type: 'agent_updated',
        title: 'Agent capabilities updated',
        description: 'Payment Processor Alpha added currency exchange',
        timestamp: '2024-03-19T10:00:00Z',
        agentId: 'agent_1',
        agentName: 'Payment Processor Alpha',
      },
    ]
  }

  // Public API methods
  async getAgents(filter?: AgentFilter): Promise<PaginatedResponse<Agent>> {
    const params = new URLSearchParams()
    if (filter?.search) params.set('search', filter.search)
    if (filter?.status && filter.status !== 'all') params.set('status', filter.status)
    if (filter?.sortBy) params.set('sortBy', filter.sortBy)
    if (filter?.sortOrder) params.set('sortOrder', filter.sortOrder)
    
    return this.fetch(`/agents?${params.toString()}`)
  }

  async getAgent(id: string): Promise<Agent | null> {
    return this.fetch(`/agents/${id}`)
  }

  async getAgentTransactions(id: string): Promise<Transaction[]> {
    return this.fetch(`/agents/${id}/transactions`)
  }

  async getTransactions(filter?: TransactionFilter & { page?: number; limit?: number }): Promise<PaginatedResponse<Transaction>> {
    const params = new URLSearchParams()
    if (filter?.search) params.set('search', filter.search)
    if (filter?.agentId) params.set('agentId', filter.agentId)
    if (filter?.status && filter.status !== 'all') params.set('status', filter.status)
    if (filter?.type && filter.type !== 'all') params.set('type', filter.type)
    if (filter?.dateFrom) params.set('dateFrom', filter.dateFrom)
    if (filter?.dateTo) params.set('dateTo', filter.dateTo)
    if (filter?.minAmount) params.set('minAmount', filter.minAmount.toString())
    if (filter?.maxAmount) params.set('maxAmount', filter.maxAmount.toString())
    if (filter?.page) params.set('page', filter.page.toString())
    if (filter?.limit) params.set('limit', filter.limit.toString())
    
    return this.fetch(`/transactions?${params.toString()}`)
  }

  async getDashboardStats(): Promise<DashboardStats> {
    return this.fetch('/stats')
  }

  async getRevenueData(): Promise<RevenueData[]> {
    return this.fetch('/revenue')
  }

  async getActivityFeed(): Promise<ActivityItem[]> {
    return this.fetch('/activity')
  }
}

export const api = new ApiClient()
