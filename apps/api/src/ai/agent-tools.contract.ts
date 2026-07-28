import { AGENT_TOOL_NAMES, type AgentToolName } from '@cross-border/shared'
import { z } from 'zod'

export interface AgentToolDefinition {
  name: AgentToolName
  description: string
  parameters: Record<string, unknown>
}

export interface PlannedAgentToolCall {
  id: string
  name: string
  arguments: unknown
}

const productCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Z0-9][A-Z0-9_-]+$/)

export const agentToolInputSchemas = {
  search_products: z
    .object({
      keyword: z.string().trim().min(1).max(100).optional(),
    })
    .strict(),
  get_inventory: z
    .object({
      productCode: productCodeSchema,
    })
    .strict(),
  get_order_status: z
    .object({
      orderNo: z.string().trim().min(2).max(64),
    })
    .strict(),
  get_business_overview: z.object({}).strict(),
  search_platform_rules: z
    .object({
      query: z.string().trim().min(2).max(200),
    })
    .strict(),
  create_product_optimization_draft: z
    .object({
      productCode: productCodeSchema,
      targetLanguage: z.enum(['en-US', 'es-ES', 'pt-BR']),
    })
    .strict(),
} satisfies Record<AgentToolName, z.ZodType>

export const AGENT_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    name: 'search_products',
    description: '按商品编码、标题或 SKU 编码查询当前商家的商品。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { keyword: { type: 'string' } },
    },
  },
  {
    name: 'get_inventory',
    description: '按商品编码查询当前商家的 SKU 和库存。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['productCode'],
      properties: { productCode: { type: 'string' } },
    },
  },
  {
    name: 'get_order_status',
    description: '按订单号查询当前商家的订单状态和订单明细。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['orderNo'],
      properties: { orderNo: { type: 'string' } },
    },
  },
  {
    name: 'get_business_overview',
    description: '查询今日订单、销售额、商品数和低库存数量。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'search_platform_rules',
    description: '检索最小演示规则目录并返回来源；信息不足时必须明确说明。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: { query: { type: 'string' } },
    },
  },
  {
    name: 'create_product_optimization_draft',
    description:
      '为商品创建待人工确认的优化草稿。只创建草稿，绝不写回正式商品。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['productCode', 'targetLanguage'],
      properties: {
        productCode: { type: 'string' },
        targetLanguage: {
          type: 'string',
          enum: ['en-US', 'es-ES', 'pt-BR'],
        },
      },
    },
  },
]

export function isAgentToolName(value: string): value is AgentToolName {
  return (AGENT_TOOL_NAMES as readonly string[]).includes(value)
}
