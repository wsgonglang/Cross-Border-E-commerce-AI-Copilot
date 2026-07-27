import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { AuthenticatedUser } from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'

@Injectable()
export class MerchantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAccess(
    user: AuthenticatedUser,
    merchantId: string,
  ): Promise<void> {
    const isAdmin = user.roles.includes('admin')
    if (!isAdmin && !user.merchantIds.includes(merchantId)) {
      throw new ForbiddenException('当前账号无权访问该商家')
    }

    const merchant = await this.prisma.merchant.findFirst({
      where: {
        id: merchantId,
        ...(isAdmin ? {} : { status: 'ACTIVE' }),
      },
      select: { id: true },
    })
    if (!merchant) {
      throw new NotFoundException('商家不存在或已停用')
    }
  }
}
