import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type {
  AuthenticatedUser,
  BatchTaskDetail,
  PaginatedBatchTasks,
} from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { BatchTasksService } from './batch-tasks.service'
import { BatchTaskQueryDto, CreateBatchTaskDto } from './dto/batch-task.dto'

@ApiTags('batch-ai-tasks')
@ApiBearerAuth()
@Roles('admin', 'operator')
@Controller('api/merchants/:merchantId/ai/batch-tasks')
export class BatchTasksController {
  constructor(private readonly batchTasksService: BatchTasksService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Query() query: BatchTaskQueryDto,
  ): Promise<PaginatedBatchTasks> {
    return this.batchTasksService.list(user, merchantId, query)
  }

  @Get(':taskId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('taskId') taskId: string,
  ): Promise<BatchTaskDetail> {
    return this.batchTasksService.get(user, merchantId, taskId)
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: CreateBatchTaskDto,
  ): Promise<BatchTaskDetail> {
    return this.batchTasksService.create(user, merchantId, dto)
  }

  @Post(':taskId/cancel')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('taskId') taskId: string,
  ): Promise<BatchTaskDetail> {
    return this.batchTasksService.cancel(user, merchantId, taskId)
  }
}
