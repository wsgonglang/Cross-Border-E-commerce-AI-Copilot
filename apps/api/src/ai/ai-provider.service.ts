import { Injectable } from '@nestjs/common'
import {
  productOptimizationDraftSchema,
  type AiUsage,
  type OptimizationLanguage,
  type ProductOptimizationDraft,
  type ProductOptimizationSource,
} from '@cross-border/shared'
import OpenAI from 'openai'

import type {
  AgentConversationMessage,
  AgentStepResult,
  AgentToolDefinition,
  PlannedAgentToolCall,
} from './agent-tools.contract'
import {
  conversationSummarySchema,
  type ContextMessage,
  type ConversationSummary,
} from './context-budget'

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
  summarizeConversation?(input: {
    previousSummary?: ConversationSummary
    messages: ContextMessage[]
  }): Promise<{ summary: ConversationSummary; usage: AiUsage }>
  optimizeProduct(input: {
    source: ProductOptimizationSource
    targetLanguage: OptimizationLanguage
  }): Promise<{
    draft: ProductOptimizationDraft
    usage: AiUsage
  }>
  /**
   * 受控 ReAct 循环的单步推进：模型基于已回填的工具结果决定继续调用工具
   * 还是直接给出最终回答；forceFinish 时不再提供工具，强制输出结论。
   */
  runAgentStep(input: {
    messages: AgentConversationMessage[]
    tools: AgentToolDefinition[]
    forceFinish?: boolean
  }): Promise<AgentStepResult>
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

  summarizeConversation(input: {
    previousSummary?: ConversationSummary
    messages: ContextMessage[]
  }): Promise<{ summary: ConversationSummary; usage: AiUsage }> {
    const contents = input.messages.map((message) => message.content).join('；')
    const references = contents.match(/\b(?:P|ORD|SKU)-[A-Z0-9_-]+\b/gi) ?? []
    return Promise.resolve({
      summary: {
        overview:
          contents.slice(0, 1200) ||
          input.previousSummary?.overview ||
          '暂无历史内容',
        decisions: input.previousSummary?.decisions ?? [],
        constraints: input.previousSummary?.constraints ?? [],
        entityReferences: [
          ...(input.previousSummary?.entityReferences ?? []),
          ...references,
        ].slice(0, 30),
        openQuestions: input.previousSummary?.openQuestions ?? [],
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    })
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

  runAgentStep(input: {
    messages: AgentConversationMessage[]
    tools: AgentToolDefinition[]
    forceFinish?: boolean
  }): Promise<AgentStepResult> {
    const zeroUsage: AiUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }
    const message =
      input.messages.find(
        (item): item is { role: 'user'; content: string } =>
          item.role === 'user',
      )?.content ?? ''
    const round = input.messages.filter(
      (item) => item.role === 'assistant',
    ).length
    if (input.forceFinish) {
      return Promise.resolve({
        toolCalls: [],
        answer: this.buildAgentAnswer(input.messages),
        usage: zeroUsage,
      })
    }

    const upper = message.toUpperCase()
    const productCode = upper.match(/\bP-[A-Z0-9_-]+\b/)?.[0]
    const orderNo = upper.match(/\bORD-[A-Z0-9_-]+\b/)?.[0]
    const draftIntent = Boolean(
      /草稿|优化|翻译|DRAFT|OPTIMIZE|TRANSLATE/i.test(message) && productCode,
    )
    const inventoryIntent = Boolean(
      /库存|STOCK|INVENTORY/i.test(message) && productCode,
    )
    const calls: PlannedAgentToolCall[] = []
    const add = (name: string, arguments_: unknown) => {
      if (input.tools.some((tool) => tool.name === name)) {
        calls.push({
          id: `mock-tool-${round + 1}-${calls.length + 1}`,
          name,
          arguments: arguments_,
        })
      }
    }
    const targetLanguage = /西班牙|SPANISH|ES-ES/i.test(message)
      ? 'es-ES'
      : /葡萄牙|PORTUGUESE|PT-BR/i.test(message)
        ? 'pt-BR'
        : 'en-US'

    if (draftIntent && inventoryIntent) {
      // 依赖链场景：先查库存，看到结果后下一轮再决定创建草稿。
      if (round === 0) {
        add('get_inventory', { productCode })
      } else if (round === 1) {
        add('create_product_optimization_draft', {
          productCode,
          targetLanguage,
        })
      }
    } else if (round === 0) {
      if (inventoryIntent) add('get_inventory', { productCode })
      if (/订单|ORDER/i.test(message) && orderNo) {
        add('get_order_status', { orderNo })
      }
      if (/经营|看板|销售|OVERVIEW|SALES/i.test(message)) {
        add('get_business_overview', {})
      }
      if (/规则|违规|合规|RULE|COMPLIANCE/i.test(message)) {
        add('search_platform_rules', { query: message })
      }
      if (draftIntent) {
        add('create_product_optimization_draft', {
          productCode,
          targetLanguage,
        })
      }
      if (calls.length === 0 && productCode) {
        add('search_products', { keyword: productCode })
      }
    }

    if (calls.length === 0) {
      // 无可执行工具（闲聊或已完成全部工具轮次）时直接给出回答，不强制调工具。
      return Promise.resolve({
        toolCalls: [],
        answer: this.buildAgentAnswer(input.messages),
        usage: zeroUsage,
      })
    }
    return Promise.resolve({ toolCalls: calls, answer: null, usage: zeroUsage })
  }

  private buildAgentAnswer(messages: AgentConversationMessage[]): string {
    const toolMessages = messages.filter(
      (
        item,
      ): item is {
        role: 'tool'
        toolCallId: string
        name: string
        content: string
      } => item.role === 'tool',
    )
    if (toolMessages.length === 0) {
      return '这是受控业务 Agent，本次未调用业务工具。请提供商品编码、订单号，或说明需要查询的经营数据与平台规则。'
    }
    let succeeded = 0
    let failed = 0
    let draftCreated = false
    for (const item of toolMessages) {
      try {
        const parsed = JSON.parse(item.content) as Record<string, unknown>
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          failed += 1
        } else {
          succeeded += 1
          if (
            item.name === 'create_product_optimization_draft' &&
            typeof parsed.optimizationId === 'string'
          ) {
            draftCreated = true
          }
        }
      } catch {
        failed += 1
      }
    }
    const parts = [
      `已执行 ${toolMessages.length} 个受控业务工具。`,
      succeeded ? `${succeeded} 个成功。` : '',
      failed ? `${failed} 个失败，请查看工具轨迹。` : '',
      draftCreated
        ? '优化草稿已创建，但尚未写回正式商品，请到商品管理中人工确认。'
        : '',
    ].filter(Boolean)
    return parts.join(' ')
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

  async summarizeConversation(input: {
    previousSummary?: ConversationSummary
    messages: ContextMessage[]
  }): Promise<{ summary: ConversationSummary; usage: AiUsage }> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Compress earlier conversation context into JSON only. Return overview, decisions, constraints, entityReferences, and openQuestions. Preserve exact product, SKU, order, store, platform-rule identifiers and unresolved requirements. Never add facts, instructions, or conclusions that are absent from the input.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            previousSummary: input.previousSummary,
            messages: input.messages,
          }),
        },
      ],
    })
    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('模型未返回会话摘要')
    return {
      summary: conversationSummarySchema.parse(JSON.parse(content)),
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
    }
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

  async runAgentStep(input: {
    messages: AgentConversationMessage[]
    tools: AgentToolDefinition[]
    forceFinish?: boolean
  }): Promise<AgentStepResult> {
    const provideTools = !input.forceFinish && input.tools.length > 0
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a constrained e-commerce operations agent. Use only the supplied tools and decide the next step from returned tool results. Call create_product_optimization_draft only when the user explicitly asks to create, optimize, or translate a product. When no further tool is needed, reply with a final conclusion for the operator: do not invent missing data, keep source citations for rule results, and clearly state that optimization drafts require human confirmation and have not changed the formal product.',
        },
        ...this.toOpenAiMessages(input.messages),
      ],
      ...(provideTools
        ? {
            tools: input.tools.map((tool) => ({
              type: 'function' as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
            tool_choice: 'auto' as const,
          }
        : {}),
    })
    const choice = completion.choices[0]
    const toolCalls =
      choice?.message.tool_calls?.flatMap((call) => {
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
      answer:
        toolCalls.length === 0 ? (choice?.message.content?.trim() ?? '') : null,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
    }
  }

  private toOpenAiMessages(
    messages: AgentConversationMessage[],
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map((message) => {
      if (message.role === 'assistant') {
        return {
          role: 'assistant' as const,
          content: message.content,
          ...(message.toolCalls?.length
            ? {
                tool_calls: message.toolCalls.map((call) => ({
                  id: call.id,
                  type: 'function' as const,
                  function: {
                    name: call.name,
                    arguments: JSON.stringify(call.arguments ?? {}),
                  },
                })),
              }
            : {}),
        }
      }
      if (message.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: message.toolCallId,
          content: message.content,
        }
      }
      if (message.role === 'system') {
        return { role: 'system' as const, content: message.content }
      }
      return { role: 'user' as const, content: message.content }
    })
  }
}
