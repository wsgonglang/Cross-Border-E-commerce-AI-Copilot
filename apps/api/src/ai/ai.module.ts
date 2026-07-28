import { Module } from '@nestjs/common'

import { API_ENVIRONMENT } from '../config/api-config.constants'
import { CommerceModule } from '../commerce/commerce.module'
import { DatabaseModule } from '../database/database.module'
import { AgentController } from './agent.controller'
import { AgentService } from './agent.service'
import { AgentToolsService } from './agent-tools.service'
import { AiChatController } from './ai-chat.controller'
import { AiSessionsController } from './ai-sessions.controller'
import { AiSessionsService } from './ai-sessions.service'
import { AiService } from './ai.service'
import {
  AI_PROVIDER,
  MockAiProvider,
  OpenAiProvider,
} from './ai-provider.service'
import { ProductOptimizationsController } from './product-optimizations.controller'
import { ProductOptimizationsService } from './product-optimizations.service'
import { PlatformRulesService } from './platform-rules.service'
import { RuleDocumentsController } from './rule-documents.controller'

@Module({
  imports: [DatabaseModule, CommerceModule],
  controllers: [
    AiSessionsController,
    AiChatController,
    AgentController,
    ProductOptimizationsController,
    RuleDocumentsController,
  ],
  providers: [
    AiSessionsService,
    AiService,
    AgentService,
    AgentToolsService,
    PlatformRulesService,
    ProductOptimizationsService,
    {
      provide: AI_PROVIDER,
      inject: [API_ENVIRONMENT],
      useFactory: (environment: {
        OPENAI_API_KEY?: string
        OPENAI_BASE_URL?: string
        AI_MODEL?: string
      }) => {
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
  exports: [ProductOptimizationsService],
})
export class AiModule {}
