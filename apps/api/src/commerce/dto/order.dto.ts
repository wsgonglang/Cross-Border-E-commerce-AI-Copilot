import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator'

const orderStatuses = [
  'PENDING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDING',
  'REFUNDED',
] as const
const paymentStatuses = [
  'UNPAID',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const
const fulfillmentStatuses = [
  'UNFULFILLED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const
const sortFields = ['createdAt', 'updatedAt', 'totalAmount', 'orderNo'] as const
const sortOrders = ['asc', 'desc'] as const
const viewColumns = [
  'store',
  'orderNo',
  'customer',
  'amount',
  'status',
  'paymentStatus',
  'fulfillmentStatus',
  'createdAt',
] as const
const bulkActions = [
  'CONFIRM',
  'MARK_SHIPPED',
  'MARK_DELIVERED',
  'CANCEL',
  'START_REFUND',
  'CONFIRM_REFUND',
] as const

function toList({ value }: { value: unknown }): unknown {
  if (Array.isArray(value)) return value
  return typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : value
}

export class OrderQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @Min(1)
  page = 1

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize = 20

  @ApiPropertyOptional({
    enum: orderStatuses,
  })
  @IsOptional()
  @IsIn(orderStatuses)
  status?: (typeof orderStatuses)[number]

  @ApiPropertyOptional({ description: '逗号分隔的订单状态' })
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsIn(orderStatuses, { each: true })
  statuses?: Array<(typeof orderStatuses)[number]>

  @ApiPropertyOptional({ description: '逗号分隔的支付状态' })
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsIn(paymentStatuses, { each: true })
  paymentStatuses?: Array<(typeof paymentStatuses)[number]>

  @ApiPropertyOptional({ description: '逗号分隔的履约状态' })
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsIn(fulfillmentStatuses, { each: true })
  fulfillmentStatuses?: Array<(typeof fulfillmentStatuses)[number]>

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(64)
  keyword?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(30)
  storeId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string

  @ApiPropertyOptional({ example: '10.00' })
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  minAmount?: string

  @ApiPropertyOptional({ example: '500.00' })
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  maxAmount?: string

  @ApiPropertyOptional({ enum: sortFields, default: 'createdAt' })
  @IsOptional()
  @IsIn(sortFields)
  sortBy?: (typeof sortFields)[number]

  @ApiPropertyOptional({ enum: sortOrders, default: 'desc' })
  @IsOptional()
  @IsIn(sortOrders)
  sortOrder?: (typeof sortOrders)[number]
}

export class UpdateOrderStatusDto {
  @ApiProperty({ example: 'SHIPPED' })
  @IsIn([
    'CONFIRMED',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
    'REFUNDING',
    'REFUNDED',
  ])
  status!:
    | 'CONFIRMED'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REFUNDING'
    | 'REFUNDED'
}

export class CreateOrderSavedViewDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string

  @ApiPropertyOptional({ enum: orderStatuses, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(orderStatuses, { each: true })
  statuses?: Array<(typeof orderStatuses)[number]>

  @ApiPropertyOptional({ enum: paymentStatuses, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(paymentStatuses, { each: true })
  paymentStatuses?: Array<(typeof paymentStatuses)[number]>

  @ApiPropertyOptional({ enum: fulfillmentStatuses, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(fulfillmentStatuses, { each: true })
  fulfillmentStatuses?: Array<(typeof fulfillmentStatuses)[number]>

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  storeId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  minAmount?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  maxAmount?: string

  @ApiPropertyOptional({ enum: sortFields, default: 'createdAt' })
  @IsOptional()
  @IsIn(sortFields)
  sortBy?: (typeof sortFields)[number]

  @ApiPropertyOptional({ enum: sortOrders, default: 'desc' })
  @IsOptional()
  @IsIn(sortOrders)
  sortOrder?: (typeof sortOrders)[number]

  @ApiPropertyOptional({ enum: viewColumns, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(viewColumns, { each: true })
  columns?: Array<(typeof viewColumns)[number]>

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}

export class UpdateOrderSavedViewDto extends PartialType(
  CreateOrderSavedViewDto,
) {}

export class BulkOrderActionDto {
  @ApiProperty({ enum: bulkActions })
  @IsIn(bulkActions)
  action!: (typeof bulkActions)[number]

  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  orderIds!: string[]

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,100}$/)
  idempotencyKey!: string
}

export class DashboardQueryDto {
  @ApiPropertyOptional({ example: 7, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  startDate?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  endDate?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(30)
  storeId?: string
}
