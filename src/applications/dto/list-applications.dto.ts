import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, IsNotEmpty, IsIn, IsArray, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicationStatus } from './update-application-status.dto';

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
    maximum: 100,
    example: 20
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
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
    enum: ['updatedAt', 'createdAt', 'id'],
    example: 'updatedAt'
  })
  @IsString()
  @IsOptional()
  @IsIn(['updatedAt', 'createdAt', 'id'])
  orderBy?: 'updatedAt' | 'createdAt' | 'id';

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

  @ApiProperty({
    description: 'Filter by application status',
    required: false,
    type: [String],
    enum: ApplicationStatus,
    example: ['pending', 'approved'],
    isArray: true
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ApplicationStatus, { each: true })
  status?: ApplicationStatus[];
} 