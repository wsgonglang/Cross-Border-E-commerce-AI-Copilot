import { Module } from '@nestjs/common'

import { API_ENVIRONMENT } from '../config/api-config.constants'
import { CommerceModule } from '../commerce/commerce.module'
import { DatabaseModule } from '../database/database.module'
import { AgentController } from './agent.controller'
import { AgentFeedbackService } from './agent-feedback.service'
import { AgentCancellationMonitorService } from './agent-cancellation-monitor.service'
import { AgentProcessorService } from './agent-processor.service'
import { AgentQueueService } from './agent-queue.service'
import { AgentService } from './agent.service'
import { AgentWorkerRunnerService } from './agent-worker-runner.service'
import { AgentRunsService } from './agent-runs.service'
import { AgentToolsService } from './agent-tools.service'
import { AiQualityController } from './ai-quality.controller'
import { AiQualityService } from './ai-quality.service'
import { AiChatController } from './ai-chat.controller'
import { AiSessionsController } from './ai-sessions.controller'
import { AiSessionsService } from './ai-sessions.service'
import { AiSessionSharesController } from './ai-session-shares.controller'
import { AiSessionSharesService } from './ai-session-shares.service'
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
import { AiResultsController } from './ai-results.controller'
import { AiResultsService } from './ai-results.service'

@Module({
  imports: [DatabaseModule, CommerceModule],
  controllers: [
    AiSessionsController,
    AiSessionSharesController,
    AiChatController,
    AgentController,
    AiQualityController,
    AiResultsController,
    ProductOptimizationsController,
    RuleDocumentsController,
  ],
  providers: [
    AiSessionsService,
    AiSessionSharesService,
    AiService,
    AgentService,
    AgentFeedbackService,
    AgentQueueService,
    AgentProcessorService,
    AgentCancellationMonitorService,
    AgentWorkerRunnerService,
    AgentRunsService,
    AiResultsService,
    AgentToolsService,
    AiQualityService,
    PlatformRulesService,
    ProductOptimizationsService,
    {
      provide: AI_PROVIDER,
      inject: [API_ENVIRONMENT],
      useFactory: (environment: {
        OPENAI_API_KEY?: string
        OPENAI_BASE_URL?: string
        AI_MODEL?: string
        AI_TIMEOUT_MS?: number
      }) => {
        if (environment.OPENAI_API_KEY) {
          return new OpenAiProvider({
            apiKey: environment.OPENAI_API_KEY,
            baseURL: environment.OPENAI_BASE_URL,
            model: environment.AI_MODEL,
            timeoutMs: environment.AI_TIMEOUT_MS,
          })
        }
        return new MockAiProvider()
      },
    },
  ],
  exports: [ProductOptimizationsService, AgentWorkerRunnerService],
})
export class AiModule {}
