import { Injectable } from '@nestjs/common'
import {
  productOptimizationDraftSchema,
  type AiUsage,
  type OptimizationLanguage,
  type ProductOptimizationDraft,
  type ProductOptimizationSource,
} from '@cross-border/shared'
import OpenAI from 'openai'

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
}
