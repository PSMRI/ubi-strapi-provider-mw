import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateApplicationsDto {
  @ApiPropertyOptional({
    description: 'The unique benefit ID for the application',
    example: 'BENEFIT123',
  })
  @IsString()
  @IsOptional()
  benefitId?: string;

  @ApiPropertyOptional({
    description: 'The status of the application',
    example: 'Approved',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Additional application data in JSON format',
    example: { key: 'value' },
  })
  @IsOptional()
  @IsObject()
  applicationData?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Customer ID', example: 'CUST123' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'BAP ID', example: 'BAP456' })
  @IsOptional()
  @IsString()
  bapId?: string;

  @ApiPropertyOptional({ description: 'BAP Application ID', example: 'BAP_APP_123' })
  @IsOptional()
  @IsString()
  bapApplicationId?: string;

  @ApiPropertyOptional({ description: 'Calculated Amount', example: '1000.00' })
  @IsOptional()
  @IsString()
  calculatedAmount?: string;

  @ApiPropertyOptional({ description: 'Final Amount', example: '1200.00' })
  @IsOptional()
  @IsString()
  finalAmount?: string;
}
