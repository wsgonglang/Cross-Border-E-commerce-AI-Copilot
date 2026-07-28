import { Injectable } from '@nestjs/common'
import type { AuthenticatedUser } from '@cross-border/shared'

import { MerchantAccessService } from '../commerce/merchant-access.service'

interface DemoRule {
  id: string
  title: string
  scope: string
  keywords: string[]
  excerpt: string
}

const DEMO_RULES: DemoRule[] = [
  {
    id: 'DEMO-RULE-TITLE-001',
    title: '演示平台商品标题规范',
    scope: 'DEMO_MARKETPLACE',
    keywords: ['标题', '关键词', '夸大', 'title', 'keyword'],
    excerpt: '标题应准确描述商品，不应包含无法验证的绝对化、排名或保证性表述。',
  },
  {
    id: 'DEMO-RULE-ELECTRIC-001',
    title: '演示平台电器商品发布检查',
    scope: 'DEMO_MARKETPLACE',
    keywords: ['充电器', '电器', '插头', '电压', '认证', 'charger'],
    excerpt:
      '电器类商品发布前应由运营人员核对目标市场的插头、电压和适用认证信息；信息不完整时不得声称已经合规。',
  },
  {
    id: 'DEMO-RULE-CLAIMS-001',
    title: '演示平台营销声明规范',
    scope: 'DEMO_MARKETPLACE',
    keywords: ['最好', '第一', '保证', '功效', '声明', 'claim'],
    excerpt:
      '营销声明应具备可验证依据，禁止使用无法证明的“最好”“第一”或保证结果等表述。',
  },
]

@Injectable()
export class PlatformRulesService {
  constructor(private readonly merchantAccess: MerchantAccessService) {}

  async search(
    user: AuthenticatedUser,
    merchantId: string,
    query: string,
  ): Promise<{
    sufficient: boolean
    notice: string
    sources: Array<{
      sourceId: string
      title: string
      scope: string
      excerpt: string
    }>
  }> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const normalized = query.toLowerCase()
    const sources = DEMO_RULES.filter((rule) =>
      rule.keywords.some((keyword) =>
        normalized.includes(keyword.toLowerCase()),
      ),
    )
      .slice(0, 3)
      .map((rule) => ({
        sourceId: rule.id,
        title: rule.title,
        scope: rule.scope,
        excerpt: rule.excerpt,
      }))
    return {
      sufficient: sources.length > 0,
      notice:
        sources.length > 0
          ? '结果来自最小演示规则目录，正式平台规则仍需人工复核。'
          : '演示规则目录信息不足，不能据此判断真实平台合规性。',
      sources,
    }
  }
}
