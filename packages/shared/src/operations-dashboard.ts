import type { AiResultItem } from './agent'
import type { BatchTaskSummary } from './batch-task'
import type { OrderStatus } from './commerce'

export interface DashboardPeriod {
  days: number
  startDate: string
  endDate: string
  previousStartDate: string
  previousEndDate: string
}

export interface DashboardComparisonMetric {
  value: number
  previousValue: number
  changeRate: number | null
}

export interface DashboardMoneyComparisonMetric {
  value: string
  previousValue: string
  changeRate: number | null
}

export interface DashboardStatusItem {
  status: OrderStatus
  count: number
}

export interface DashboardTopProduct {
  productName: string
  quantity: number
  sales: string
}

export interface DashboardLowStockItem {
  skuId: string
  skuCode: string
  skuName: string
  productId: string
  productCode: string
  productTitle: string
  stock: number
}

export interface DashboardTodoSummary {
  pendingDrafts: number
  failedTasks: number
  actionableOrders: number
  lowStockItems: number
}

export interface OperationsDashboard {
  period: DashboardPeriod
  currency: string
  metrics: {
    sales: DashboardMoneyComparisonMetric
    orders: DashboardComparisonMetric
    averageOrderValue: DashboardMoneyComparisonMetric
    refunds: DashboardComparisonMetric
  }
  trend: {
    dates: string[]
    orders: number[]
    sales: string[]
  }
  orderStatuses: DashboardStatusItem[]
  topProducts: DashboardTopProduct[]
  lowStock: DashboardLowStockItem[]
  todos: DashboardTodoSummary
  activeTasks: BatchTaskSummary[]
  recentResults: AiResultItem[]
  runningAgentCount: number
}
