import { Injectable } from '@nestjs/common'
import {
  productOptimizationDraftSchema,
  type AgentToolCallSummary,
  type AiUsage,
  type OptimizationLanguage,
  type ProductOptimizationDraft,
  type ProductOptimizationSource,
} from '@cross-border/shared'
import OpenAI from 'openai'

import type {
  AgentToolDefinition,
  PlannedAgentToolCall,
} from './agent-tools.contract'

export const AI_PROVIDER = 'AI_PROVIDER'

export interface AiProvider {
  readonly name: string
  readonly model: string
  chat(
    messages: { role: string; content: string }[],
    signal?: AbortSignal,
    onChunk?: (chunk: string) => void,
  ): Promise<void>
  generateTitle(messages: { role: string; content: string }[]): Promise<string>
  optimizeProduct(input: {
    source: ProductOptimizationSource
    targetLanguage: OptimizationLanguage
  }): Promise<{
    draft: ProductOptimizationDraft
    usage: AiUsage
  }>
  planAgentTools(input: {
    message: string
    tools: AgentToolDefinition[]
  }): Promise<{ toolCalls: PlannedAgentToolCall[]; usage: AiUsage }>
  summarizeAgent(input: {
    message: string
    toolCalls: AgentToolCallSummary[]
  }): Promise<{ answer: string; usage: AiUsage }>
}

const MOCK_DELAY = 5

function abortError(): Error {
  const error = new Error('生成已取消')
  error.name = 'AbortError'
  return error
}

@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = 'mock'
  readonly model = 'mock-product-optimizer-v1'

  async chat(
    _messages: { role: string; content: string }[],
    signal?: AbortSignal,
    onChunk?: (chunk: string) => void,
  ): Promise<void> {
    const response =
      '这是一个模拟 AI 回复。实际部署时需要配置 OPENAI_API_KEY 环境变量。\n\n您输入的消息已收到，我可以帮助您：\n\n1. 优化商品标题和描述\n2. 翻译为多语言\n3. 检查合规风险\n4. 分析销售数据\n\n请配置有效的 AI 模型后使用真实对话功能。'
    const chars = response.split('')
    for (let i = 0; i < chars.length; i++) {
      if (signal?.aborted) {
        throw abortError()
      }
      await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY))
      onChunk?.(chars[i]!)
    }
  }

  generateTitle(
    messages: { role: string; content: string }[],
  ): Promise<string> {
    return Promise.resolve(messages.length > 0 ? 'AI 对话' : 'AI 对话')
  }

  optimizeProduct(input: {
    source: ProductOptimizationSource
    targetLanguage: OptimizationLanguage
  }): Promise<{ draft: ProductOptimizationDraft; usage: AiUsage }> {
    const localized = {
      'en-US': {
        title: 'Portable Multi-Port Travel Charger',
        description:
          'A compact multi-port USB charger designed for convenient international travel.',
        points: [
          'Compact travel-ready design',
          'Multiple USB charging ports',
          'Suitable for cross-border travel scenarios',
        ],
        risk: 'Verify plug and electrical certifications for the target market.',
        suggestion: 'Add package dimensions and supported voltage details.',
      },
      'es-ES': {
        title: 'Cargador de viaje portátil multipuerto',
        description:
          'Cargador USB compacto con varios puertos, diseñado para viajes internacionales.',
        points: [
          'Diseño compacto para viajar',
          'Varios puertos de carga USB',
          'Adecuado para viajes internacionales',
        ],
        risk: 'Verifica las certificaciones eléctricas y del enchufe para el mercado objetivo.',
        suggestion: 'Añade las dimensiones y el voltaje compatible.',
      },
      'pt-BR': {
        title: 'Carregador de viagem portátil com várias portas',
        description:
          'Carregador USB compacto com várias portas, desenvolvido para viagens internacionais.',
        points: [
          'Design compacto para viagens',
          'Várias portas de carregamento USB',
          'Adequado para viagens internacionais',
        ],
        risk: 'Verifique as certificações elétricas e do plugue para o mercado de destino.',
        suggestion: 'Adicione dimensões e detalhes da tensão compatível.',
      },
    }[input.targetLanguage]

    return Promise.resolve({
      draft: {
        title: localized.title,
        description: localized.description,
        sellingPoints: localized.points,
        complianceRisks: [localized.risk],
        suggestions: [localized.suggestion],
        language: input.targetLanguage,
        confidence: 0.86,
      },
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    })
  }

  planAgentTools(input: {
    message: string
    tools: AgentToolDefinition[]
  }): Promise<{ toolCalls: PlannedAgentToolCall[]; usage: AiUsage }> {
    const message = input.message
    const upper = message.toUpperCase()
    const productCode = upper.match(/\bP-[A-Z0-9_-]+\b/)?.[0]
    const orderNo = upper.match(/\bORD-[A-Z0-9_-]+\b/)?.[0]
    const calls: PlannedAgentToolCall[] = []
    const add = (name: string, arguments_: unknown) => {
      if (input.tools.some((tool) => tool.name === name)) {
        calls.push({
          id: `mock-tool-${calls.length + 1}`,
          name,
          arguments: arguments_,
        })
      }
    }

    if (/库存|STOCK|INVENTORY/i.test(message) && productCode) {
      add('get_inventory', { productCode })
    }
    if (/订单|ORDER/i.test(message) && orderNo) {
      add('get_order_status', { orderNo })
    }
    if (/经营|看板|销售|OVERVIEW|SALES/i.test(message)) {
      add('get_business_overview', {})
    }
    if (/规则|违规|合规|RULE|COMPLIANCE/i.test(message)) {
      add('search_platform_rules', { query: message })
    }
    if (
      /草稿|优化|翻译|DRAFT|OPTIMIZE|TRANSLATE/i.test(message) &&
      productCode
    ) {
      const targetLanguage = /西班牙|SPANISH|ES-ES/i.test(message)
        ? 'es-ES'
        : /葡萄牙|PORTUGUESE|PT-BR/i.test(message)
          ? 'pt-BR'
          : 'en-US'
      add('create_product_optimization_draft', {
        productCode,
        targetLanguage,
      })
    }
    if (calls.length === 0) {
      add('search_products', {
        ...(productCode ? { keyword: productCode } : {}),
      })
    }

    return Promise.resolve({
      toolCalls: calls,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    })
  }

  summarizeAgent(input: {
    message: string
    toolCalls: AgentToolCallSummary[]
  }): Promise<{ answer: string; usage: AiUsage }> {
    const succeeded = input.toolCalls.filter(
      (call) => call.status === 'success',
    )
    const failed = input.toolCalls.filter((call) => call.status === 'error')
    const created = succeeded.find(
      (call) => call.name === 'create_product_optimization_draft',
    )
    const parts = [
      `已根据“${input.message}”执行 ${input.toolCalls.length} 个受控业务工具。`,
      succeeded.length ? `${succeeded.length} 个成功。` : '',
      failed.length ? `${failed.length} 个失败，请查看工具轨迹。` : '',
      created
        ? '优化草稿已创建，但尚未写回正式商品，请到商品管理中人工确认。'
        : '',
    ].filter(Boolean)
    return Promise.resolve({
      answer: parts.join(' '),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    })
  }
}

