import { Injectable } from '@nestjs/common'
import type {
  AiResultItem,
  AuthenticatedUser,
  BatchTaskSummary,
  DashboardOrderData,
  DashboardOverview,
  DashboardSalesData,
  DashboardTrend,
  OperationsDashboard,
  OrderStatus,
} from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import { MerchantAccessService } from './merchant-access.service'
import { StoresService } from './stores.service'

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function comparisonRate(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 10_000) / 100
}

function money(value: number): string {
  return value.toFixed(2)
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
    private readonly storesService: StoresService,
  ) {}

  async getOverview(
    user: AuthenticatedUser,
    merchantId: string,
    storeId?: string,
  ): Promise<DashboardOverview> {
    await this.merchantAccess.assertAccess(user, merchantId)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [todayOrdersResult, allProductsResult, lowStockResult] =
      await this.prisma.$transaction([
        this.prisma.order.aggregate({
          _count: { id: true },
          _sum: { totalAmount: true },
          where: {
            merchantId,
            ...(storeId ? { storeId } : {}),
            createdAt: { gte: todayStart },
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
          },
        }),
        this.prisma.product.count({
          where: {
            merchantId,
            status: { not: 'ARCHIVED' },
            ...(storeId ? { listings: { some: { storeId, merchantId } } } : {}),
          },
        }),
        this.prisma.sku.count({
          where: {
            merchantId,
            stock: { lte: 5 },
            status: 'ACTIVE',
            ...(storeId
              ? {
                  product: {
                    listings: { some: { storeId, merchantId } },
                  },
                }
              : {}),
          },
        }),
      ])

    return {
      todayOrders: todayOrdersResult._count.id,
      todaySales: (todayOrdersResult._sum.totalAmount ?? 0).toString(),
      totalProducts: allProductsResult,
      lowStockItems: lowStockResult,
    }
  }

  async getTrend(
    user: AuthenticatedUser,
    merchantId: string,
    storeId?: string,
  ): Promise<DashboardTrend> {
    await this.merchantAccess.assertAccess(user, merchantId)

    const days = 14
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)

    const orders = await this.prisma.order.findMany({
      where: {
        merchantId,
        ...(storeId ? { storeId } : {}),
        createdAt: { gte: startDate },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      select: { totalAmount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const dateMap = new Map<string, { orders: number; sales: number }>()
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const key = localDateKey(date)
      dateMap.set(key, { orders: 0, sales: 0 })
    }

    for (const order of orders) {
      const key = localDateKey(order.createdAt)
      const entry = dateMap.get(key)
      if (entry) {
        entry.orders++
        entry.sales += Number(order.totalAmount)
      }
    }

    const sortedDates = Array.from(dateMap.keys()).sort()
    return {
      dates: sortedDates,
      orders: sortedDates.map((d) => dateMap.get(d)!.orders),
      sales: sortedDates.map((d) => dateMap.get(d)!.sales.toFixed(2)),
    }
  }

  async getSalesData(
    user: AuthenticatedUser,
    merchantId: string,
    days: number = 7,
    storeId?: string,
  ): Promise<DashboardSalesData> {
    await this.merchantAccess.assertAccess(user, merchantId)

    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)

    const previousStart = new Date(startDate)
    previousStart.setDate(previousStart.getDate() - days)

    const [currentOrders, previousOrders] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: {
          merchantId,
          ...(storeId ? { storeId } : {}),
          createdAt: { gte: startDate, lte: today },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        select: { totalAmount: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.order.findMany({
        where: {
          merchantId,
          ...(storeId ? { storeId } : {}),
          createdAt: { gte: previousStart, lt: startDate },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        select: { totalAmount: true },
      }),
    ])

    const currentTotalSales = currentOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    )
    const currentOrderCount = currentOrders.length
    const previousTotalSales = previousOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    )

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todaySales = currentOrders
      .filter((o) => o.createdAt >= todayStart)
      .reduce((sum, o) => sum + Number(o.totalAmount), 0)

    const avgOrderValue =
      currentOrderCount > 0 ? currentTotalSales / currentOrderCount : 0
    const growthRate =
      previousTotalSales > 0
        ? ((currentTotalSales - previousTotalSales) / previousTotalSales) * 100
        : 0

    // Build daily trend
    const dateMap = new Map<string, number>()
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      dateMap.set(localDateKey(date), 0)
    }
    for (const order of currentOrders) {
      const key = localDateKey(order.createdAt)
      if (dateMap.has(key)) {
        dateMap.set(key, dateMap.get(key)! + Number(order.totalAmount))
      }
    }

    const sortedDates = Array.from(dateMap.keys()).sort()

    return {
      summary: {
        todaySales: todaySales.toFixed(2),
        avgOrderValue: avgOrderValue.toFixed(2),
        growthRate: Math.round(growthRate * 100) / 100,
      },
      trend: {
        dates: sortedDates,
        sales: sortedDates.map((d) => dateMap.get(d)!.toFixed(2)),
      },
    }
  }

  async getOrderData(
    user: AuthenticatedUser,
    merchantId: string,
    days: number = 7,
    storeId?: string,
  ): Promise<DashboardOrderData> {
    await this.merchantAccess.assertAccess(user, merchantId)

    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)

    const [orders, completedCount, refundedCount] =
      await this.prisma.$transaction([
        this.prisma.order.findMany({
          where: {
            merchantId,
            ...(storeId ? { storeId } : {}),
            createdAt: { gte: startDate, lte: today },
          },
          select: { status: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.order.count({
          where: {
            merchantId,
            ...(storeId ? { storeId } : {}),
            status: 'COMPLETED',
          },
        }),
        this.prisma.order.count({
          where: {
            merchantId,
            ...(storeId ? { storeId } : {}),
            status: 'REFUNDED',
          },
        }),
      ])

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayOrders = orders.filter((o) => o.createdAt >= todayStart).length
    const totalOrders = orders.length
    const completedInPeriod = orders.filter(
      (o) => o.status === 'COMPLETED',
    ).length
    const completionRate =
      totalOrders > 0 ? (completedInPeriod / totalOrders) * 100 : 0

    // Build daily trend
    const dateMap = new Map<string, number>()
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      dateMap.set(localDateKey(date), 0)
    }
    for (const order of orders) {
      const key = localDateKey(order.createdAt)
      if (dateMap.has(key)) {
        dateMap.set(key, dateMap.get(key)! + 1)
      }
    }

    const sortedDates = Array.from(dateMap.keys()).sort()

    return {
      summary: {
        todayOrders,
        completedOrders: completedCount,
        refundedOrders: refundedCount,
        completionRate: Math.round(completionRate * 100) / 100,
      },
      trend: {
        dates: sortedDates,
        orders: sortedDates.map((d) => dateMap.get(d)!),
      },
    }
  }

  async getOperations(
    user: AuthenticatedUser,
    merchantId: string,
    days: number = 7,
    storeId?: string,
  ): Promise<OperationsDashboard> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const store = storeId
      ? await this.storesService.assertStore(user, merchantId, storeId)
      : null
    const merchant = store
      ? null
      : await this.prisma.merchant.findFirst({
          where: { id: merchantId },
          select: { defaultCurrency: true },
        })

    const endDate = new Date()
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)
    const previousEndDate = new Date(startDate)
    const previousStartDate = new Date(previousEndDate)
    previousStartDate.setDate(previousStartDate.getDate() - days)

    const orderScope = {
      merchantId,
      ...(storeId ? { storeId } : {}),
    }
    const listingScope = storeId
      ? { listings: { some: { merchantId, storeId } } }
      : {}

    const [
      currentOrders,
      previousOrders,
      lowStock,
      lowStockCount,
      pendingDrafts,
      failedTasks,
      actionableOrders,
      activeTaskRecords,
      recentRuns,
      recentOptimizations,
      runningAgentCount,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          ...orderScope,
          createdAt: { gte: startDate, lte: endDate },
        },
        select: {
          status: true,
          totalAmount: true,
          createdAt: true,
          items: {
            select: {
              productName: true,
              quantity: true,
              subtotal: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.order.findMany({
        where: {
          ...orderScope,
          createdAt: { gte: previousStartDate, lt: previousEndDate },
        },
        select: { status: true, totalAmount: true },
      }),
      this.prisma.sku.findMany({
        where: {
          merchantId,
          stock: { lte: 5 },
          status: 'ACTIVE',
          product: listingScope,
        },
        select: {
          id: true,
          code: true,
          name: true,
          stock: true,
          product: { select: { id: true, code: true, title: true } },
        },
        orderBy: [{ stock: 'asc' }, { code: 'asc' }],
        take: 8,
      }),
      this.prisma.sku.count({
        where: {
          merchantId,
          stock: { lte: 5 },
          status: 'ACTIVE',
          product: listingScope,
        },
      }),
      this.prisma.productOptimization.count({
        where: {
          merchantId,
          status: 'DRAFT',
          product: listingScope,
        },
      }),
      this.prisma.batchOptimizationTask.count({
        where: {
          merchantId,
          status: 'PARTIAL_FAILED',
          ...(storeId
            ? {
                items: {
                  some: {
                    product: {
                      listings: { some: { merchantId, storeId } },
                    },
                  },
                },
              }
            : {}),
        },
      }),
      this.prisma.order.count({
        where: {
          ...orderScope,
          status: { in: ['PENDING', 'CONFIRMED', 'REFUNDING'] },
        },
      }),
      this.prisma.batchOptimizationTask.findMany({
        where: {
          merchantId,
          status: { in: ['PENDING', 'RUNNING'] },
          ...(storeId
            ? {
                items: {
                  some: {
                    product: {
                      listings: { some: { merchantId, storeId } },
                    },
                  },
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.agentRun.findMany({
        where: { merchantId, ...(storeId ? { storeId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.productOptimization.findMany({
        where: {
          merchantId,
          product: listingScope,
        },
        include: {
          product: { select: { id: true, code: true, title: true } },
          batchItem: { select: { taskId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.agentRun.count({
        where: {
          merchantId,
          ...(storeId ? { storeId } : {}),
          status: { in: ['PLANNING', 'RUNNING'] },
        },
      }),
    ])

    const validCurrentOrders = currentOrders.filter(
      (order) => !['CANCELLED', 'REFUNDED'].includes(order.status),
    )
    const validPreviousOrders = previousOrders.filter(
      (order) => !['CANCELLED', 'REFUNDED'].includes(order.status),
    )
    const currentSales = validCurrentOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0,
    )
    const previousSales = validPreviousOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0,
    )
    const currentOrderCount = currentOrders.length
    const previousOrderCount = previousOrders.length
    const currentAverage =
      validCurrentOrders.length > 0
        ? currentSales / validCurrentOrders.length
        : 0
    const previousAverage =
      validPreviousOrders.length > 0
        ? previousSales / validPreviousOrders.length
        : 0
    const currentRefunds = currentOrders.filter(
      (order) => order.status === 'REFUNDED',
    ).length
    const previousRefunds = previousOrders.filter(
      (order) => order.status === 'REFUNDED',
    ).length

    const trendMap = new Map<string, { orders: number; sales: number }>()
    for (let index = 0; index < days; index++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + index)
      trendMap.set(localDateKey(date), { orders: 0, sales: 0 })
    }
    for (const order of currentOrders) {
      const entry = trendMap.get(localDateKey(order.createdAt))
      if (!entry) continue
      entry.orders += 1
      if (!['CANCELLED', 'REFUNDED'].includes(order.status)) {
        entry.sales += Number(order.totalAmount)
      }
    }

    const statusCounts = new Map<OrderStatus, number>()
    const productTotals = new Map<
      string,
      { productName: string; quantity: number; sales: number }
    >()
    for (const order of currentOrders) {
      const status = order.status
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)
      if (['CANCELLED', 'REFUNDED'].includes(order.status)) continue
      for (const item of order.items) {
        const current = productTotals.get(item.productName) ?? {
          productName: item.productName,
          quantity: 0,
          sales: 0,
        }
        current.quantity += item.quantity
        current.sales += Number(item.subtotal)
        productTotals.set(item.productName, current)
      }
    }

    const recentResults: AiResultItem[] = [
      ...recentRuns.map((run) => ({
        id: `agent:${run.id}`,
        type: 'AGENT_RUN' as const,
        status: run.status,
        title: run.message,
        description: run.answer ?? run.error ?? 'Agent 正在执行',
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
        agentRunId: run.id,
      })),
      ...recentOptimizations.map((optimization) => ({
        id: `optimization:${optimization.id}`,
        type: 'PRODUCT_OPTIMIZATION' as const,
        status: optimization.status,
        title: `${optimization.product.code} · ${optimization.product.title}`,
        description:
          optimization.error ??
          `面向 ${optimization.targetLanguage} 的商品优化草稿`,
        createdAt: optimization.createdAt.toISOString(),
        updatedAt: optimization.updatedAt.toISOString(),
        optimizationId: optimization.id,
        product: optimization.product,
        ...(optimization.batchItem
          ? { batchTaskId: optimization.batchItem.taskId }
          : {}),
        targetLanguage: optimization.targetLanguage,
      })),
    ]
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      .slice(0, 5)

    const activeTasks: BatchTaskSummary[] = activeTaskRecords.map((task) => {
      const processed =
        task.completedItems + task.failedItems + task.cancelledItems
      return {
        id: task.id,
        merchantId: task.merchantId,
        createdById: task.createdById,
        idempotencyKey: task.idempotencyKey,
        targetLanguage:
          task.targetLanguage as BatchTaskSummary['targetLanguage'],
        status: task.status,
        totalItems: task.totalItems,
        completedItems: task.completedItems,
        failedItems: task.failedItems,
        cancelledItems: task.cancelledItems,
        progress:
          task.totalItems === 0
            ? 0
            : Math.round((processed / task.totalItems) * 100),
        startedAt: task.startedAt?.toISOString(),
        completedAt: task.completedAt?.toISOString(),
        cancelledAt: task.cancelledAt?.toISOString(),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      }
    })

    const dates = Array.from(trendMap.keys()).sort()
    return {
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        previousStartDate: previousStartDate.toISOString(),
        previousEndDate: previousEndDate.toISOString(),
      },
      currency: store?.currency ?? merchant?.defaultCurrency ?? 'USD',
      metrics: {
        sales: {
          value: money(currentSales),
          previousValue: money(previousSales),
          changeRate: comparisonRate(currentSales, previousSales),
        },
        orders: {
          value: currentOrderCount,
          previousValue: previousOrderCount,
          changeRate: comparisonRate(currentOrderCount, previousOrderCount),
        },
        averageOrderValue: {
          value: money(currentAverage),
          previousValue: money(previousAverage),
          changeRate: comparisonRate(currentAverage, previousAverage),
        },
        refunds: {
          value: currentRefunds,
          previousValue: previousRefunds,
          changeRate: comparisonRate(currentRefunds, previousRefunds),
        },
      },
      trend: {
        dates,
        orders: dates.map((date) => trendMap.get(date)!.orders),
        sales: dates.map((date) => money(trendMap.get(date)!.sales)),
      },
      orderStatuses: Array.from(statusCounts.entries()).map(
        ([status, count]) => ({ status, count }),
      ),
      topProducts: Array.from(productTotals.values())
        .sort(
          (first, second) =>
            second.sales - first.sales || second.quantity - first.quantity,
        )
        .slice(0, 5)
        .map((item) => ({ ...item, sales: money(item.sales) })),
      lowStock: lowStock.map((sku) => ({
        skuId: sku.id,
        skuCode: sku.code,
        skuName: sku.name,
        productId: sku.product.id,
        productCode: sku.product.code,
        productTitle: sku.product.title,
        stock: sku.stock,
      })),
      todos: {
        pendingDrafts,
        failedTasks,
        actionableOrders,
        lowStockItems: lowStockCount,
      },
      activeTasks,
      recentResults,
      runningAgentCount,
    }
  }
}
