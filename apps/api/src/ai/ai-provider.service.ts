import { Injectable } from '@nestjs/common'
import OpenAI from 'openai'

export const AI_PROVIDER = 'AI_PROVIDER'

export interface AiProvider {
  chat(
    messages: { role: string; content: string }[],
    signal?: AbortSignal,
    onChunk?: (chunk: string) => void,
  ): Promise<void>
  generateTitle(messages: { role: string; content: string }[]): Promise<string>
}

const MOCK_DELAY = 5

function abortError(): Error {
  const error = new Error('生成已取消')
  error.name = 'AbortError'
  return error
}

@Injectable()
export class MockAiProvider implements AiProvider {
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
}

@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI
  private readonly model: string

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
}
