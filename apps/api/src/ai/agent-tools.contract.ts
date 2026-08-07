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

/** 受控 Agent 循环中的中立会话消息，由各 Provider 自行映射到具体协议。 */
export type AgentConversationMessage =
  | { role: 'user'; content: string }
  | {
      role: 'assistant'
      content: string | null
      toolCalls?: PlannedAgentToolCall[]
    }
  | { role: 'tool'; toolCallId: string; name: string; content: string }

/** 单步模型输出：要么继续请求工具，要么给出最终回答。 */
export interface AgentStepResult {
  toolCalls: PlannedAgentToolCall[]
  answer: string | null
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
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

const AGENT_TOOL_DESCRIPTIONS: Record<AgentToolName, string> = {
  search_products: '按商品编码、标题或 SKU 编码查询当前商家的商品。',
  get_inventory: '按商品编码查询当前商家的 SKU 和库存。',
  get_order_status:
    '按订单号查询当前商家的生命周期、支付、履约、物流状态和商品明细；不会返回客户邮箱、电话或完整地址。',
  get_business_overview: '查询今日订单、销售额、商品数和低库存数量。',
  search_platform_rules:
    '检索当前商家可访问的全局和商家规则文档，返回可追溯引用；信息不足时必须明确说明。',
  create_product_optimization_draft:
    '为商品创建待人工确认的优化草稿。只创建草稿，绝不写回正式商品。',
}

function toToolParameters(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>
  delete jsonSchema.$schema
  return jsonSchema
}

// JSON Schema 直接由 Zod 校验器生成，保证模型看到的参数定义与服务端校验单一事实来源。
export const AGENT_TOOL_DEFINITIONS: AgentToolDefinition[] =
  AGENT_TOOL_NAMES.map((name) => ({
    name,
    description: AGENT_TOOL_DESCRIPTIONS[name],
    parameters: toToolParameters(agentToolInputSchemas[name]),
  }))

export function isAgentToolName(value: string): value is AgentToolName {
  return (AGENT_TOOL_NAMES as readonly string[]).includes(value)
}
