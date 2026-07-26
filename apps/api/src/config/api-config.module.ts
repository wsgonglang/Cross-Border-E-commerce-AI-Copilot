import { Global, Module } from '@nestjs/common'
import { loadApiEnvironment } from '@cross-border/shared'

import { API_ENVIRONMENT } from './api-config.constants'

@Global()
@Module({
  providers: [
    {
      provide: API_ENVIRONMENT,
      useFactory: () => loadApiEnvironment(process.env),
    },
  ],
  exports: [API_ENVIRONMENT],
})
export class ApiConfigModule {}
