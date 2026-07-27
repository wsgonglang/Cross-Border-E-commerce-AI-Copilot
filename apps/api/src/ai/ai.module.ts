import { Module } from '@nestjs/common'

import { API_ENVIRONMENT } from '../config/api-config.constants'
import { MerchantAccessService } from '../commerce/merchant-access.service'
import { DatabaseModule } from '../database/database.module'
import { AiController } from './ai.controller'
import { AiSessionsService } from './ai-sessions.service'
import { AiService } from './ai.service'
import { AI_PROVIDER, MockAiProvider, OpenAiProvider } from './ai-provider.service'

@Module({
  imports: [DatabaseModule],
  controllers: [AiController],
  providers: [
    AiSessionsService,
    AiService,
    MerchantAccessService,
    {
      provide: AI_PROVIDER,
      inject: [API_ENVIRONMENT],
      useFactory: (environment: { OPENAI_API_KEY?: string; OPENAI_BASE_URL?: string; AI_MODEL?: string }) => {
        if (environment.OPENAI_API_KEY) {
          return new OpenAiProvider({
            apiKey: environment.OPENAI_API_KEY,
            baseURL: environment.OPENAI_BASE_URL,
            model: environment.AI_MODEL,
          })
        }
        return new MockAiProvider()
      },
    },
  ],
})
export class AiModule {}