@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI
  readonly name = 'openai-compatible'
  readonly model: string

  constructor(config: { apiKey?: string; baseURL?: string; model?: string }) {
    this.client = new OpenAI({
      apiKey: config.apiKey || '',
      baseURL: config.baseURL || 'https://api.siliconflow.cn/v1',
    })
    this.model = config.model || 'Qwen/Qwen2.5-7B-Instruct'
  }

  async chat(
    messages: { role: string; content: string }[],
    signal?: AbortSignal,
    onChunk?: (chunk: string) => void,
  ): Promise<void> {
    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages:
          messages as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        stream: true,
      },
      { signal },
    )

    try {
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || ''
        if (token) {
          onChunk?.(token)
        }
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  async generateTitle(
    messages: { role: string; content: string }[],
  ): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: '请为以下对话生成一个不超过10字的简洁标题，不要标点符号',
        },
        ...(messages as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[]),
      ],
    })

    return completion.choices[0]?.message?.content?.slice(0, 20) || 'AI 对话'
  }

  async optimizeProduct(input: {
    source: ProductOptimizationSource
    targetLanguage: OptimizationLanguage
  }): Promise<{ draft: ProductOptimizationDraft; usage: AiUsage }> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a cross-border e-commerce product operator. Return JSON only with title, description, sellingPoints, complianceRisks, suggestions, language, and confidence. Never invent certifications or guaranteed claims; list uncertain compliance points as risks.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Optimize and translate the product listing',
            targetLanguage: input.targetLanguage,
            source: input.source,
          }),
        },
      ],
    })
    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('模型未返回结构化商品草稿')
    }
    const draft = productOptimizationDraftSchema.parse(JSON.parse(content))
    if (draft.language !== input.targetLanguage) {
      throw new Error('模型返回的草稿语言与目标语言不一致')
    }
    return {
      draft,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
    }
  }

  async planAgentTools(input: {
    message: string
    tools: AgentToolDefinition[]
  }): Promise<{ toolCalls: PlannedAgentToolCall[]; usage: AiUsage }> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a constrained e-commerce operations agent. Use only the supplied tools. Read tools may be called as needed. Call create_product_optimization_draft only when the user explicitly asks to create, optimize, or translate a product. Never claim that a draft has changed the formal product.',
        },
        { role: 'user', content: input.message },
      ],
      tools: input.tools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      tool_choice: 'required',
    })
    const toolCalls =
      completion.choices[0]?.message.tool_calls?.flatMap((call) => {
        if (call.type !== 'function') return []
        let arguments_: unknown
        try {
          arguments_ = JSON.parse(call.function.arguments)
        } catch {
          arguments_ = null
        }
        return [
          {
            id: call.id,
            name: call.function.name,
            arguments: arguments_,
          },
        ]
      }) ?? []
    return {
      toolCalls,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
    }
  }

  async summarizeAgent(input: {
    message: string
    toolCalls: AgentToolCallSummary[]
  }): Promise<{ answer: string; usage: AiUsage }> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'Summarize the verified tool results for an e-commerce operator. Do not invent missing data. Clearly state that optimization drafts require human confirmation and have not changed the formal product. Keep source information for rule results.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            request: input.message,
            toolResults: input.toolCalls,
          }),
        },
      ],
    })
    return {
      answer:
        completion.choices[0]?.message.content?.trim() ||
        '工具已执行，请查看工具轨迹。',
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
    }
  }
}
