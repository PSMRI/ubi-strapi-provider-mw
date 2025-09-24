import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CsvExportEligibilityDto {
  @ApiProperty({
    description: 'Benefit ID to filter applications',
    required: true,
    example: 'benefit-123'
  })
  @IsString()
  @IsNotEmpty()
  benefitId: string;

  @ApiProperty({
    description: 'Type of report (as per reports.json)',
    required: true,
    example: 'benefit_amounts'
  })
  @IsString()
  @IsNotEmpty()
  type: string;
} 