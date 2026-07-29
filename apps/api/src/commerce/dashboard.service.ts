import { Injectable } from '@nestjs/common'
import type {
  AuthenticatedUser,
  DashboardOrderData,
  DashboardOverview,
  DashboardSalesData,
  DashboardTrend,
} from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import { MerchantAccessService } from './merchant-access.service'

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
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
}
