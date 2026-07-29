import { Injectable } from '@nestjs/common'
import type {
  AgentToolCallSummary,
  AgentToolName,
  AuthenticatedUser,
  OptimizationLanguage,
  ProductSummary,
} from '@cross-border/shared'

import { AuditLogsService } from '../commerce/audit-logs.service'
import { DashboardService } from '../commerce/dashboard.service'
import { OrdersService } from '../commerce/orders.service'
import { ProductsService } from '../commerce/products.service'
import {
  agentToolInputSchemas,
  isAgentToolName,
  type PlannedAgentToolCall,
} from './agent-tools.contract'
import { PlatformRulesService } from './platform-rules.service'
import { ProductOptimizationsService } from './product-optimizations.service'

@Injectable()
export class AgentToolsService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
    private readonly dashboardService: DashboardService,
    private readonly rulesService: PlatformRulesService,
    private readonly optimizationsService: ProductOptimizationsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    merchantId: string,
    call: PlannedAgentToolCall,
    storeId?: string,
  ): Promise<AgentToolCallSummary> {
    if (!isAgentToolName(call.name)) {
      return this.failedCall(actor, merchantId, call, '模型请求了未授权工具')
    }
    const parsed = agentToolInputSchemas[call.name].safeParse(call.arguments)
    if (!parsed.success) {
      return this.failedCall(
        actor,
        merchantId,
        call,
        '工具参数未通过服务端校验',
      )
    }
    const input = parsed.data as Record<string, unknown>
    try {
      const output = await this.runTool(
        actor,
        merchantId,
        call.name,
        input,
        storeId,
      )
      const result: AgentToolCallSummary = {
        id: call.id,
        name: call.name,
        status: 'success',
        input,
        output,
      }
      await this.auditLogsService.recordAgentToolCall({
        actor,
        merchantId,
        toolCallId: call.id,
        toolName: call.name,
        arguments: input,
        status: 'success',
        output,
      })
      return result
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : '业务工具执行失败'
      return this.failedCall(actor, merchantId, call, message, input)
    }
  }

  private async runTool(
    actor: AuthenticatedUser,
    merchantId: string,
    name: AgentToolName,
    input: Record<string, unknown>,
    storeId?: string,
  ): Promise<unknown> {
    switch (name) {
      case 'search_products': {
        const result = await this.productsService.list(actor, merchantId, {
          page: 1,
          pageSize: 5,
          keyword: input.keyword as string | undefined,
          ...(storeId ? { storeId } : {}),
        })
        return {
          total: result.total,
          items: result.items.map((product) => ({
            id: product.id,
            code: product.code,
            title: product.title,
            status: product.status,
            language: product.language,
            version: product.version,
            skuCount: product.skus.length,
          })),
        }
      }
      case 'get_inventory': {
        const product = await this.findProductByCode(
          actor,
          merchantId,
          input.productCode as string,
          storeId,
        )
        return {
          productId: product.id,
          productCode: product.code,
          title: product.title,
          skus: product.skus.map((sku) => ({
            code: sku.code,
            name: sku.name,
            stock: sku.stock,
            status: sku.status,
          })),
          totalStock: product.skus.reduce((sum, sku) => sum + sku.stock, 0),
        }
      }
      case 'get_order_status': {
        const result = await this.ordersService.list(actor, merchantId, {
          page: 1,
          pageSize: 5,
          keyword: input.orderNo as string,
          ...(storeId ? { storeId } : {}),
        })
        const order = result.items.find(
          (item) => item.orderNo === input.orderNo,
        )
        if (!order) throw new Error('订单不存在')
        return {
          id: order.id,
          orderNo: order.orderNo,
          status: order.status,
          totalAmount: order.totalAmount,
          currency: order.currency,
          items: order.items.map((item) => ({
            productName: item.productName,
            skuName: item.skuName,
            quantity: item.quantity,
          })),
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        }
      }
      case 'get_business_overview':
        return this.dashboardService.getOverview(actor, merchantId, storeId)
      case 'search_platform_rules':
        return this.rulesService.search(
          actor,
          merchantId,
          input.query as string,
        )
      case 'create_product_optimization_draft': {
        const product = await this.findProductByCode(
          actor,
          merchantId,
          input.productCode as string,
          storeId,
        )
        const optimization = await this.optimizationsService.create(
          actor,
          merchantId,
          product.id,
          {
            targetLanguage: input.targetLanguage as OptimizationLanguage,
          },
        )
        return {
          optimizationId: optimization.id,
          productId: product.id,
          productCode: product.code,
          status: optimization.status,
          targetLanguage: optimization.targetLanguage,
          requiresHumanConfirmation: true,
        }
      }
    }
  }

  private async findProductByCode(
    actor: AuthenticatedUser,
    merchantId: string,
    productCode: string,
    storeId?: string,
  ): Promise<ProductSummary> {
    const result = await this.productsService.list(actor, merchantId, {
      page: 1,
      pageSize: 5,
      keyword: productCode,
      ...(storeId ? { storeId } : {}),
    })
    const product = result.items.find((item) => item.code === productCode)
    if (!product) throw new Error('商品不存在')
    return product
  }

  private async failedCall(
    actor: AuthenticatedUser,
    merchantId: string,
    call: PlannedAgentToolCall,
    error: string,
    validatedInput?: Record<string, unknown>,
  ): Promise<AgentToolCallSummary> {
    const input =
      validatedInput ??
      (typeof call.arguments === 'object' && call.arguments !== null
        ? (call.arguments as Record<string, unknown>)
        : {})
    const name = isAgentToolName(call.name) ? call.name : 'unknown'
    await this.auditLogsService.recordAgentToolCall({
      actor,
      merchantId,
      toolCallId: call.id,
      toolName: call.name,
      arguments: input,
      status: 'error',
      error,
    })
    return {
      id: call.id,
      name,
      status: 'error',
      input,
      error,
    }
  }
}
