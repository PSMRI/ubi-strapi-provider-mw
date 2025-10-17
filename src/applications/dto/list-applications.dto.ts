import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString, IsNotEmpty, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ListApplicationsDto {
  @ApiProperty({
    description: 'Filter by benefit ID',
    required: true,
    example: 'benefit-123'
  })
  @IsString()
  @IsNotEmpty()
  benefitId: string;

  @ApiProperty({
    description: 'Results per page',
    required: false,
    default: 20,
    minimum: 1,
    example: 20
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;

  @ApiProperty({
    description: 'Records to skip for pagination',
    required: false,
    example: 0
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;

  @ApiProperty({
    description: 'Field to order by',
    required: false,
    enum: ['updatedAt', 'createdAt'],
    example: 'updatedAt'
  })
  @IsString()
  @IsOptional()
  orderBy?: string;

  @ApiProperty({
    description: 'Order direction',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc'
  })
  @IsString()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  orderDirection?: 'asc' | 'desc' = 'desc';
} 